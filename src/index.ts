// Main class
export { CloudTaskMQ } from './cloud-taskmq';

// Services
export { ProducerService } from './services/producer.service';
export { ConsumerService } from './services/consumer.service';
export { RateLimiterService } from './services/rate-limiter.service';

// Controllers
export { TaskController } from './controllers/task.controller';

// Decorators
export { Processor } from './decorators/processor.decorator';
export { Process } from './decorators/process.decorator';
export { 
  OnTaskActive,
  OnTaskCompleted,
  OnTaskFailed,
  OnTaskProgress,
} from './decorators/events.decorator';
export { CloudTaskConsumer } from './decorators/cloud-task-consumer.decorator';

// Models
export { CloudTask } from './models/cloud-task.model';

// Storage Adapters
export { MemoryStorageAdapter } from './adapters/memory-storage.adapter';
export { RedisStorageAdapter } from './adapters/redis-storage.adapter';
export { MongoStorageAdapter } from './adapters/mongo-storage.adapter';

// Interfaces - Configuration
export type {
  CloudTaskMQConfig,
  QueueConfig,
  RateLimiterOptions,
  StorageOptions,
} from './interfaces/config.interface';

// Interfaces - Storage
export type {
  IStateStorageAdapter,
  ITask,
  TaskStatus,
  TaskQueryOptions,
} from './interfaces/storage-adapter.interface';

// Interfaces - Task
export type {
  AddTaskOptions,
  AddTaskResult,
  TaskProgress,
  TaskCompletedEvent,
  TaskFailedEvent,
  TaskProgressEvent,
} from './interfaces/task.interface';

// Utilities
export * from './utils/metadata.utils';
export * from './utils/http.utils';

// Types for convenience
export type { ProcessorRegistration } from './services/consumer.service';
export type { RateLimitResult } from './services/rate-limiter.service';

// Import types for constants
import { TaskStatus } from './interfaces/storage-adapter.interface';
import { CloudTaskMQConfig } from './interfaces/config.interface';
import { CloudTaskMQ } from './cloud-taskmq';

// Constants
export const TASK_STATUSES = {
  IDLE: 'idle' as TaskStatus,
  ACTIVE: 'active' as TaskStatus,
  COMPLETED: 'completed' as TaskStatus,
  FAILED: 'failed' as TaskStatus,
  DELAYED: 'delayed' as TaskStatus,
  CANCELLED: 'cancelled' as TaskStatus,
} as const;

/**
 * Create a CloudTaskMQ instance with default configuration
 */
export function createCloudTaskMQ(config: Partial<CloudTaskMQConfig> = {}): CloudTaskMQ {
  const defaultConfig: CloudTaskMQConfig = {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || '',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    storageAdapter: 'memory',
    queues: config.queues || [{
      name: 'default',
      path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || 'demo-project'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || 'us-central1'}/queues/default`,
      rateLimiter: {
        maxRequests: 100,
        windowMs: 60000, // 1 minute
      },
    }],
    ...config,
  };

  return new CloudTaskMQ(defaultConfig);
}

/**
 * Create and initialize a CloudTaskMQ instance
 */
export async function createAndInitializeCloudTaskMQ(
  config: Partial<CloudTaskMQConfig> = {},
): Promise<CloudTaskMQ> {
  const instance = createCloudTaskMQ(config);
  await instance.initialize();
  return instance;
}

// Re-export reflect-metadata for convenience
import 'reflect-metadata';
