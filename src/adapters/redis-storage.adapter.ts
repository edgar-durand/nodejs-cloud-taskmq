import Redis from 'ioredis';
import { IStateStorageAdapter, ITask, TaskStatus, TaskQueryOptions } from '../interfaces/storage-adapter.interface';

/**
 * Redis storage adapter options
 */
export interface RedisStorageOptions {
  host?: string;
  port?: number;
  password?: string;
  url?: string;
  keyPrefix?: string;
  options?: any;
}

/**
 * Redis storage adapter
 */
export class RedisStorageAdapter implements IStateStorageAdapter {
  private redis!: Redis;
  private keyPrefix: string;

  constructor(private options: RedisStorageOptions) {
    this.keyPrefix = options.keyPrefix || 'cloud-taskmq:';
  }

  async initialize(): Promise<void> {
    if (this.options.url) {
      this.redis = new Redis(this.options.url, this.options.options);
    } else {
      this.redis = new Redis({
        host: this.options.host || 'localhost',
        port: this.options.port || 6379,
        password: this.options.password,
        ...this.options.options,
      });
    }

    // Test connection
    await this.redis.ping();
  }

  private getTaskKey(taskId: string): string {
    return `${this.keyPrefix}task:${taskId}`;
  }

  private getUniquenessKey(key: string): string {
    return `${this.keyPrefix}unique:${key}`;
  }

  private getRateLimitKey(key: string): string {
    return `${this.keyPrefix}rate:${key}`;
  }

  private getQueueKey(queueName: string): string {
    return `${this.keyPrefix}queue:${queueName}`;
  }

  private getChainKey(chainId: string): string {
    return `${this.keyPrefix}chain:${chainId}`;
  }

  async saveTask(task: ITask): Promise<void> {
    const taskKey = this.getTaskKey(task.id);
    const queueKey = this.getQueueKey(task.queueName);
    const taskData = JSON.stringify(task);

    await Promise.all([
      this.redis.set(taskKey, taskData),
      this.redis.zadd(queueKey, Date.now(), task.id),
    ]);

    // Add to chain if applicable
    if (task.chain) {
      const chainKey = this.getChainKey(task.chain.id);
      await this.redis.zadd(chainKey, task.chain.index, task.id);
    }
  }

  private deserializeTask(taskData: string): ITask {
    const task = JSON.parse(taskData);
    
    // Convert date strings back to Date objects
    if (task.createdAt) {
      task.createdAt = new Date(task.createdAt);
    }
    if (task.updatedAt) {
      task.updatedAt = new Date(task.updatedAt);
    }
    if (task.completedAt) {
      task.completedAt = new Date(task.completedAt);
    }
    if (task.failedAt) {
      task.failedAt = new Date(task.failedAt);
    }
    if (task.scheduledAt) {
      task.scheduledAt = new Date(task.scheduledAt);
    }
    
    return task;
  }

  async getTask(taskId: string): Promise<ITask | null> {
    const taskKey = this.getTaskKey(taskId);
    const taskData = await this.redis.get(taskKey);
    
    if (!taskData) return null;
    
    return this.deserializeTask(taskData);
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, updateData?: Partial<ITask>): Promise<void> {
    const task = await this.getTask(taskId);
    if (!task) return;

    const updatedTask = {
      ...task,
      status,
      updatedAt: new Date(),
      ...updateData,
    };

    await this.saveTask(updatedTask);
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const task = await this.getTask(taskId);
    if (!task) return false;

    const taskKey = this.getTaskKey(taskId);
    const queueKey = this.getQueueKey(task.queueName);

    const result = await this.redis.del(taskKey);
    await this.redis.zrem(queueKey, taskId);

    // Remove from chain if applicable
    if (task.chain) {
      const chainKey = this.getChainKey(task.chain.id);
      await this.redis.zrem(chainKey, taskId);
    }

    return result > 0;
  }

  async createTask(task: ITask): Promise<ITask> {
    await this.saveTask(task);
    return task;
  }

