import { IStateStorageAdapter, ITask, TaskStatus, TaskQueryOptions } from '../interfaces/storage-adapter.interface';

// Optional dependency - only imported if available
let mongoose: any;
try {
  mongoose = require('mongoose');
} catch (error) {
  // Mongoose not available
}

/**
 * MongoDB storage adapter options
 */
export interface MongoStorageOptions {
  uri: string;
  collectionName?: string;
  options?: any;
}

/**
 * MongoDB storage adapter
 */
export class MongoStorageAdapter implements IStateStorageAdapter {
  private connection: any;
  private TaskModel: any;
  private UniquenessModel: any;
  private RateLimitModel: any;
  private collectionName: string;

  constructor(private options: MongoStorageOptions) {
    if (!mongoose) {
      throw new Error('Mongoose is required for MongoStorageAdapter. Please install mongoose as a dependency.');
    }
    this.collectionName = options.collectionName || 'cloud_taskmq_tasks';
  }

  async initialize(): Promise<void> {
    // Connect to MongoDB
    this.connection = await mongoose.createConnection(this.options.uri, this.options.options);

    // Define schemas
    const taskSchema = new mongoose.Schema({
      _id: { type: String, required: true },
      queueName: { type: String, required: true, index: true },
      data: { type: mongoose.Schema.Types.Mixed, required: true },
      status: { type: String, enum: Object.values(TaskStatus), required: true, index: true },
      createdAt: { type: Date, required: true, index: true },
      updatedAt: { type: Date, required: true },
      completedAt: { type: Date },
      failedAt: { type: Date },
      attempts: { type: Number, default: 0 },
      maxAttempts: { type: Number, default: 3 },
      error: {
        message: String,
        stack: String,
        timestamp: Date,
      },
      progress: {
        percentage: Number,
        data: mongoose.Schema.Types.Mixed,
      },
      result: mongoose.Schema.Types.Mixed,
      delay: Number,
      scheduledFor: Date,
      chain: {
        id: { type: String, index: true },
        index: Number,
        total: Number,
      },
      uniquenessKey: { type: String, index: true },
      options: mongoose.Schema.Types.Mixed,
    }, {
      _id: false,
      timestamps: false,
    });

    const uniquenessSchema = new mongoose.Schema({
      _id: { type: String, required: true },
      taskId: { type: String, required: true },
      expiresAt: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    }, {
      _id: false,
      timestamps: false,
    });

    const rateLimitSchema = new mongoose.Schema({
      _id: { type: String, required: true },
      count: { type: Number, required: true },
      resetTime: { type: Date, required: true, index: { expireAfterSeconds: 0 } },
    }, {
      _id: false,
      timestamps: false,
    });

    // Create indexes
    taskSchema.index({ queueName: 1, status: 1 });
    taskSchema.index({ 'chain.id': 1, 'chain.index': 1 });
    taskSchema.index({ createdAt: 1 });

    this.TaskModel = this.connection.model('Task', taskSchema, this.collectionName);
    this.UniquenessModel = this.connection.model('Uniqueness', uniquenessSchema, `${this.collectionName}_uniqueness`);
    this.RateLimitModel = this.connection.model('RateLimit', rateLimitSchema, `${this.collectionName}_ratelimit`);
  }

  async saveTask(task: ITask): Promise<void> {
    const doc = {
      _id: task.id,
      ...task,
    };
    await this.TaskModel.findByIdAndUpdate(task.id, doc, { upsert: true });
  }

  async getTask(taskId: string): Promise<ITask | null> {
    const doc = await this.TaskModel.findById(taskId).lean();
    if (!doc) return null;

    const { _id, __v, ...task } = doc;
    return {
      ...task,
      id: _id,
    };
  }

  async updateTaskStatus(taskId: string, status: TaskStatus, updateData?: Partial<ITask>): Promise<void> {
    const updateDoc = {
      status,
      updatedAt: new Date(),
      ...updateData,
    };
    await this.TaskModel.findByIdAndUpdate(taskId, updateDoc);
  }

