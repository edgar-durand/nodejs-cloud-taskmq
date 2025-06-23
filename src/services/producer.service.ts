import { CloudTasksClient } from '@google-cloud/tasks';
import { v4 as uuidv4 } from 'uuid';
import { google } from '@google-cloud/tasks/build/protos/protos';
import { IStateStorageAdapter, TaskStatus } from '../interfaces/storage-adapter.interface';
import { CloudTaskMQConfig, QueueConfig } from '../interfaces/config.interface';
import { AddTaskOptions, AddTaskResult, ITask } from '../interfaces/task.interface';
import { EventEmitter } from 'events';
import { RateLimiterService } from './rate-limiter.service';

/**
 * Producer service for adding tasks to queues
 */
export class ProducerService extends EventEmitter {
  private client: CloudTasksClient;
  private queueConfigs: Map<string, QueueConfig> = new Map();
  private projectId: string;
  private location: string;
  private defaultProcessorUrl?: string;
  private rateLimiterService: RateLimiterService;

  constructor(
    private readonly config: CloudTaskMQConfig,
    private readonly storageAdapter: IStateStorageAdapter,
  ) {
    super();
    this.client = new CloudTasksClient(this.config.auth);
    this.projectId = config.projectId;
    this.location = config.location;
    this.defaultProcessorUrl = config.defaultProcessorUrl;
    this.rateLimiterService = new RateLimiterService(this.storageAdapter);

    // Build queue configs map
    config.queues.forEach(queue => {
      this.queueConfigs.set(queue.name, queue);
    });
  }

  /**
   * Initialize the producer service
   */
  async initialize(): Promise<void> {
    // Create queues if auto-create is enabled
    if (this.config.autoCreateQueues) {
      await this.createMissingQueues();
    }
  }

