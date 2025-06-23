import { CloudTaskMQConfig, StorageOptions } from './interfaces/config.interface';
import { IStateStorageAdapter } from './interfaces/storage-adapter.interface';
import { ProducerService } from './services/producer.service';
import { ConsumerService } from './services/consumer.service';
import { RateLimiterService } from './services/rate-limiter.service';
import { MemoryStorageAdapter } from './adapters/memory-storage.adapter';
import { RedisStorageAdapter } from './adapters/redis-storage.adapter';
import { MongoStorageAdapter } from './adapters/mongo-storage.adapter';
import { EventEmitter } from 'events';

/**
 * Main CloudTaskMQ class
 */
export class CloudTaskMQ extends EventEmitter {
  private storageAdapter: IStateStorageAdapter;
  private producerService: ProducerService;
  private consumerService: ConsumerService;
  private rateLimiterService: RateLimiterService;
  private initialized = false;

  constructor(private readonly config: CloudTaskMQConfig) {
    super();
    this.storageAdapter = this.createStorageAdapter();
    this.producerService = new ProducerService(config, this.storageAdapter);
    this.consumerService = new ConsumerService(config, this.storageAdapter);
    this.rateLimiterService = new RateLimiterService(this.storageAdapter);

    // Forward events
    this.producerService.on('taskAdded', (event) => this.emit('taskAdded', event));
    this.consumerService.on('taskActive', (event) => this.emit('taskActive', event));
    this.consumerService.on('taskCompleted', (event) => this.emit('taskCompleted', event));
    this.consumerService.on('taskFailed', (event) => this.emit('taskFailed', event));
    this.consumerService.on('taskProgress', (event) => this.emit('taskProgress', event));
  }

  /**
   * Initialize CloudTaskMQ
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.storageAdapter.initialize();
      await this.producerService.initialize();
      await this.consumerService.initialize();
      
      this.initialized = true;
      this.emit('initialized');
    } catch (error) {
      this.emit('error', error);
      throw error;
    }
  }

  /**
   * Get producer service
   */
  getProducer(): ProducerService {
    return this.producerService;
  }

  /**
   * Get consumer service
   */
  getConsumer(): ConsumerService {
    return this.consumerService;
  }

  /**
   * Get rate limiter service
   */
  getRateLimiter(): RateLimiterService {
    return this.rateLimiterService;
  }

  /**
   * Get storage adapter
   */
  getStorageAdapter(): IStateStorageAdapter {
    return this.storageAdapter;
  }

  /**
   * Register a processor
   */
  registerProcessor(processor: any): void {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before registering processors');
    }
    this.consumerService.registerProcessor(processor);
  }

  /**
   * Process a task (called by HTTP endpoints)
   */
  async processTask(payload: {
    taskId: string;
    queueName: string;
    data: any;
    attempts: number;
    maxAttempts: number;
    chain?: { id: string; index: number; total: number };
    uniquenessKey?: string;
  }): Promise<any> {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before processing tasks');
    }
    return await this.consumerService.processTask(payload);
  }

  /**
   * Add a task to a queue
   */
  async addTask<T = any>(
    queueName: string,
    data: T,
    options?: import('./interfaces/task.interface').AddTaskOptions,
  ): Promise<import('./interfaces/task.interface').AddTaskResult> {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before adding tasks');
    }
    return await this.producerService.addTask(queueName, data, options);
  }

  /**
   * Add a chain of tasks
   */
  async addChain<T = any>(
    queueName: string,
    tasks: Array<{ data: T; options?: import('./interfaces/task.interface').AddTaskOptions }>,
    chainOptions?: { id?: string; waitForPrevious?: boolean },
  ): Promise<import('./interfaces/task.interface').AddTaskResult[]> {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before adding task chains');
    }
    return await this.producerService.addChain(queueName, tasks, chainOptions);
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<import('./interfaces/storage-adapter.interface').ITask | null> {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before getting tasks');
    }
    return await this.storageAdapter.getTask(taskId);
  }

  /**
   * Get tasks with filtering options
   */
  async getTasks(
    options?: import('./interfaces/storage-adapter.interface').TaskQueryOptions,
  ): Promise<import('./interfaces/storage-adapter.interface').ITask[]> {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before getting tasks');
    }
    return await this.storageAdapter.getTasks(options);
  }

  /**
   * Get task count
   */
  async getTaskCount(
    options?: import('./interfaces/storage-adapter.interface').TaskQueryOptions,
  ): Promise<number> {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before getting task count');
    }
    return await this.storageAdapter.getTaskCount(options);
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(
    taskId: string,
    progress: import('./interfaces/task.interface').TaskProgress,
  ): Promise<void> {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before updating task progress');
    }
    return await this.consumerService.updateTaskProgress(taskId, progress);
  }

  /**
   * Clean up old tasks
   */
  async cleanup(options?: {
    olderThan?: Date;
    statuses?: import('./interfaces/storage-adapter.interface').TaskStatus[];
    removeCompleted?: boolean;
    removeFailed?: boolean;
  }): Promise<number> {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before cleanup');
    }
    return await this.storageAdapter.cleanup(options);
  }

  /**
   * Check rate limit
   */
  async checkRateLimit(
    key: string,
    options: import('./interfaces/config.interface').RateLimiterOptions,
  ): Promise<import('./services/rate-limiter.service').RateLimitResult> {
    if (!this.initialized) {
      throw new Error('CloudTaskMQ must be initialized before checking rate limits');
    }
    return await this.rateLimiterService.checkRateLimit(key, options);
  }

  /**
   * Get configuration
   */
  getConfig(): CloudTaskMQConfig {
    return { ...this.config };
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Close CloudTaskMQ and clean up resources
   */
  async close(): Promise<void> {
    if (!this.initialized) return;
    
    try {
      await this.producerService.close();
      await this.consumerService.close();
      await this.storageAdapter.close();
      
      this.initialized = false;
      this.removeAllListeners();
      this.emit('closed');
    } catch (error) {
      // Try to clean up what we can even if some parts fail
      this.initialized = false;
      this.removeAllListeners();
      
      // Only throw if it's not a connection-related error during shutdown
      if (error instanceof Error && !error.message.includes('Connection is closed')) {
        this.emit('error', error);
        throw error;
      }
    }
  }

  /**
   * Create storage adapter based on configuration
   */
  private createStorageAdapter(): IStateStorageAdapter {
    const { storageAdapter, storageOptions = {} } = this.config;

    switch (storageAdapter) {
      case 'memory':
        return new MemoryStorageAdapter();

      case 'redis':
        if (!storageOptions.redis) {
          throw new Error('Redis storage options are required when using Redis adapter');
        }
        return new RedisStorageAdapter(storageOptions.redis);

      case 'mongo':
        if (!storageOptions.mongo) {
          throw new Error('MongoDB storage options are required when using MongoDB adapter');
        }
        return new MongoStorageAdapter(storageOptions.mongo);

      case 'custom':
        if (!storageOptions.customAdapter) {
          throw new Error('Custom storage adapter instance is required when using custom adapter');
        }
        return storageOptions.customAdapter;

      default:
        throw new Error(`Unsupported storage adapter: ${storageAdapter}`);
    }
  }

  /**
   * Create CloudTaskMQ instance with async configuration
   */
  static async create(
    configFactory: () => Promise<CloudTaskMQConfig> | CloudTaskMQConfig,
  ): Promise<CloudTaskMQ> {
    const config = await configFactory();
    const instance = new CloudTaskMQ(config);
    await instance.initialize();
    return instance;
  }
}