  /**
   * Delete a task
   */
  async deleteTask(taskId: string): Promise<boolean> {
    const result = await this.TaskModel.deleteOne({ _id: taskId });
    return result.deletedCount > 0;
  }

  async getTasks(options?: TaskQueryOptions): Promise<ITask[]> {
    const query: any = {};
    
    // Apply filters
    if (options?.status) {
      if (Array.isArray(options.status)) {
        query.status = { $in: options.status };
      } else {
        query.status = options.status;
      }
    }

    if (options?.queueName) {
      query.queueName = options.queueName;
    }

    if (options?.chainId) {
      query['chain.id'] = options.chainId;
    }

    if (options?.uniquenessKey) {
      query.uniquenessKey = options.uniquenessKey;
    }

    if (options?.dateRange) {
      const dateFilter: any = {};
      if (options.dateRange.from) {
        dateFilter.$gte = options.dateRange.from;
      }
      if (options.dateRange.to) {
        dateFilter.$lte = options.dateRange.to;
      }
      if (Object.keys(dateFilter).length > 0) {
        query.createdAt = dateFilter;
      }
    }

    let mongoQuery = this.TaskModel.find(query).lean();

    // Apply sorting
    if (options?.sort) {
      const sortOrder = options.sort.order === 'desc' ? -1 : 1;
      mongoQuery = mongoQuery.sort({ [options.sort.field]: sortOrder });
    }

    // Apply pagination
    if (options?.offset) {
      mongoQuery = mongoQuery.skip(options.offset);
    }
    if (options?.limit) {
      mongoQuery = mongoQuery.limit(options.limit);
    }

    const docs = await mongoQuery.exec();
    return docs.map((doc: any) => {
      const { _id, __v, ...task } = doc;
      return {
        ...task,
        id: _id,
      };
    });
  }

  async getTaskCount(options?: TaskQueryOptions): Promise<number> {
    const query: any = {};
    
    // Apply same filters as getTasks
    if (options?.status) {
      if (Array.isArray(options.status)) {
        query.status = { $in: options.status };
      } else {
        query.status = options.status;
      }
    }

    if (options?.queueName) {
      query.queueName = options.queueName;
    }

    if (options?.chainId) {
      query['chain.id'] = options.chainId;
    }

    if (options?.uniquenessKey) {
      query.uniquenessKey = options.uniquenessKey;
    }

    if (options?.dateRange) {
      const dateFilter: any = {};
      if (options.dateRange.from) {
        dateFilter.$gte = options.dateRange.from;
      }
      if (options.dateRange.to) {
        dateFilter.$lte = options.dateRange.to;
      }
      if (Object.keys(dateFilter).length > 0) {
        query.createdAt = dateFilter;
      }
    }

    return await this.TaskModel.countDocuments(query);
  }

  async isUniquenessKeyActive(key: string): Promise<boolean> {
    const doc = await this.UniquenessModel.findById(key).lean();
    return !!doc;
  }

