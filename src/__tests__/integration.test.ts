import { CloudTaskMQ } from '../cloud-taskmq';
import { MemoryStorageAdapter } from '../adapters/memory-storage.adapter';
import { CloudTaskMQConfig } from '../interfaces/config.interface';
import { TaskStatus } from '../interfaces/storage-adapter.interface';
import { Processor } from '../decorators/processor.decorator';
import { Process } from '../decorators/process.decorator';
import { OnTaskCompleted, OnTaskFailed } from '../decorators/events.decorator';

// Mock Google Cloud Tasks
jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn().mockImplementation(() => ({
    createTask: jest.fn().mockResolvedValue([{ name: 'test-task' }]),
    getQueue: jest.fn().mockResolvedValue([{ name: 'test-queue' }]),
    createQueue: jest.fn().mockResolvedValue([{ name: 'test-queue' }]),
    queuePath: jest.fn().mockReturnValue('projects/test/locations/us-central1/queues/test-queue'),
  })),
}));

describe('Integration Tests', () => {
  let cloudTaskMQ: CloudTaskMQ;
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
          maxRequests: 100,
          windowMs: 60000,
        },
      }, {
        name: 'high-priority',
        path: 'projects/test-project/locations/us-central1/queues/high-priority',
        rateLimiter: {
          maxRequests: 50,
          windowMs: 30000,
        },
      }, {
        name: 'batch-processing',
        path: 'projects/test-project/locations/us-central1/queues/batch-processing',
        rateLimiter: {
          maxRequests: 10,
          windowMs: 60000,
        },
      }, {
        name: 'integration-queue',
        path: 'projects/test-project/locations/us-central1/queues/integration-queue',
        rateLimiter: {
          maxRequests: 100,
          windowMs: 60000,
        },
      }, {
        name: 'rate-limited-queue',
        path: 'projects/test-project/locations/us-central1/queues/rate-limited-queue',
        rateLimiter: {
          maxRequests: 2,
          windowMs: 1000,
        },
      }, {
        name: 'event-queue',
        path: 'projects/test-project/locations/us-central1/queues/event-queue',
      }, {
        name: 'storage-test-queue',
        path: 'projects/test-project/locations/us-central1/queues/storage-test-queue',
      }, {
        name: 'cleanup-queue',
        path: 'projects/test-project/locations/us-central1/queues/cleanup-queue',
      }, {
        name: 'http-queue',
        path: 'projects/test-project/locations/us-central1/queues/http-queue',
      }, {
        name: 'concurrent-queue',
        path: 'projects/test-project/locations/us-central1/queues/concurrent-queue',
      }],
    };

    cloudTaskMQ = new CloudTaskMQ(config);
    await cloudTaskMQ.initialize();
  });

  afterEach(async () => {
    await cloudTaskMQ.close();
  });

  describe('End-to-End Task Processing', () => {
    @Processor('integration-queue')
    class IntegrationProcessor {
      public processedTasks: any[] = [];
      public completedTasks: any[] = [];
      public failedTasks: any[] = [];

      @Process({ name: 'email-task' })
      async sendEmail(task: any) {
        this.processedTasks.push({ type: 'email', data: task.data });
        return { sent: true, messageId: `msg-${Date.now()}` };
      }

      @Process({ name: 'report-task' })
      async generateReport(task: any) {
        await task.updateProgress({ percentage: 50, message: 'Generating...' });
        this.processedTasks.push({ type: 'report', data: task.data });
        await task.updateProgress({ percentage: 100, message: 'Complete' });
        return { reportId: `report-${Date.now()}`, status: 'generated' };
      }

      @Process({ name: 'failing-task' })
      async failingTask(task: any) {
        this.processedTasks.push({ type: 'failing', data: task.data });
        throw new Error('Intentional failure');
      }

      @OnTaskCompleted()
      async onCompleted(task: any, result: any) {
        this.completedTasks.push({ taskId: task.id, result });
      }

      @OnTaskFailed()
      async onFailed(task: any, error: Error) {
        this.failedTasks.push({ taskId: task.id, error: error.message });
      }
    }

    let processor: IntegrationProcessor;

    beforeEach(() => {
      processor = new IntegrationProcessor();
      cloudTaskMQ.registerProcessor(processor);
    });

    it('should process tasks end-to-end', async () => {
      // Add email task
      const emailTask = await cloudTaskMQ.addTask('integration-queue', {
        to: 'test@example.com',
        subject: 'Test Email',
        body: 'Hello World',
      }, { taskName: 'email-task' });

      // Add report task
      const reportTask = await cloudTaskMQ.addTask('integration-queue', {
        type: 'monthly',
        filters: { department: 'sales' },
      }, { taskName: 'report-task' });

      // Process tasks
      await cloudTaskMQ.processTask({
        taskId: emailTask.taskId,
        queueName: 'integration-queue',
        data: {
          to: 'test@example.com',
          subject: 'Test Email',
          body: 'Hello World',
        },
        attempts: 0,
        maxAttempts: 3,
      });

      await cloudTaskMQ.processTask({
        taskId: reportTask.taskId,
        queueName: 'integration-queue',
        data: {
          type: 'monthly',
          filters: { department: 'sales' },
        },
        attempts: 0,
        maxAttempts: 3,
      });

      // Verify processing
      expect(processor.processedTasks).toHaveLength(2);
      expect(processor.completedTasks).toHaveLength(2);
      expect(processor.failedTasks).toHaveLength(0);

      // Verify task data
      const emailProcessed = processor.processedTasks.find(t => t.type === 'email');
      expect(emailProcessed.data.to).toBe('test@example.com');

      const reportProcessed = processor.processedTasks.find(t => t.type === 'report');
      expect(reportProcessed?.data.type).toBe('monthly');
    });

    it('should handle task failures with retries', async () => {
      // Add failing task
      const failingTask = await cloudTaskMQ.addTask('integration-queue', {
        willFail: true,
      }, { taskName: 'failing-task', maxAttempts: 3 });

      // First attempt should fail
      await expect(
        cloudTaskMQ.processTask({
          taskId: failingTask.taskId,
          queueName: 'integration-queue',
          data: { willFail: true },
          attempts: 0,
          maxAttempts: 3,
        })
      ).rejects.toThrow('Intentional failure');

      // Second attempt should fail
      await expect(
        cloudTaskMQ.processTask({
          taskId: failingTask.taskId,
          queueName: 'integration-queue',
          data: { willFail: true },
          attempts: 1,
          maxAttempts: 3,
        })
      ).rejects.toThrow('Intentional failure');

      // Third attempt should fail and mark as failed
      await expect(
        cloudTaskMQ.processTask({
          taskId: failingTask.taskId,
          queueName: 'integration-queue',
          data: { willFail: true },
          attempts: 2,
          maxAttempts: 3,
        })
      ).rejects.toThrow('Intentional failure');

      // Verify task was processed multiple times
      expect(processor.processedTasks.filter(t => t.type === 'failing')).toHaveLength(3);
      expect(processor.failedTasks).toHaveLength(1);
      expect(processor.completedTasks).toHaveLength(0);

      // Check task status in storage
      const task = await cloudTaskMQ.getTask(failingTask.taskId);
      expect(task?.status).toBe(TaskStatus.FAILED);
      expect(task?.attempts).toBe(3);
    });

    it('should handle task chains', async () => {
      const chainTasks = [
        {
          data: { step: 1, message: 'First step' },
          options: { taskName: 'email-task' },
        },
        {
          data: { step: 2, message: 'Second step' },
          options: { taskName: 'report-task' },
        },
        {
          data: { step: 3, message: 'Third step' },
          options: { taskName: 'email-task' },
        },
      ];

      const chain = await cloudTaskMQ.addChain('integration-queue', chainTasks, { id: 'test-chain' });

      // Process all tasks in chain
      for (const task of chain) {
        await cloudTaskMQ.processTask({
          taskId: task.taskId,
          queueName: 'integration-queue',
          data: chainTasks[chain.indexOf(task)].data,
          attempts: 0,
          maxAttempts: 3,
          chain: {
            id: 'test-chain',
            index: chain.indexOf(task),
            total: chain.length,
          },
        });
      }

      // Verify all tasks were processed
      expect(processor.processedTasks).toHaveLength(3);
      expect(processor.completedTasks).toHaveLength(3);

      // Verify chain order
      const steps = processor.processedTasks.map(t => t.data.step).sort();
      expect(steps).toEqual([1, 2, 3]);
    });
  });

  describe('Rate Limiting Integration', () => {
    @Processor('rate-limited-queue')
    class RateLimitedProcessor {
      public processedCount = 0;

      @Process({ name: 'limited-task' })
      async processLimited() {
        this.processedCount++;
        return { processed: true };
      }
    }

    it('should respect rate limits', async () => {
      const processor = new RateLimitedProcessor();
      cloudTaskMQ.registerProcessor(processor);

      // Configure rate limit
      const rateLimitConfig = {
        maxRequests: 3,
        windowMs: 1000,
      };

      // Add tasks beyond rate limit
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const task = await cloudTaskMQ.addTask('rate-limited-queue', { index: i }, {
          taskName: 'limited-task',
        });
        tasks.push(task);
      }

      // Check rate limits before processing
      for (let i = 0; i < 5; i++) {
        const allowed = await cloudTaskMQ.checkRateLimit(
          'rate-limited-queue',
          rateLimitConfig
        );
        
        if (i < 3) {
          expect(allowed.allowed).toBe(true);
        } else {
          expect(allowed.allowed).toBe(false);
        }
      }
    });
  });

  describe('Event System Integration', () => {
    let eventLog: any[] = [];

    @Processor('event-queue')
    class EventProcessor {
      @Process({ name: 'event-task' })
      async processEvent(task: any) {
        await task.updateProgress({ percentage: 25 });
        await task.updateProgress({ percentage: 50 });
        await task.updateProgress({ percentage: 75 });
        return { eventProcessed: true };
      }
    }

    beforeEach(() => {
      eventLog = [];
      const processor = new EventProcessor();
      cloudTaskMQ.registerProcessor(processor);

      // Subscribe to all events
      cloudTaskMQ.on('taskAdded', (event) => eventLog.push({ type: 'added', ...event }));
      cloudTaskMQ.on('taskActive', (event) => eventLog.push({ type: 'active', ...event }));
      cloudTaskMQ.on('taskCompleted', (event) => eventLog.push({ type: 'completed', ...event }));
      cloudTaskMQ.on('taskProgress', (event) => eventLog.push({ type: 'progress', ...event }));
    });

    it('should emit events throughout task lifecycle', async () => {
      // Add task
      const task = await cloudTaskMQ.addTask('event-queue', { test: 'data' }, {
        taskName: 'event-task',
      });

      expect(eventLog.some(e => e.type === 'added' && e.taskId === task.taskId)).toBe(true);

      // Process task
      await cloudTaskMQ.processTask({
        taskId: task.taskId,
        queueName: 'event-queue',
        data: { test: 'data' },
        attempts: 0,
        maxAttempts: 3,
      });

      // Verify event sequence
      const taskEvents = eventLog.filter(e => e.taskId === task.taskId);
      const eventTypes = taskEvents.map(e => e.type);

      expect(eventTypes).toContain('added');
      expect(eventTypes).toContain('active');
      expect(eventTypes).toContain('completed');
      expect(eventTypes.filter(t => t === 'progress')).toHaveLength(3);
    });
  });

  describe('Storage Adapter Integration', () => {
    it('should handle storage operations correctly', async () => {
      // Add multiple tasks
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        const task = await cloudTaskMQ.addTask('storage-test-queue', { index: i });
        tasks.push(task);
      }

      // Query tasks
      const allTasks = await cloudTaskMQ.getTasks({ queueName: 'storage-test-queue' });
      expect(allTasks).toHaveLength(5);

      const pendingTasks = await cloudTaskMQ.getTasks({
        queueName: 'storage-test-queue',
        status: TaskStatus.IDLE,
      });
      expect(pendingTasks).toHaveLength(5);

      // Test uniqueness keys
      const firstUniqueTask = await cloudTaskMQ.addTask('storage-test-queue', { unique: true }, {
        uniquenessKey: 'unique-test-key',
      });
      expect(firstUniqueTask.success).toBe(true);

      const duplicateTask = await cloudTaskMQ.addTask('storage-test-queue', { unique: true }, {
        uniquenessKey: 'unique-test-key',
      });
      expect(duplicateTask.success).toBe(false);
      expect(duplicateTask.error).toContain('uniqueness key');
    });

    it('should handle cleanup operations', async () => {
      // Add completed tasks
      await cloudTaskMQ.addTask('cleanup-queue', { test: 1 }, {
        removeOnComplete: true,
      });

      // Verify cleanup configuration is preserved
      const tasks = await cloudTaskMQ.getTasks({ queueName: 'cleanup-queue' });
      expect(tasks[0].options?.removeOnComplete).toBe(true);
    });
  });

  describe('HTTP Integration', () => {
    it('should handle HTTP task processing', async () => {
      @Processor('http-queue')
      class HttpProcessor {
        @Process({ name: 'http-task' })
        async processHttp(task: any) {
          return { httpProcessed: true, data: task.data };
        }
      }

      const processor = new HttpProcessor();
      cloudTaskMQ.registerProcessor(processor);

      // Simulate HTTP request processing
      const taskData = {
        httpHeaders: {
          'x-cloudtasks-queuename': 'http-queue',
          'x-cloudtasks-taskname': 'http-task',
        },
        body: { message: 'HTTP test' },
      };

      // Add task
      const task = await cloudTaskMQ.addTask('http-queue', taskData.body, {
        taskName: 'http-task',
      });

      // Process via HTTP-like call
      const result = await cloudTaskMQ.processTask({
        taskId: task.taskId,
        queueName: 'http-queue',
        data: taskData.body,
        attempts: 0,
        maxAttempts: 3,
      });

      expect(result.httpProcessed).toBe(true);
      expect(result.data.message).toBe('HTTP test');
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle initialization errors', async () => {
      const invalidConfig: CloudTaskMQConfig = {
        projectId: '',
        location: '',
        storageAdapter: 'memory',
        queues: [],
      };

      const invalidCloudTaskMQ = new CloudTaskMQ(invalidConfig);
      
      // Should initialize but with limited functionality
      await expect(invalidCloudTaskMQ.initialize()).resolves.not.toThrow();
      await invalidCloudTaskMQ.close();
    });

    it('should handle concurrent operations', async () => {
      @Processor('concurrent-queue')
      class ConcurrentProcessor {
        public processCount = 0;

        @Process({ name: 'concurrent-task' })
        async processConcurrent() {
          this.processCount++;
          const currentCount = this.processCount;
          // Simulate some processing time
          await new Promise(resolve => setTimeout(resolve, 10));
          return { processed: true, count: currentCount };
        }
      }

      const processor = new ConcurrentProcessor();
      cloudTaskMQ.registerProcessor(processor);

      // Add multiple tasks
      const tasks: any[] = [];
      for (let i = 0; i < 10; i++) {
        const task = await cloudTaskMQ.addTask('concurrent-queue', { index: i }, {
          taskName: 'concurrent-task',
        });
        tasks.push(task);
      }

      // Process tasks concurrently
      const processPromises = tasks.map(task =>
        cloudTaskMQ.processTask({
          taskId: task.taskId,
          queueName: 'concurrent-queue',
          data: { index: tasks.indexOf(task) },
          attempts: 0,
          maxAttempts: 3,
        })
      );

      const results = await Promise.all(processPromises);

      // All tasks should be processed
      expect(results).toHaveLength(10);
      expect(processor.processCount).toBe(10);

      // Each result should be unique
      const counts = results.map(r => r.count);
      const uniqueCounts = new Set(counts);
      expect(uniqueCounts.size).toBe(10);
    });

    it('should handle graceful shutdown', async () => {
      // Add some tasks
      await cloudTaskMQ.addTask('shutdown-queue', { test: 'data' });

      // Shutdown should complete without errors
      await expect(cloudTaskMQ.close()).resolves.not.toThrow();

      // Operations after shutdown should handle gracefully
      await expect(
        cloudTaskMQ.addTask('shutdown-queue', { test: 'after-shutdown' })
      ).rejects.toThrow();
    });
  });
});
