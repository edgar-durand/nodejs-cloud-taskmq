import { EventEmitter } from 'events';
import { IStateStorageAdapter, TaskStatus } from '../interfaces/storage-adapter.interface';
import { CloudTaskMQConfig } from '../interfaces/config.interface';
import { CloudTask } from '../models/cloud-task.model';
import { TaskCompletedEvent, TaskFailedEvent, TaskProgressEvent, TaskProgress } from '../interfaces/task.interface';
import {
  PROCESSOR_QUEUE_KEY,
  PROCESSOR_METADATA_KEY,
  ProcessorOptions,
} from '../decorators/processor.decorator';
import {
  PROCESS_METADATA_KEY,
} from '../decorators/process.decorator';
import {
  EVENT_HANDLERS_KEY,
  EventHandlerMetadata,
} from '../decorators/events.decorator';
import 'reflect-metadata';

/**
 * Processor registration information
 */
export interface ProcessorRegistration {
  instance: any;
  queueName: string;
  options: ProcessorOptions;
  processHandlers: Array<{
    methodName: string;
    name: string;
    concurrency?: number;
    handler: Function;
  }>;
  eventHandlers: EventHandlerMetadata[];
}

/**
 * Consumer service for processing tasks
 */
export class ConsumerService extends EventEmitter {
  private processors: Map<string, ProcessorRegistration[]> = new Map();
  private activeProcessors: Map<string, Set<string>> = new Map(); // queueName -> Set of taskIds

  constructor(
    private readonly config: CloudTaskMQConfig,
    private readonly storageAdapter: IStateStorageAdapter,
  ) {
    super();
  }

  /**
   * Initialize the consumer service
   */
  async initialize(): Promise<void> {
    // Consumer is initialized when processors are registered
  }

  /**
   * Register a processor instance
   */
  registerProcessor(instance: any): void {
    const queueName = Reflect.getMetadata(PROCESSOR_QUEUE_KEY, instance.constructor);
    if (!queueName) {
      throw new Error('Processor must be decorated with @Processor');
    }

    const options: ProcessorOptions = Reflect.getMetadata(PROCESSOR_METADATA_KEY, instance.constructor) || {};
    const processHandlers = Reflect.getMetadata(PROCESS_METADATA_KEY, instance) || [];
    const eventHandlers: EventHandlerMetadata[] = Reflect.getMetadata(EVENT_HANDLERS_KEY, instance) || [];

    if (processHandlers.length === 0) {
      throw new Error(`Processor for queue "${queueName}" must have at least one @Process decorated method`);
    }

    const registration: ProcessorRegistration = {
      instance,
      queueName,
      options,
      processHandlers,
      eventHandlers,
    };

    if (!this.processors.has(queueName)) {
      this.processors.set(queueName, []);
      this.activeProcessors.set(queueName, new Set());
    }

    this.processors.get(queueName)!.push(registration);
    
    console.log(`Registered processor for queue "${queueName}" with ${processHandlers.length} process handlers`);
  }