  async setUniquenessKeyActive(key: string, taskId: string, ttlSeconds: number = 86400): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.UniquenessModel.findByIdAndUpdate(
      key,
      { _id: key, taskId, expiresAt },
      { upsert: true }
    );
  }

  async removeUniquenessKey(key: string): Promise<void> {
    await this.UniquenessModel.findByIdAndDelete(key);
  }

  async getRateLimit(key: string): Promise<{ count: number; resetTime: Date } | null> {
    const doc = await this.RateLimitModel.findById(key).lean();
    if (!doc) return null;

    return {
      count: doc.count,
      resetTime: doc.resetTime,
    };
  }

  async incrementRateLimit(key: string, windowMs: number, maxRequests: number): Promise<{ allowed: boolean; count: number; resetTime: Date }> {
    const now = new Date();
    const resetTime = new Date(now.getTime() + windowMs);

    // Handle zero max requests case
    if (maxRequests <= 0) {
      return {
        allowed: false,
        count: 0,
        resetTime,
      };
    }

    try {
      // First, try to reset any expired windows
      await this.RateLimitModel.updateMany(
        { 
          resetTime: { $lt: now }  // Window has expired
        },
        { 
          count: 0,  // Reset count to 0
          resetTime   // Update reset time
        }
      );

      // Now try to atomically increment the counter
      const result = await this.RateLimitModel.findOneAndUpdate(
        { _id: key },
        { 
          $inc: { count: 1 },
          $setOnInsert: { resetTime }
        },
        { 
          upsert: true,
          new: true,
          setDefaultsOnInsert: true
        }
      );

      const allowed = result.count <= maxRequests;

      return {
        allowed,
        count: result.count,
        resetTime: result.resetTime,
      };
    } catch (error) {
      console.error('Error in incrementRateLimit:', error);
      // Fallback: deny the request on error
      return {
        allowed: false,
        count: 0,
        resetTime,
      };
    }
  }

  async deleteRateLimit(key: string): Promise<void> {
    try {
      await this.RateLimitModel.deleteOne({ _id: key });
    } catch (error) {
      console.error('Error in deleteRateLimit:', error);
    }
  }

  async hasActiveTaskInChain(chainId: string): Promise<boolean> {
    const count = await this.TaskModel.countDocuments({
      'chain.id': chainId,
      status: TaskStatus.ACTIVE,
    });
    return count > 0;
  }

  async getNextChainIndex(chainId: string): Promise<number> {
    const result = await this.TaskModel
      .findOne({ 'chain.id': chainId })
      .sort({ 'chain.index': -1 })
      .select('chain.index')
      .lean();
    
    return result ? result.chain.index + 1 : 0;
  }

  async cleanup(options?: {
    olderThan?: Date;
    statuses?: TaskStatus[];
    removeCompleted?: boolean;
    removeFailed?: boolean;
  }): Promise<number> {
    const query: any = {};

    if (options?.olderThan) {
      query.createdAt = { $lt: options.olderThan };
    }

    if (options?.statuses) {
      query.status = { $in: options.statuses };
    }

    if (options?.removeCompleted) {
      if (query.status) {
        query.status.$in.push(TaskStatus.COMPLETED);
      } else {
        query.status = TaskStatus.COMPLETED;
      }
    }

    if (options?.removeFailed) {
      if (query.status) {
        if (Array.isArray(query.status.$in)) {
          query.status.$in.push(TaskStatus.FAILED);
        } else {
          query.status = { $in: [query.status, TaskStatus.FAILED] };
        }
      } else {
        query.status = TaskStatus.FAILED;
      }
    }

    const result = await this.TaskModel.deleteMany(query);
    return result.deletedCount || 0;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }

  /**
   * Clear all tasks - for testing purposes only
   */
  private async clearAllTasks(): Promise<void> {
    if (this.TaskModel) {
      await this.TaskModel.deleteMany({});
    }
    if (this.UniquenessModel) {
      await this.UniquenessModel.deleteMany({});
    }
    if (this.RateLimitModel) {
      await this.RateLimitModel.deleteMany({});
    }
  }

  /**
   * Get all tasks in a chain
   */
  async getChainTasks(chainId: string): Promise<ITask[]> {
    const docs = await this.TaskModel
      .find({ 'chain.id': chainId })
      .sort({ 'chain.index': 1 })
      .lean();
    
    return docs.map((doc: any) => {
      const { _id, __v, ...task } = doc;
      return {
        ...task,
        id: _id,
      };
    });
  }

  /**
   * Get the next task in a chain after the current step
   */
  async getNextTaskInChain(chainId: string, currentStep: number): Promise<ITask | null> {
    const doc = await this.TaskModel
      .findOne({
        'chain.id': chainId,
        'chain.index': currentStep + 1
      })
      .lean();
    
    return doc ? {
      ...doc,
      id: doc._id,
    } : null;
  }

  /**
   * Create a new task (alias for saveTask)
   */
  async createTask(task: ITask): Promise<ITask> {
    const doc = await this.TaskModel.create(task);
    const { _id, __v, ...cleanTask } = doc.toObject();
    return {
      ...cleanTask,
      id: _id,
    };
  }
}
