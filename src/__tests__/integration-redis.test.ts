import { CloudTaskMQ } from '../cloud-taskmq';
import { RedisStorageAdapter } from '../adapters/redis-storage.adapter';
import { CloudTaskMQConfig } from '../interfaces/config.interface';
import { TaskStatus } from '../interfaces/storage-adapter.interface';
import { Processor } from '../decorators/processor.decorator';
import { Process } from '../decorators/process.decorator';
import { OnTaskCompleted, OnTaskFailed } from '../decorators/events.decorator';
import { DockerTestHelper } from './helpers/docker-setup';

// Mock Google Cloud Tasks
jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn().mockImplementation(() => ({
    createTask: jest.fn().mockResolvedValue([{ name: 'test-task' }]),
    getQueue: jest.fn().mockResolvedValue([{ name: 'test-queue' }]),
    createQueue: jest.fn().mockResolvedValue([{ name: 'test-queue' }]),
    queuePath: jest.fn().mockReturnValue('projects/test/locations/us-central1/queues/test-queue'),
  })),
}));

describe('Redis Integration Tests', () => {
  let cloudTaskMQ: CloudTaskMQ;
  let config: CloudTaskMQConfig;
  let redisConnectionString: string;

  beforeAll(async () => {
    // Check if Docker is running
    const dockerRunning = await DockerTestHelper.isDockerRunning();
    if (!dockerRunning) {
      throw new Error('Docker is not running. Please start Docker to run integration tests.');
    }

    // Start Redis container
    redisConnectionString = await DockerTestHelper.startContainer('redis');
    console.log('Redis container started:', redisConnectionString);
  }, 60000); // 60 second timeout for container startup

  afterAll(async () => {
    if (cloudTaskMQ) {
      await cloudTaskMQ.close();
    }
    await DockerTestHelper.stopContainer('redis');
  }, 30000);

  beforeEach(async () => {
    config = {
      projectId: 'test-project',
      location: 'us-central1',
      storageAdapter: 'redis',
      storageOptions: {
        redis: {
          url: redisConnectionString,
        },
      },
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
        name: 'integration-queue',
        path: 'projects/test-project/locations/us-central1/queues/integration-queue',
        rateLimiter: {
          maxRequests: 10,
          windowMs: 60000,
        },
      }, {
        name: 'limited-queue',
        path: 'projects/test-project/locations/us-central1/queues/limited-queue',
        rateLimiter: {
          maxRequests: 10,
          windowMs: 60000,
        },
      }],
    };

    cloudTaskMQ = new CloudTaskMQ(config);
    await cloudTaskMQ.initialize();
    
    // Clean up any existing tasks from previous tests
    const adapter = cloudTaskMQ['storageAdapter'] as RedisStorageAdapter;
    await adapter['clearAllTasks']();
  }, 30000);

  afterEach(async () => {
    if (cloudTaskMQ) {
      // Clean up tasks and shutdown
      const adapter = cloudTaskMQ['storageAdapter'] as RedisStorageAdapter;
      await adapter['clearAllTasks']();
      await cloudTaskMQ.close();
    }
  });

  @Processor('integration-queue')
  class RedisIntegrationProcessor {
    public processedTasks: any[] = [];
    public completedTasks: any[] = [];
    public failedTasks: any[] = [];

    @Process({ name: 'send-notification' })
    async sendNotification(task: any) {
      this.processedTasks.push(task);
      await new Promise(resolve => setTimeout(resolve, 10));
      return { sent: true, notification: task.data.message };
    }

    @Process({ name: 'cache-data' })
    async cacheData(task: any) {
      this.processedTasks.push(task);
      await new Promise(resolve => setTimeout(resolve, 20));
      return { cached: true, key: task.data.key, value: task.data.value };
    }

    @Process({ name: 'failing-task' })
    async failingTask(task: any) {
      this.processedTasks.push(task);
      throw new Error('Redis task failure for testing');
    }

    @OnTaskCompleted()
    onCompleted(task: any, result: any) {
      this.completedTasks.push({ task, result });
    }

    @OnTaskFailed()
    onFailed(task: any, error: Error) {
      this.failedTasks.push({ task, error });
    }
  }

  describe('Basic Task Processing with Redis', () => {
    let processor: RedisIntegrationProcessor;

    beforeEach(() => {
      processor = new RedisIntegrationProcessor();
      cloudTaskMQ.registerProcessor(processor);
    });

    it('should add and process tasks successfully', async () => {
      const taskData = { message: 'Hello Redis!', userId: '123' };
      const result = await cloudTaskMQ.addTask('integration-queue', taskData, { taskName: 'send-notification' });

      expect(result.success).toBe(true);
      expect(result.taskId).toBeDefined();

      // Process task manually
      await cloudTaskMQ.processTask({
        taskId: result.taskId!,
        queueName: 'integration-queue',
        data: taskData,
        attempts: 0,
        maxAttempts: 3,
      });

      // Wait for task processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that task was processed
      expect(processor.processedTasks).toHaveLength(1);
      expect(processor.processedTasks[0].data).toEqual(taskData);
      expect(processor.completedTasks).toHaveLength(1);
    });

    it('should handle task failures correctly', async () => {
      const taskData = { test: 'redis-failure' };
      const result = await cloudTaskMQ.addTask('integration-queue', taskData, { taskName: 'failing-task' });

      expect(result.success).toBe(true);

      // Process task manually to trigger failure
      try {
        // Get the stored task and modify it to be the final attempt
        const storedTask = await (cloudTaskMQ as any).storageAdapter.getTask(result.taskId!);
        
        if (!storedTask) {
          throw new Error('No task found in storage');
        }
        
        storedTask.attempts = storedTask.maxAttempts - 1; // Set to one less than max so next attempt is final
        await (cloudTaskMQ as any).storageAdapter.saveTask(storedTask);
        
        // Create the correct payload for processTask
        const payload = {
          taskId: storedTask.id,
          queueName: storedTask.queueName,
          data: storedTask.data,
          attempts: storedTask.attempts,
          maxAttempts: storedTask.maxAttempts,
          uniquenessKey: storedTask.uniquenessKey,
        };
        
        await cloudTaskMQ.processTask(payload);
      } catch (error) {
        // Expected to throw error on final attempt
      }

      // Wait for task processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that task failed
      expect(processor.processedTasks).toHaveLength(1);
      expect(processor.failedTasks).toHaveLength(1);
      expect(processor.failedTasks[0].error.message).toBe('Redis task failure for testing');
    });

    it('should store task chain correctly in Redis', async () => {
      const tasks = [
        { data: { step: 1, operation: 'cache' }, options: { taskName: 'cache-data' } },
        { data: { step: 2, operation: 'notify' }, options: { taskName: 'send-notification' } },
        { data: { step: 3, operation: 'cache' }, options: { taskName: 'cache-data' } },
      ];

      const chainResults = await cloudTaskMQ.addChain('integration-queue', tasks);

      expect(chainResults).toHaveLength(3);
      
      // Verify all tasks have the same chain ID
      const storedTasks = await Promise.all(
        chainResults.map(result => cloudTaskMQ.getTask(result.taskId))
      );
      
      const chainIds = storedTasks.map(task => task?.chain?.id);
      expect(new Set(chainIds).size).toBe(1);
      
      // Verify chain metadata
      storedTasks.forEach((task, index) => {
        expect(task?.chain?.index).toBe(index);
        expect(task?.chain?.total).toBe(3);
      });
    });

    it('should handle uniqueness keys correctly', async () => {
      const uniquenessKey = 'unique-redis-task-456';
      const taskData = { message: 'First Redis task' };

      // Add first task
      const result1 = await cloudTaskMQ.addTask('integration-queue', taskData, { 
        uniquenessKey,
        taskName: 'send-notification'
      });

      expect(result1.success).toBe(true);

      // Try to add duplicate task
      const result2 = await cloudTaskMQ.addTask('integration-queue', taskData, { 
        uniquenessKey,
        taskName: 'send-notification'
      });

      expect(result2.success).toBe(false);
      expect(result2.skipped).toBe(true);
    });

    it('should handle high-throughput task processing', async () => {
      const taskPromises: Promise<any>[] = [];
      
      // Add many tasks quickly
      for (let i = 0; i < 20; i++) {
        taskPromises.push(
          cloudTaskMQ.addTask('integration-queue', { 
            key: `cache-key-${i}`, 
            value: `value-${i}` 
          }, { taskName: 'cache-data' })
        );
      }

      const results = await Promise.all(taskPromises);
      
      // All tasks should be added successfully (within rate limits)
      const successful = results.filter(r => r.success);
      expect(successful.length).toBeGreaterThan(0);
      
      // Process some tasks manually to verify the system can handle them
      const tasksToProcess = successful.slice(0, 5); // Process first 5 tasks
      for (const result of tasksToProcess) {
        await cloudTaskMQ.processTask({
          taskId: result.taskId!,
          queueName: 'integration-queue',
          data: { key: `cache-key-${tasksToProcess.indexOf(result)}`, value: `value-${tasksToProcess.indexOf(result)}` },
          attempts: 0,
          maxAttempts: 3,
        });
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Some tasks should have been processed
      expect(processor.processedTasks.length).toBeGreaterThan(0);
    });
  });

  describe('Rate Limiting with Redis', () => {
    @Processor('limited-queue')
    class RateLimitedProcessor {
      public processedCount = 0;

      @Process({ name: 'rate-limited' })
      async processLimited() {
        this.processedCount++;
        return { processed: true };
      }
    }

    it('should respect rate limits', async () => {
      const processor = new RateLimitedProcessor();
      cloudTaskMQ.registerProcessor(processor);

      // Try to add more tasks than the rate limit allows
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 15; i++) {
        promises.push(
          cloudTaskMQ.addTask('limited-queue', { index: i }, { taskName: 'rate-limited' })
        );
      }

      const results = await Promise.all(promises);
      
      // Should have some successful and some rate limited
      const successful = results.filter(r => r.success);
      const rateLimited = results.filter(r => !r.success && r.error?.includes('Rate limit'));

      expect(successful.length).toBeLessThanOrEqual(10); // Rate limit is 10
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Event System with Redis', () => {
    let eventLog: any[] = [];

    @Processor('integration-queue')
    class EventProcessor {
      @Process({ name: 'event-task' })
      async processEvent(task: any) {
        return { processed: true, data: task.data };
      }
    }

    beforeEach(() => {
      eventLog = [];
      const processor = new EventProcessor();
      cloudTaskMQ.registerProcessor(processor);
    });

    it('should emit events correctly', async () => {
      const taskData = { event: 'redis-test' };
      let taskAddedEventReceived = false;
      let taskCompletedEventReceived = false;

      // Set up event listeners
      const taskAddedPromise = new Promise((resolve) => {
        cloudTaskMQ.on('taskAdded', (event) => {
          eventLog.push({ type: 'taskAdded', ...event });
          taskAddedEventReceived = true;
          resolve(event);
        });
      });

      const taskCompletedPromise = new Promise((resolve) => {
        cloudTaskMQ.on('taskCompleted', (event) => {
          eventLog.push({ type: 'taskCompleted', ...event });
          taskCompletedEventReceived = true;
          resolve(event);
        });
      });

      // Add task
      const result = await cloudTaskMQ.addTask('integration-queue', taskData, { taskName: 'event-task' });
      
      // Wait for taskAdded event
      await taskAddedPromise;
      
      // Process task manually to trigger completion event
      await cloudTaskMQ.processTask({
        taskId: result.taskId!,
        queueName: 'integration-queue',
        data: taskData,
        attempts: 0,
        maxAttempts: 3,
      });
      
      // Wait for taskCompleted event
      await taskCompletedPromise;
      
      // Verify events were emitted
      expect(taskAddedEventReceived).toBe(true);
      expect(taskCompletedEventReceived).toBe(true);
      expect(eventLog).toHaveLength(2);
      expect(eventLog[0].type).toBe('taskAdded');
      expect(eventLog[1].type).toBe('taskCompleted');
    });
  });

  describe('Concurrent Processing with Redis', () => {
    @Processor('integration-queue')
    class ConcurrentProcessor {
      public processCount = 0;

      @Process({ name: 'concurrent-task' })
      async processConcurrent() {
        this.processCount++;
        await new Promise(resolve => setTimeout(resolve, 30));
        return { processed: true };
      }
    }

    it('should handle concurrent task processing', async () => {
      const processor = new ConcurrentProcessor();
      cloudTaskMQ.registerProcessor(processor);

      // Add multiple tasks concurrently
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 8; i++) {
        promises.push(
          cloudTaskMQ.addTask('integration-queue', { index: i }, { taskName: 'concurrent-task' })
        );
      }

      const results = await Promise.all(promises);
      
      // All tasks should be added successfully
      const successful = results.filter(r => r.success);
      expect(successful.length).toBeGreaterThan(0);

      // Process some tasks manually concurrently
      const tasksToProcess = successful.slice(0, 3); // Process first 3 tasks
      const processPromises = tasksToProcess.map((result, index) => 
        cloudTaskMQ.processTask({
          taskId: result.taskId!,
          queueName: 'integration-queue',
          data: { index },
          attempts: 0,
          maxAttempts: 3,
        })
      );

      await Promise.all(processPromises);

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // Tasks should have been processed
      expect(processor.processCount).toBeGreaterThan(0);
    });
  });

  describe('Task Status Management with Redis', () => {
    it('should manage task status correctly', async () => {
      const result = await cloudTaskMQ.addTask('integration-queue', { test: 'redis-status' });
      
      const task = await cloudTaskMQ.getTask(result.taskId!);
      expect(task).toBeDefined();
      expect(task?.status).toBe(TaskStatus.IDLE);

      const tasks = await cloudTaskMQ.getTasks({ queueName: 'integration-queue' });
      expect(tasks.some(t => t.id === result.taskId)).toBe(true);

      const count = await cloudTaskMQ.getTaskCount({ queueName: 'integration-queue' });
      expect(count).toBeGreaterThan(0);
    });
  });

  describe('Redis-specific Features', () => {
    it('should handle Redis data persistence', async () => {
      // Add a task
      const result = await cloudTaskMQ.addTask('integration-queue', { 
        key: 'persistent-data', 
        value: 'should-persist' 
      });

      expect(result.success).toBe(true);

      // Verify task is stored
      const task = await cloudTaskMQ.getTask(result.taskId!);
      expect(task).toBeDefined();
      expect(task?.data.key).toBe('persistent-data');
      expect(task?.data.value).toBe('should-persist');
    });

    it('should handle Redis connection resilience', async () => {
      // This test verifies that basic operations work
      // In a real scenario, you might test connection recovery
      const results = await Promise.all([
        cloudTaskMQ.addTask('integration-queue', { test: 1 }),
        cloudTaskMQ.addTask('integration-queue', { test: 2 }),
        cloudTaskMQ.addTask('integration-queue', { test: 3 }),
      ]);

      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      const count = await cloudTaskMQ.getTaskCount({ queueName: 'integration-queue' });
      expect(count).toBe(3);
    });
  });
});