  /**
   * Process a task received from Cloud Tasks
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
    const { taskId, queueName } = payload;

    // Get task from storage
    let task = await this.storageAdapter.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found in storage`);
    }

    // Create CloudTask instance
    const cloudTask = new CloudTask(task);

    // Check if task is already being processed
    let activeProcessors = this.activeProcessors.get(queueName);
    if (!activeProcessors) {
      activeProcessors = new Set();
      this.activeProcessors.set(queueName, activeProcessors);
    }
    
    if (activeProcessors.has(taskId)) {
      throw new Error(`Task ${taskId} is already being processed`);
    }

    // Get processors for this queue
    const processors = this.processors.get(queueName);
    if (!processors || processors.length === 0) {
      throw new Error(`No processors registered for queue "${queueName}"`);
    }

    // Mark task as active
    cloudTask.markAsActive();
    await this.storageAdapter.updateTaskStatus(taskId, TaskStatus.ACTIVE, {
      updatedAt: cloudTask.updatedAt,
    });

    // Add to active processors
    activeProcessors.add(taskId);

    try {
      // Emit active event
      await this.emitTaskEvent('active', processors, cloudTask);
      
      // Emit taskActive event on main instance
      this.emit('taskActive', {
        taskId: cloudTask.id,
        queueName: cloudTask.queueName,
        data: cloudTask.data,
        timestamp: new Date(),
      });

      // Process the task
      const result = await this.executeTaskProcessing(processors, cloudTask);

      // Mark as completed
      cloudTask.markAsCompleted(result);
      await this.storageAdapter.updateTaskStatus(taskId, TaskStatus.COMPLETED, {
        result,
        completedAt: cloudTask.completedAt,
        updatedAt: cloudTask.updatedAt,
      });

      // Emit completed event
      const completedEvent: TaskCompletedEvent = {
        taskId: cloudTask.id,
        queueName: cloudTask.queueName,
        data: cloudTask.data,
        result,
        duration: cloudTask.getDuration() || 0,
        timestamp: new Date(),
      };
      await this.emitTaskEvent('completed', processors, cloudTask, result);
      this.emit('taskCompleted', completedEvent);

      // Handle chain progression
      if (cloudTask.isInChain() && !cloudTask.isLastInChain()) {
        await this.processNextInChain(cloudTask);
      }

      // Clean up if configured
      if (cloudTask.shouldRemoveOnComplete()) {
        await this.storageAdapter.deleteTask(taskId);
      }

      // Remove uniqueness key if configured
      if (cloudTask.uniquenessKey && cloudTask.shouldRemoveOnComplete()) {
        await this.storageAdapter.removeUniquenessKey(cloudTask.uniquenessKey);
      }

      return result;
    } catch (error) {
      // Handle task failure
      cloudTask.incrementAttempts();
      
      const isLastAttempt = cloudTask.hasExceededMaxAttempts();
      if (isLastAttempt) {
        cloudTask.markAsFailed(error instanceof Error ? error : new Error(String(error)));
        await this.storageAdapter.updateTaskStatus(taskId, TaskStatus.FAILED, {
          error: cloudTask.error,
          failedAt: cloudTask.failedAt,
          attempts: cloudTask.attempts,
          updatedAt: cloudTask.updatedAt,
        });

        // Clean up if configured
        if (cloudTask.shouldRemoveOnFail()) {
          await this.storageAdapter.deleteTask(taskId);
        }

        // Remove uniqueness key if configured
        if (cloudTask.uniquenessKey && cloudTask.shouldRemoveOnFail()) {
          await this.storageAdapter.removeUniquenessKey(cloudTask.uniquenessKey);
        }
      } else {
        // Update attempts but keep as idle for retry
        await this.storageAdapter.updateTaskStatus(taskId, TaskStatus.IDLE, {
          attempts: cloudTask.attempts,
          updatedAt: cloudTask.updatedAt,
        });
      }

      // Emit failed event only on final attempt
      if (isLastAttempt) {
        const failedEvent: TaskFailedEvent = {
          taskId: cloudTask.id,
          queueName: cloudTask.queueName,
          data: cloudTask.data,
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
          },
          attempts: cloudTask.attempts,
          maxAttempts: cloudTask.maxAttempts,
          isFinalAttempt: isLastAttempt,
          timestamp: new Date(),
        };
        await this.emitTaskEvent('failed', processors, cloudTask, error);
        this.emit('taskFailed', failedEvent);
      }

      if (isLastAttempt) {
        throw error; // Re-throw for final attempt
      } else {
        throw error; // Cloud Tasks will retry
      }
    } finally {
      // Remove from active processors
      activeProcessors.delete(taskId);
    }
  }

  /**
   * Update task progress
   */
  async updateTaskProgress(taskId: string, progress: TaskProgress): Promise<void> {
    const task = await this.storageAdapter.getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const cloudTask = new CloudTask(task);
    cloudTask.updateProgress(progress);

    await this.storageAdapter.updateTaskStatus(taskId, task.status, {
      progress: cloudTask.progress,
      updatedAt: cloudTask.updatedAt,
    });

    // Emit progress event
    const progressEvent: TaskProgressEvent = {
      taskId: cloudTask.id,
      queueName: cloudTask.queueName,
      data: cloudTask.data,
      progress,
      timestamp: new Date(),
    };
    
    const processors = this.processors.get(cloudTask.queueName);
    if (processors) {
      await this.emitTaskEvent('progress', processors, cloudTask, progress);
    }
    
    this.emit('taskProgress', progressEvent);
  }

