import { IStateStorageAdapter } from './storage-adapter.interface';

/**
 * Queue configuration interface
 */
export interface QueueConfig {
  /**
   * Queue name used in the application
   */
  name: string;

  /**
   * Full path to the queue in Google Cloud Tasks
   * Format: projects/{project}/locations/{location}/queues/{queue}
   */
  path: string;

  /**
   * Service account email for this queue (optional)
   */
  serviceAccountEmail?: string;

  /**
   * Custom processor URL for this queue (optional)
   */
  processorUrl?: string;

  /**
   * Rate limiting configuration
   */
  rateLimiter?: RateLimiterOptions;

  /**
   * Maximum number of retries for failed tasks
   */
  maxRetries?: number;

  /**
   * Retry delay in seconds
   */
  retryDelay?: number;
}

/**
 * Rate limiter options
 */
export interface RateLimiterOptions {
  /**
   * Maximum number of requests per window
   */
  maxRequests: number;

  /**
   * Time window in seconds
   */
  windowMs: number;

  /**
   * Key to use for rate limiting (optional)
   */
  key?: string;
}

/**
 * Storage options for different adapters
 */
export interface StorageOptions {
  /**
   * MongoDB connection options
   */
  mongo?: {
    uri: string;
    collectionName?: string;
    options?: any;
  };

  /**
   * Redis connection options
   */
  redis?: {
    host?: string;
    port?: number;
    password?: string;
    url?: string;
    keyPrefix?: string;
    options?: any;
  };

  /**
   * Custom storage adapter instance
   */
  customAdapter?: IStateStorageAdapter;
}

/**
 * Main configuration interface for CloudTaskMQ
 */
export interface CloudTaskMQConfig {
  /**
   * Google Cloud Project ID
   */
  projectId: string;

  /**
   * Google Cloud location/region
   */
  location: string;

  /**
   * Default processor URL
   */
  defaultProcessorUrl?: string;

  /**
   * Queue configurations
   */
  queues: QueueConfig[];

  /**
   * Storage adapter type
   */
  storageAdapter: 'mongo' | 'redis' | 'memory' | 'custom';

  /**
   * Storage configuration options
   */
  storageOptions?: StorageOptions;

  /**
   * Auto create queues if they don't exist
   */
  autoCreateQueues?: boolean;

  /**
   * Global rate limiter options
   */
  globalRateLimiter?: RateLimiterOptions;

  /**
   * Google Cloud authentication options
   */
  auth?: {
    keyFilename?: string;
    credentials?: any;
  };

  /**
   * HTTP server options for task processing
   */
  serverOptions?: {
    port?: number;
    host?: string;
    path?: string;
  };
}

/**
 * Async configuration factory
 */
export interface CloudTaskMQConfigFactory {
  createCloudTaskMQConfig(): Promise<CloudTaskMQConfig> | CloudTaskMQConfig;
}

/**
 * Async configuration options
 */
export interface CloudTaskMQAsyncConfig {
  useFactory?: (...args: any[]) => Promise<CloudTaskMQConfig> | CloudTaskMQConfig;
  inject?: any[];
}