  async getTasks(options?: TaskQueryOptions): Promise<ITask[]> {
    let taskIds: string[] = [];

    if (options?.queueName) {
      const queueKey = this.getQueueKey(options.queueName);
      taskIds = await this.redis.zrange(queueKey, 0, -1);
    } else {
      // Get all task keys
      const taskKeys = await this.redis.keys(`${this.keyPrefix}task:*`);
      taskIds = taskKeys.map(key => key.replace(`${this.keyPrefix}task:`, ''));
    }

    if (taskIds.length === 0) return [];

    // Get all tasks
    const pipeline = this.redis.pipeline();
    taskIds.forEach(id => pipeline.get(this.getTaskKey(id)));
    const results = await pipeline.exec();

    const tasks: ITask[] = [];
    if (results) {
      for (const [error, result] of results) {
        if (!error && result) {
          try {
            tasks.push(this.deserializeTask(result as string));
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    // Apply filters
    let filteredTasks = tasks;

    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      filteredTasks = filteredTasks.filter(task => statuses.includes(task.status));
    }

    if (options?.chainId) {
      filteredTasks = filteredTasks.filter(task => task.chain?.id === options.chainId);
    }

    if (options?.uniquenessKey) {
      filteredTasks = filteredTasks.filter(task => task.uniquenessKey === options.uniquenessKey);
    }

    if (options?.dateRange) {
      if (options.dateRange.from) {
        filteredTasks = filteredTasks.filter(task => new Date(task.createdAt) >= options.dateRange!.from!);
      }
      if (options.dateRange.to) {
        filteredTasks = filteredTasks.filter(task => new Date(task.createdAt) <= options.dateRange!.to!);
      }
    }

    // Apply sorting
    if (options?.sort) {
      filteredTasks.sort((a, b) => {
        const aValue = (a as any)[options.sort!.field];
        const bValue = (b as any)[options.sort!.field];
        
        if (aValue < bValue) return options.sort!.order === 'asc' ? -1 : 1;
        if (aValue > bValue) return options.sort!.order === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    if (options?.offset) {
      filteredTasks = filteredTasks.slice(options.offset);
    }
    if (options?.limit) {
      filteredTasks = filteredTasks.slice(0, options.limit);
    }

    return filteredTasks;
  }

  async getTaskCount(options?: TaskQueryOptions): Promise<number> {
    const tasks = await this.getTasks(options);
    return tasks.length;
  }

  async isUniquenessKeyActive(key: string): Promise<boolean> {
    const uniquenessKey = this.getUniquenessKey(key);
    const exists = await this.redis.exists(uniquenessKey);
    return exists === 1;
  }

  async setUniquenessKeyActive(key: string, taskId: string, ttlSeconds: number = 86400): Promise<void> {
    const uniquenessKey = this.getUniquenessKey(key);
    await this.redis.setex(uniquenessKey, ttlSeconds, taskId);
  }

  async removeUniquenessKey(key: string): Promise<void> {
    const uniquenessKey = this.getUniquenessKey(key);
    await this.redis.del(uniquenessKey);
  }

  async getRateLimit(key: string): Promise<{ count: number; resetTime: Date } | null> {
    const rateLimitKey = this.getRateLimitKey(key);
    const result = await this.redis.hmget(rateLimitKey, 'count', 'resetTime');
    
    if (!result[0] || !result[1]) return null;

    const resetTime = new Date(parseInt(result[1]));
    if (resetTime < new Date()) {
      await this.redis.del(rateLimitKey);
      return null;
    }

    return {
      count: parseInt(result[0]),
      resetTime,
    };
  }

  async incrementRateLimit(key: string, windowMs: number, maxRequests: number): Promise<{ allowed: boolean; count: number; resetTime: Date }> {
    const rateLimitKey = this.getRateLimitKey(key);
    const now = Date.now();
    const resetTime = now + windowMs;

    // Handle zero max requests case
    if (maxRequests <= 0) {
      return {
        allowed: false,
        count: 0,
        resetTime: new Date(resetTime),
      };
    }

    const pipeline = this.redis.pipeline();
    pipeline.hincrby(rateLimitKey, 'count', 1);
    pipeline.hsetnx(rateLimitKey, 'resetTime', resetTime);
    pipeline.expire(rateLimitKey, Math.ceil(windowMs / 1000));
    
    const results = await pipeline.exec();
    
    if (results && results[0] && !results[0][0]) {
      const count = results[0][1] as number;
      const allowed = count <= maxRequests;
      
      return {
        allowed,
        count,
        resetTime: new Date(resetTime),
      };
    }

    return {
      allowed: false,
      count: 0,
      resetTime: new Date(resetTime),
    };
  }

  async hasActiveTaskInChain(chainId: string): Promise<boolean> {
    const chainKey = this.getChainKey(chainId);
    const taskIds = await this.redis.zrange(chainKey, 0, -1);
    
    if (taskIds.length === 0) return false;

    const pipeline = this.redis.pipeline();
    taskIds.forEach(id => pipeline.get(this.getTaskKey(id)));
    const results = await pipeline.exec();

    if (results) {
      for (const [error, result] of results) {
        if (!error && result) {
          try {
            const task: ITask = JSON.parse(result as string);
            if (task.status === TaskStatus.ACTIVE) {
              return true;
            }
          } catch (e) {
            // Skip invalid JSON
          }
        }
      }
    }

    return false;
  }

  async getNextChainIndex(chainId: string): Promise<number> {
    const chainKey = this.getChainKey(chainId);
    const result = await this.redis.zrevrange(chainKey, 0, 0, 'WITHSCORES');
    
    if (result.length === 0) return 0;
    
    return parseInt(result[1]) + 1;
  }

  async cleanup(options?: {
    olderThan?: Date;
    statuses?: TaskStatus[];
    removeCompleted?: boolean;
    removeFailed?: boolean;
  }): Promise<number> {
    const tasks = await this.getTasks();
    let deletedCount = 0;

    for (const task of tasks) {
      let shouldDelete = false;

      // Check age
      if (options?.olderThan && new Date(task.createdAt) < options.olderThan) {
        shouldDelete = true;
      }

      // Check status
      if (options?.statuses && options.statuses.includes(task.status)) {
        shouldDelete = true;
      }

      // Check completion flag
      if (options?.removeCompleted && task.status === TaskStatus.COMPLETED) {
        shouldDelete = true;
      }

      // Check failure flag
      if (options?.removeFailed && task.status === TaskStatus.FAILED) {
        shouldDelete = true;
      }

      if (shouldDelete) {
        await this.deleteTask(task.id);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  async close(): Promise<void> {
    if (this.redis) {
      try {
        await this.redis.quit();
      } catch (error) {
        // Ignore connection errors during shutdown and force disconnect
        try {
          this.redis.disconnect();
        } catch {
          // Ignore any errors during disconnect
        }
      }
    }
  }

  /**
   * Clear all tasks - for testing purposes only
   */
  private async clearAllTasks(): Promise<void> {
    if (this.redis) {
      // Delete all keys with our prefix
      const keys = await this.redis.keys(`${this.keyPrefix}*`);
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    }
  }
}
