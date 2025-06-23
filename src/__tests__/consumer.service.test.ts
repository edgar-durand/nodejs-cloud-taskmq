import { ConsumerService } from '../services/consumer.service';
import { MemoryStorageAdapter } from '../adapters/memory-storage.adapter';
import { CloudTaskMQConfig } from '../interfaces/config.interface';
import { TaskStatus } from '../interfaces/storage-adapter.interface';
import { CloudTask } from '../models/cloud-task.model';
import { Processor } from '../decorators/processor.decorator';
import { Process } from '../decorators/process.decorator';
import { OnTaskCompleted, OnTaskFailed } from '../decorators/events.decorator';

describe('ConsumerService', () => {
  let consumerService: ConsumerService;
  let storageAdapter: MemoryStorageAdapter;
  let config: CloudTaskMQConfig;

  beforeEach(async () => {
    config = {
      projectId: 'test-project',
      location: 'us-central1',
      storageAdapter: 'memory',
      queues: [{
        name: 'default',
        path: 'projects/test-project/locations/us-central1/queues/default',
        rateLimiter: {
          maxRequests: 10,
          windowMs: 60000,
        },
      }],
    };

    storageAdapter = new MemoryStorageAdapter();
    await storageAdapter.initialize();

    consumerService = new ConsumerService(config, storageAdapter);
    await consumerService.initialize();
  });

  afterEach(async () => {
    await consumerService.close();
    await storageAdapter.close();
  });

  describe('processor registration', () => {
    @Processor('test-queue')
    class TestProcessor {
      @Process({ name: 'test-task' })
      async processTask(task: CloudTask) {
        return { processed: true, data: task.data };
      }

      @OnTaskCompleted()
      async onCompleted(task: CloudTask, result: any) {
        // Event handler
      }
    }

    it('should register a processor', () => {
      const processor = new TestProcessor();
      
      expect(() => {
        consumerService.registerProcessor(processor);
      }).not.toThrow();

      const processors = consumerService.getProcessors();
      expect(processors.has('test-queue')).toBe(true);
      expect(processors.get('test-queue')).toHaveLength(1);
    });

    it('should throw error for processor without @Processor decorator', () => {
      class InvalidProcessor {
        @Process({ name: 'test-task' })
        async processTask() {}
      }

      const processor = new InvalidProcessor();
      
      expect(() => {
        consumerService.registerProcessor(processor);
      }).toThrow('Processor must be decorated with @Processor');
    });

    it('should throw error for processor without @Process methods', () => {
      @Processor('empty-queue')
      class EmptyProcessor {
        // No @Process methods
      }

      const processor = new EmptyProcessor();
      
      expect(() => {
        consumerService.registerProcessor(processor);
      }).toThrow('must have at least one @Process decorated method');
    });

    it('should register multiple processors for same queue', () => {
      @Processor('shared-queue')
      class Processor1 {
        @Process({ name: 'task-1' })
        async processTask1() {}
      }

      @Processor('shared-queue')
      class Processor2 {
        @Process({ name: 'task-2' })
        async processTask2() {}
      }

      const processor1 = new Processor1();
      const processor2 = new Processor2();

      consumerService.registerProcessor(processor1);
      consumerService.registerProcessor(processor2);

      const processors = consumerService.getProcessors();
      expect(processors.get('shared-queue')).toHaveLength(2);
    });
  });

  describe('task processing', () => {
    @Processor('processing-queue-success')
    class SuccessProcessor {
      @Process({ name: 'success-task' })
      async processSuccess(task: CloudTask) {
        return { success: true, processedAt: new Date() };
      }
    }

    @Processor('processing-queue-failure')
    class FailureProcessor {
      @Process({ name: 'failure-task' })
      async processFailure(task: CloudTask) {
        throw new Error('Processing failed');
      }
    }

    @Processor('processing-queue-max-failure')
    class MaxFailureProcessor {
      @Process({ name: 'failure-task' })
      async processFailure(task: CloudTask) {
        throw new Error('Processing failed');
      }
    }

    @Processor('processing-queue-progress')
    class ProgressProcessor {
      @Process({ name: 'progress-task' })
      async processWithProgress(task: CloudTask) {
        await task.updateProgress({ percentage: 50, data: { step: 'halfway' } });
        return { completed: true };
      }

      @OnTaskCompleted()
      async onCompleted(task: CloudTask, result: any) {
        task.data.completedCallback = true;
      }

      @OnTaskFailed()
      async onFailed(task: CloudTask, error: Error) {
        task.data.failedCallback = true;
      }
    }

    beforeEach(() => {
      const successProcessor = new SuccessProcessor();
      const failureProcessor = new FailureProcessor();
      const maxFailureProcessor = new MaxFailureProcessor();
      const progressProcessor = new ProgressProcessor();

      consumerService.registerProcessor(successProcessor);
      consumerService.registerProcessor(failureProcessor);
      consumerService.registerProcessor(maxFailureProcessor);
      consumerService.registerProcessor(progressProcessor);
    });

    it('should process a successful task', async () => {
      // Create a task in storage
      const task = {
        id: 'success-task-1',
        queueName: 'processing-queue-success',
        data: { input: 'test data' },
        status: TaskStatus.IDLE,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storageAdapter.saveTask(task);

      const result = await consumerService.processTask({
        taskId: 'success-task-1',
        queueName: 'processing-queue-success',
        data: { input: 'test data' },
        attempts: 0,
        maxAttempts: 3,
      });

      expect(result.success).toBe(true);
      expect(result.processedAt).toBeInstanceOf(Date);

      // Check task status was updated
      const updatedTask = await storageAdapter.getTask('success-task-1');
      expect(updatedTask?.status).toBe(TaskStatus.COMPLETED);
      expect(updatedTask?.result).toEqual(result);
    });

    it('should handle task failure', async () => {
      const task = {
        id: 'failure-task-1',
        queueName: 'processing-queue-failure',
        data: { input: 'test data' },
        status: TaskStatus.IDLE,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storageAdapter.saveTask(task);

      await expect(
        consumerService.processTask({
          taskId: 'failure-task-1',
          queueName: 'processing-queue-failure',
          data: { input: 'test data' },
          attempts: 0,
          maxAttempts: 3,
        })
      ).rejects.toThrow('Processing failed');

      // Check task status after failure (should still be idle for retry)
      const updatedTask = await storageAdapter.getTask('failure-task-1');
      expect(updatedTask?.status).toBe(TaskStatus.IDLE);
      expect(updatedTask?.attempts).toBe(1);
    });

    it('should mark task as failed after max attempts', async () => {
      const task = {
        id: 'failure-task-2',
        queueName: 'processing-queue-max-failure',
        data: { input: 'test data' },
        status: TaskStatus.IDLE,
        attempts: 2, // Already at max attempts - 1
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storageAdapter.saveTask(task);

      await expect(
        consumerService.processTask({
          taskId: 'failure-task-2',
          queueName: 'processing-queue-max-failure',
          data: { input: 'test data' },
          attempts: 2,
          maxAttempts: 3,
        })
      ).rejects.toThrow('Processing failed');

      // Check task is marked as failed
      const updatedTask = await storageAdapter.getTask('failure-task-2');
      expect(updatedTask?.status).toBe(TaskStatus.FAILED);
      expect(updatedTask?.attempts).toBe(3);
    });

    it('should handle task not found', async () => {
      await expect(
        consumerService.processTask({
          taskId: 'non-existent-task',
          queueName: 'processing-queue',
          data: {},
          attempts: 0,
          maxAttempts: 3,
        })
      ).rejects.toThrow('Task non-existent-task not found in storage');
    });

    it('should handle no processors for queue', async () => {
      const task = {
        id: 'orphan-task-1',
        queueName: 'orphan-queue',
        data: {},
        status: TaskStatus.IDLE,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storageAdapter.saveTask(task);

      await expect(
        consumerService.processTask({
          taskId: 'orphan-task-1',
          queueName: 'orphan-queue',
          data: {},
          attempts: 0,
          maxAttempts: 3,
        })
      ).rejects.toThrow('No processors registered for queue "orphan-queue"');
    });

    it('should prevent concurrent processing of same task', async () => {
      @Processor('concurrent-test-queue')
      class ConcurrentProcessor {
        @Process({ name: 'concurrent-task' })
        async processConcurrent(task: CloudTask) {
          // Simulate processing time
          await new Promise(resolve => setTimeout(resolve, 200));
          return { success: true, processedAt: new Date() };
        }
      }

      const concurrentProcessor = new ConcurrentProcessor();
      consumerService.registerProcessor(concurrentProcessor);

      const task = {
        id: 'concurrent-task-1',
        queueName: 'concurrent-test-queue',
        data: { input: 'test data' },
        status: TaskStatus.IDLE,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      await storageAdapter.saveTask(task);

      // Process the same task concurrently with different timing
      const promise1 = consumerService.processTask({
        taskId: 'concurrent-task-1',
        queueName: 'concurrent-test-queue',
        data: { input: 'test data' },
        attempts: 0,
        maxAttempts: 3,
      });

      // Start second task after a small delay to ensure race condition
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const promise2 = consumerService.processTask({
        taskId: 'concurrent-task-1',
        queueName: 'concurrent-test-queue',
        data: { input: 'test data' },
        attempts: 0,
        maxAttempts: 3,
      });

      const results = await Promise.allSettled([promise1, promise2]);
      const fulfilled = results.filter(r => r.status === 'fulfilled');
      const rejected = results.filter(r => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('already being processed');
    });
  });

  describe('event handling', () => {
    let completedEvents: any[] = [];
    let failedEvents: any[] = [];
    let progressEvents: any[] = [];
    let serviceCompletedEvents: any[] = [];
    let serviceFailedEvents: any[] = [];
    let serviceProgressEvents: any[] = [];

    @Processor('event-queue')
    class EventProcessor {
      @Process({ name: 'event-task' })
      async processEvent(task: CloudTask) {
        await task.updateProgress({ percentage: 50 });
        return { eventProcessed: true };
      }

      @OnTaskCompleted()
      async onCompleted(task: CloudTask, result: any) {
        completedEvents.push({ taskId: task.id, result });
      }

      @OnTaskFailed()
      async onFailed(task: CloudTask, error: Error) {
        failedEvents.push({ taskId: task.id, error: error.message });
      }
    }

    beforeEach(() => {
      completedEvents = [];
      failedEvents = [];
      progressEvents = [];
      serviceCompletedEvents = [];
      serviceFailedEvents = [];
      serviceProgressEvents = [];

      const processor = new EventProcessor();
      consumerService.registerProcessor(processor);

      consumerService.on('taskCompleted', (event) => serviceCompletedEvents.push(event));
      consumerService.on('taskFailed', (event) => serviceFailedEvents.push(event));
      consumerService.on('taskProgress', (event) => serviceProgressEvents.push(event));
    });

    it('should emit completed events', async () => {
      const task = {
        id: 'event-task-1',
        queueName: 'event-queue',
        data: {},
        status: TaskStatus.IDLE,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await storageAdapter.saveTask(task);

      await consumerService.processTask({
        taskId: 'event-task-1',
        queueName: 'event-queue',
        data: {},
        attempts: 0,
        maxAttempts: 3,
      });

      // Check decorator events
      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0]).toEqual({
        taskId: 'event-task-1',
        result: { eventProcessed: true }
      });

      // Check service events
      expect(serviceCompletedEvents).toHaveLength(1);
      expect(serviceCompletedEvents[0]).toEqual(
        expect.objectContaining({
          taskId: 'event-task-1',
          queueName: 'event-queue',
          result: { eventProcessed: true },
        })
      );
    });
  });

  describe('progress updates', () => {
    @Processor('processing-queue-progress')
    class ProgressProcessor {
      @Process({ name: 'progress-task' })
      async processWithProgress(task: CloudTask) {
        await task.updateProgress({ percentage: 50, data: { step: 'halfway' } });
        return { completed: true };
      }
    }

    beforeEach(() => {
      const progressProcessor = new ProgressProcessor();
      consumerService.registerProcessor(progressProcessor);
    });

    it('should update task progress', async () => {
      const task = {
        id: 'progress-task-1',
        queueName: 'processing-queue-progress',
        data: { input: 'test data' },
        status: TaskStatus.IDLE,
        createdAt: new Date(),
        updatedAt: new Date(),
        attempts: 0,
        maxAttempts: 3,
      };

      await storageAdapter.saveTask(task);

      const result = await consumerService.processTask({
        taskId: 'progress-task-1',
        queueName: 'processing-queue-progress',
        data: { input: 'test data' },
        attempts: 0,
        maxAttempts: 3,
      });

      expect(result).toEqual({ completed: true });

      // Check task is completed
      const updatedTask = await storageAdapter.getTask('progress-task-1');
      expect(updatedTask?.status).toBe(TaskStatus.COMPLETED);
    });

    it('should throw error for non-existent task progress update', async () => {
      await expect(
        consumerService.updateTaskProgress('non-existent', { percentage: 50 })
      ).rejects.toThrow('Task non-existent not found');
    });
  });

  describe('chain processing', () => {
    @Processor('chain-queue')
    class ChainProcessor {
      @Process({ name: 'chain-task' })
      async processChainTask(task: CloudTask) {
        return { chainStep: task.chain?.index };
      }
    }

    it('should handle chain task processing', async () => {
      const processor = new ChainProcessor();
      consumerService.registerProcessor(processor);

      const chainTasks = [
        {
          id: 'chain-1-0',
          queueName: 'chain-queue',
          data: { step: 0 },
          status: TaskStatus.IDLE,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          chain: { id: 'chain-1', index: 0, total: 2 },
        },
        {
          id: 'chain-1-1',
          queueName: 'chain-queue',
          data: { step: 1 },
          status: TaskStatus.IDLE,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          chain: { id: 'chain-1', index: 1, total: 2 },
        },
      ];

      for (const task of chainTasks) {
        await storageAdapter.saveTask(task);
      }

      // Process first task in chain
      const result = await consumerService.processTask({
        taskId: 'chain-1-0',
        queueName: 'chain-queue',
        data: { step: 0 },
        attempts: 0,
        maxAttempts: 3,
        chain: { id: 'chain-1', index: 0, total: 2 },
      });

      expect(result.chainStep).toBe(0);

      // Verify task is completed
      const completedTask = await storageAdapter.getTask('chain-1-0');
      expect(completedTask?.status).toBe(TaskStatus.COMPLETED);
    });
  });
});