  /**
   * Get registered processors
   */
  getProcessors(): Map<string, ProcessorRegistration[]> {
    return new Map(this.processors);
  }

  /**
   * Execute task processing using registered processors
   */
  private async executeTaskProcessing(
    processors: ProcessorRegistration[],
    cloudTask: CloudTask,
  ): Promise<any> {
    // Find the correct processor and handler based on taskName
    const taskName = cloudTask.options?.taskName;
    
    // Create a task wrapper that delegates updateProgress to emit events
    const taskWrapper = {
      ...cloudTask,
      updateProgress: async (progress: TaskProgress) => {
        await this.updateTaskProgress(cloudTask.id, progress);
        // Also update the local CloudTask instance
        cloudTask.updateProgress(progress);
      }
    };
    
    for (const processor of processors) {
      // Look for a handler that matches the task name
      const processHandler = processor.processHandlers.find(handler => 
        handler.name === taskName
      );
      
      if (processHandler) {
        const boundMethod = processHandler.handler.bind(processor.instance);
        return await boundMethod(taskWrapper);
      }
    }
    
    // If no specific handler found, try to use the first handler without a name (default handler)
    for (const processor of processors) {
      const defaultHandler = processor.processHandlers.find(handler => 
        !handler.name
      );
      
      if (defaultHandler) {
        const boundMethod = defaultHandler.handler.bind(processor.instance);
        return await boundMethod(taskWrapper);
      }
    }
    
    // If still no handler found, use the first available handler as fallback
    const processor = processors[0];
    const processHandler = processor.processHandlers[0];
    
    if (!processHandler) {
      throw new Error(`No process handlers available for queue "${cloudTask.queueName}"`);
    }

    const boundMethod = processHandler.handler.bind(processor.instance);
    return await boundMethod(taskWrapper);
  }

  /**
   * Emit task events to registered event handlers
   */
  private async emitTaskEvent(
    eventType: string,
    processors: ProcessorRegistration[],
    cloudTask: CloudTask,
    additionalData?: any,
  ): Promise<void> {
    for (const processor of processors) {
      const eventHandlers = processor.eventHandlers.filter(h => h.event === eventType);
      
      for (const handler of eventHandlers) {
        try {
          const boundMethod = handler.handler.bind(processor.instance);
          await boundMethod(cloudTask, additionalData);
        } catch (error) {
          console.error(`Error in ${eventType} event handler:`, error);
        }
      }
    }
  }

  /**
   * Process next task in chain
   */
  private async processNextInChain(cloudTask: CloudTask): Promise<void> {
    if (!cloudTask.chain) return;

    const nextIndex = cloudTask.getNextChainIndex();
    if (nextIndex === null) return;

    // Check if next task exists
    const nextTaskId = `${cloudTask.chain.id}-${nextIndex}`;
    const nextTask = await this.storageAdapter.getTask(nextTaskId);
    
    if (nextTask && nextTask.status === TaskStatus.IDLE) {
      // Trigger next task processing (this would normally be done by Cloud Tasks)
      console.log(`Chain ${cloudTask.chain.id}: Triggering next task ${nextIndex}`);
    }
  }

  /**
   * Close the consumer service
   */
  async close(): Promise<void> {
    this.processors.clear();
    this.activeProcessors.clear();
    this.removeAllListeners();
  }
}
