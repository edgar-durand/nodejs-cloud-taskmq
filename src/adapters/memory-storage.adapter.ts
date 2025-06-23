import { IStateStorageAdapter, ITask, TaskStatus, TaskQueryOptions } from '../interfaces/storage-adapter.interface';

/**
 * In-memory storage adapter for development and testing
 */
export class MemoryStorageAdapter implements IStateStorageAdapter {
  private tasks: Map<string, ITask> = new Map();
  private uniquenessKeys: Map<string, { taskId: string; expiresAt: Date }> = new Map();
  private rateLimit: Map<string, { count: number; resetTime: Date }> = new Map();
  private rateLimitLocks: Map<string, Promise<{ allowed: boolean; count: number; resetTime: Date }>> = new Map();

  async initialize(): Promise<void> {
    // Memory storage doesn't need initialization
  }

  async saveTask(task: ITask): Promise<void> {
    this.tasks.set(task.id, { ...task });
  }

  async getTask(taskId: string): Promise<ITask | null> {
    const task = this.tasks.get(taskId);
    return task ? { ...task } : null;
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, updateData?: Partial<ITask>): Promise<void> {
    const task = this.tasks.get(taskId);
    if (task) {
      const updatedTask = {
        ...task,
        status,
        updatedAt: new Date(),
        ...updateData,
      };
      this.tasks.set(taskId, updatedTask);
    }
  }

  async deleteTask(taskId: string): Promise<boolean> {
    const existed = this.tasks.has(taskId);
    this.tasks.delete(taskId);
    return existed;
  }