  /**
   * Add a task to a queue
   */
  async addTask<T = any>(
    queueName: string,
    data: T,
    options: AddTaskOptions = {},
  ): Promise<AddTaskResult> {
    const queueConfig = this.queueConfigs.get(queueName);
    if (!queueConfig) {
      return {
        taskId: '',
        success: false,
        error: `Queue "${queueName}" not found in configuration`,
      };
    }

    // Check uniqueness key
    if (options.uniquenessKey) {
      const isActive = await this.storageAdapter.isUniquenessKeyActive(options.uniquenessKey);
      if (isActive) {
        return {
          taskId: '',
          success: false,
          skipped: true,
          error: `Task with uniqueness key "${options.uniquenessKey}" is already active`,
        };
      }
    }

    // Check rate limiting for the queue
    if (queueConfig.rateLimiter) {
      const rateLimitKey = RateLimiterService.createQueueKey(queueName);
      const rateLimitResult = await this.rateLimiterService.checkRateLimit(
        rateLimitKey,
        queueConfig.rateLimiter
      );

      if (!rateLimitResult.allowed) {
        return {
          taskId: '',
          success: false,
          error: `Rate limit exceeded for queue "${queueName}". Limit: ${queueConfig.rateLimiter.maxRequests} per ${queueConfig.rateLimiter.windowMs}ms`,
        };
      }
    }

    // Generate task ID
    const taskId = uuidv4();

    // Create task object
    const task: ITask = {
      id: taskId,
      queueName,
      data,
      status: TaskStatus.IDLE,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      maxAttempts: options.maxAttempts || queueConfig.maxRetries || 3,
      delay: options.delay,
      scheduledFor: options.delay ? new Date(Date.now() + options.delay * 1000) : undefined,
      chain: options.chain ? {
        id: options.chain.id,
        index: options.chain.index ?? 0,
        total: options.chain.total ?? 1,
      } : undefined,
      uniquenessKey: options.uniquenessKey,
      options: {
        removeOnComplete: options.removeOnComplete,
        removeOnFail: options.removeOnFail,
        priority: options.priority,
        ...options,
      },
    };

    try {
      // Save task to storage
      await this.storageAdapter.saveTask(task);

      // Set uniqueness key if provided
      if (options.uniquenessKey) {
        await this.storageAdapter.setUniquenessKeyActive(options.uniquenessKey, taskId);
      }

      // Create Cloud Task only if processor URL is available
      try {
        await this.createCloudTask(queueConfig, task);
      } catch (cloudTaskError) {
        // Log warning but don't fail the task creation - allow local processing
        console.warn(`Failed to create Cloud Task, but task saved locally: ${cloudTaskError instanceof Error ? cloudTaskError.message : String(cloudTaskError)}`);
      }

      this.emit('taskAdded', { taskId, queueName, data });

      return {
        taskId,
        success: true,
      };
    } catch (error) {
      // Clean up on error
      await this.storageAdapter.deleteTask(taskId);
      if (options.uniquenessKey) {
        await this.storageAdapter.removeUniquenessKey(options.uniquenessKey);
      }

      return {
        taskId, // Return the generated taskId even on error so task can still be processed locally
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Add multiple tasks as a chain
   */
  async addChain<T = any>(
    queueName: string,
    tasks: Array<{ data: T; options?: AddTaskOptions }>,
    chainOptions: { id?: string; waitForPrevious?: boolean } = {},
  ): Promise<AddTaskResult[]> {
    const chainId = chainOptions.id || uuidv4();
    const results: AddTaskResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      const taskData = tasks[i];
      const taskOptions: AddTaskOptions = {
        ...taskData.options,
        chain: {
          id: chainId,
          index: i,
          total: tasks.length,
          waitForPrevious: chainOptions.waitForPrevious,
        },
      };

      const result = await this.addTask(queueName, taskData.data, taskOptions);
      results.push(result);

      if (!result.success) {
        // Stop chain creation on first failure
        break;
      }
    }

    return results;
  }

  /**
   * Get queue configuration
   */
  getQueueConfig(queueName: string): QueueConfig | undefined {
    return this.queueConfigs.get(queueName);
  }

  /**
   * List all configured queues
   */
  getQueues(): string[] {
    return Array.from(this.queueConfigs.keys());
  }

  /**
   * Create missing queues in Google Cloud Tasks
   */
  private async createMissingQueues(): Promise<void> {
    const parent = `projects/${this.projectId}/locations/${this.location}`;

    for (const [queueName, queueConfig] of this.queueConfigs) {
      try {
        // Check if queue exists
        await this.client.getQueue({ name: queueConfig.path });
      } catch (error: any) {
        if (error.code === 5) { // NOT_FOUND
          try {
            // Create queue
            const queueId = queueConfig.path.split('/').pop();
            await this.client.createQueue({
              parent,
              queue: {
                name: queueConfig.path,
                rateLimits: queueConfig.rateLimiter ? {
                  maxDispatchesPerSecond: queueConfig.rateLimiter.maxRequests / (queueConfig.rateLimiter.windowMs / 1000),
                } : undefined,
                retryConfig: {
                  maxAttempts: queueConfig.maxRetries || 3,
                  maxRetryDuration: {
                    seconds: (queueConfig.retryDelay || 60) * (queueConfig.maxRetries || 3),
                  },
                },
              },
            });
            console.log(`Created queue: ${queueName}`);
          } catch (createError) {
            console.error(`Failed to create queue ${queueName}:`, createError);
          }
        }
      }
    }
  }

  /**
   * Create a Cloud Task
   */
  private async createCloudTask(queueConfig: QueueConfig, task: ITask): Promise<void> {
    const processorUrl = queueConfig.processorUrl || this.defaultProcessorUrl;
    if (!processorUrl) {
      throw new Error(`No processor URL configured for queue "${queueConfig.name}"`);
    }

    const payload = {
      taskId: task.id,
      queueName: task.queueName,
      data: task.data,
      attempts: task.attempts,
      maxAttempts: task.maxAttempts,
      chain: task.chain,
      uniquenessKey: task.uniquenessKey,
    };

    const taskRequest: google.cloud.tasks.v2.ICreateTaskRequest = {
      parent: queueConfig.path,
      task: {
        httpRequest: {
          httpMethod: 'POST',
          url: processorUrl,
          headers: {
            'Content-Type': 'application/json',
          },
          body: Buffer.from(JSON.stringify(payload)),
        },
      },
    };

    // Add delay if specified
    if (task.delay && task.delay > 0) {
      taskRequest.task!.scheduleTime = {
        seconds: Math.floor((Date.now() + task.delay * 1000) / 1000),
      };
    }

    // Add service account if configured
    if (queueConfig.serviceAccountEmail) {
      taskRequest.task!.httpRequest!.oidcToken = {
        serviceAccountEmail: queueConfig.serviceAccountEmail,
      };
    }

    await this.client.createTask(taskRequest);
  }

  /**
   * Close the producer service
   */
  async close(): Promise<void> {
    // Cloud Tasks client doesn't need explicit closing
    this.removeAllListeners();
  }
}