  async getTasks(options?: TaskQueryOptions): Promise<ITask[]> {
    let tasks = Array.from(this.tasks.values());

    // Apply filters
    if (options?.status) {
      const statuses = Array.isArray(options.status) ? options.status : [options.status];
      tasks = tasks.filter(task => statuses.includes(task.status as TaskStatus));
    }

    if (options?.queueName) {
      tasks = tasks.filter(task => task.queueName === options.queueName);
    }

    if (options?.chainId) {
      tasks = tasks.filter(task => task.chain?.id === options.chainId);
    }

    if (options?.uniquenessKey) {
      tasks = tasks.filter(task => task.uniquenessKey === options.uniquenessKey);
    }

    if (options?.dateRange) {
      if (options.dateRange.from) {
        tasks = tasks.filter(task => task.createdAt >= options.dateRange!.from!);
      }
      if (options.dateRange.to) {
        tasks = tasks.filter(task => task.createdAt <= options.dateRange!.to!);
      }
    }

    // Apply sorting
    if (options?.sort) {
      tasks.sort((a, b) => {
        const aValue = (a as any)[options.sort!.field];
        const bValue = (b as any)[options.sort!.field];
        
        if (aValue < bValue) return options.sort!.order === 'asc' ? -1 : 1;
        if (aValue > bValue) return options.sort!.order === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply pagination
    if (options?.offset) {
      tasks = tasks.slice(options.offset);
    }
    if (options?.limit) {
      tasks = tasks.slice(0, options.limit);
    }

    return tasks.map(task => ({ ...task }));
  }

  async getTaskCount(options?: TaskQueryOptions): Promise<number> {
    const tasks = await this.getTasks(options);
    return tasks.length;
  }

  async hasUniquenessKey(key: string): Promise<boolean> {
    const entry = this.uniquenessKeys.get(key);
    if (!entry) return false;
    
    const now = new Date();
    if (entry.expiresAt < now) {
      this.uniquenessKeys.delete(key);
      return false;
    }
    return true;
  }

  async addUniquenessKey(key: string, taskId: string, ttlSeconds: number = 86400): Promise<boolean> {
    if (await this.hasUniquenessKey(key)) {
      return false;
    }
    
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    this.uniquenessKeys.set(key, { taskId, expiresAt });
    return true;
  }

  async getUniquenessKeyInfo(key: string): Promise<{ taskId: string; expiresAt: Date } | null> {
    const entry = this.uniquenessKeys.get(key);
    if (!entry) return null;
    
    const now = new Date();
    if (entry.expiresAt < now) {
      this.uniquenessKeys.delete(key);
      return null;
    }
    return entry;
  }

  async removeUniquenessKey(key: string): Promise<void> {
    this.uniquenessKeys.delete(key);
  }

  async isUniquenessKeyActive(key: string): Promise<boolean> {
    return this.hasUniquenessKey(key);
  }

  async setUniquenessKeyActive(key: string, taskId: string, ttlSeconds: number = 86400): Promise<void> {
    await this.addUniquenessKey(key, taskId, ttlSeconds);
  }

  async incrementRateLimit(key: string, windowMs: number, maxRequests: number): Promise<{ allowed: boolean; count: number; resetTime: Date }> {
    // Wait for any existing operation to complete
    while (this.rateLimitLocks.has(key)) {
      await this.rateLimitLocks.get(key);
    }

    // Create and execute the operation
    const operationPromise = this._doIncrementRateLimit(key, windowMs, maxRequests);
    this.rateLimitLocks.set(key, operationPromise);

    try {
      const result = await operationPromise;
      return result;
    } finally {
      this.rateLimitLocks.delete(key);
    }
  }

  private async _doIncrementRateLimit(key: string, windowMs: number, maxRequests: number): Promise<{ allowed: boolean; count: number; resetTime: Date }> {
    const now = Date.now();
    let entry = this.rateLimit.get(key);

    // Clean up expired entries
    if (entry && entry.resetTime.getTime() <= now) {
      this.rateLimit.delete(key);
      entry = undefined;
    }

    // Handle zero max requests case
    if (maxRequests <= 0) {
      const resetTime = new Date(now + windowMs);
      return { allowed: false, count: 0, resetTime };
    }

    if (!entry) {
      // Create new rate limit window
      const resetTime = new Date(now + windowMs);
      this.rateLimit.set(key, {
        count: 1,
        resetTime,
      });
      return { allowed: true, count: 1, resetTime };
    }

    // Check if we can increment
    if (entry.count >= maxRequests) {
      return { allowed: false, count: entry.count, resetTime: entry.resetTime };
    }

    entry.count++;
    return { allowed: true, count: entry.count, resetTime: entry.resetTime };
  }

  async getRateLimit(key: string): Promise<{ count: number; resetTime: Date } | null> {
    const entry = this.rateLimit.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.resetTime < new Date()) {
      this.rateLimit.delete(key);
      return null;
    }

    return { ...entry };
  }

  async deleteRateLimit(key: string): Promise<void> {
    this.rateLimit.delete(key);
  }

  /**
   * Check if there are active tasks in chain
   */
  async hasActiveTaskInChain(chainId: string): Promise<boolean> {
    const tasks = Array.from(this.tasks.values());
    return tasks.some(task => 
      task.chain?.id === chainId && 
      (task.status === TaskStatus.ACTIVE || task.status === TaskStatus.IDLE)
    );
  }

  async getNextChainIndex(chainId: string): Promise<number> {
    const tasks = Array.from(this.tasks.values());
    const chainTasks = tasks.filter(task => task.chain?.id === chainId);
    
    if (chainTasks.length === 0) return 0;
    
    const maxIndex = Math.max(...chainTasks.map(task => task.chain?.index || 0));
    return maxIndex + 1;
  }

  async cleanup(options?: {
    olderThan?: Date;
    statuses?: TaskStatus[];
    removeCompleted?: boolean;
    removeFailed?: boolean;
  }): Promise<number> {
    let deletedCount = 0;
    const tasksToDelete: string[] = [];

    for (const [taskId, task] of this.tasks.entries()) {
      let shouldDelete = false;

      // For removeCompleted flag
      if (options?.removeCompleted && task.status === TaskStatus.COMPLETED) {
        // If olderThan is specified, task must be old enough
        if (!options?.olderThan || task.createdAt < options.olderThan) {
          shouldDelete = true;
        }
      }

      // For removeFailed flag
      if (options?.removeFailed && task.status === TaskStatus.FAILED) {
        // If olderThan is specified, task must be old enough
        if (!options?.olderThan || task.createdAt < options.olderThan) {
          shouldDelete = true;
        }
      }

      // For specific statuses (this is independent)
      if (options?.statuses && options.statuses.includes(task.status as TaskStatus)) {
        // If olderThan is specified, task must be old enough
        if (!options?.olderThan || task.createdAt < options.olderThan) {
          shouldDelete = true;
        }
      }

      // If only olderThan is specified (no status filters)
      if (options?.olderThan && 
          !options?.removeCompleted && 
          !options?.removeFailed && 
          !options?.statuses) {
        if (task.createdAt < options.olderThan) {
          shouldDelete = true;
        }
      }

      if (shouldDelete) {
        tasksToDelete.push(taskId);
      }
    }

    // Delete tasks
    for (const taskId of tasksToDelete) {
      this.tasks.delete(taskId);
      deletedCount++;
    }

    // Clean up expired uniqueness keys
    const now = new Date();
    for (const [key, entry] of this.uniquenessKeys.entries()) {
      if (entry.expiresAt < now) {
        this.uniquenessKeys.delete(key);
      }
    }

    // Clean up expired rate limits
    for (const [key, entry] of this.rateLimit.entries()) {
      if (entry.resetTime < now) {
        this.rateLimit.delete(key);
      }
    }

    return deletedCount;
  }

  async close(): Promise<void> {
    this.tasks.clear();
    this.uniquenessKeys.clear();
    this.rateLimit.clear();
  }

  /**
   * Get all tasks in a chain
   */
  async getChainTasks(chainId: string): Promise<ITask[]> {
    return Array.from(this.tasks.values())
      .filter(task => task.chain?.id === chainId)
      .sort((a, b) => (a.chain?.index ?? 0) - (b.chain?.index ?? 0));
  }

  /**
   * Get the next task in a chain after the current step
   */
  async getNextTaskInChain(chainId: string, currentStep: number): Promise<ITask | null> {
    const chainTasks = await this.getChainTasks(chainId);
    return chainTasks.find(task => (task.chain?.index ?? 0) === currentStep + 1) || null;
  }

  /**
   * Create a new task (alias for saveTask)
   */
  async createTask(task: ITask): Promise<ITask> {
    await this.saveTask(task);
    return task;
  }
}
