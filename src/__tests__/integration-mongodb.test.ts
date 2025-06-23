import { CloudTaskMQ } from '../cloud-taskmq';
import { MongoStorageAdapter } from '../adapters/mongo-storage.adapter';
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

describe('MongoDB Integration Tests', () => {
  let cloudTaskMQ: CloudTaskMQ;
  let config: CloudTaskMQConfig;
  let mongoConnectionString: string;
  let processor: any;

  beforeAll(async () => {
    // Check if Docker is running
    const dockerRunning = await DockerTestHelper.isDockerRunning();
    if (!dockerRunning) {
      throw new Error('Docker is not running. Please start Docker to run integration tests.');
    }

    // Start MongoDB container
    mongoConnectionString = await DockerTestHelper.startContainer('mongodb');
    console.log('MongoDB container started:', mongoConnectionString);
  }, 60000); // 60 second timeout for container startup

  afterAll(async () => {
    if (cloudTaskMQ) {
      await cloudTaskMQ.close();
    }
    await DockerTestHelper.stopContainer('mongodb');
  }, 30000);

  beforeEach(async () => {
    config = {
      projectId: 'test-project',
      location: 'us-central1',
      storageAdapter: 'mongo',
      storageOptions: {
        mongo: {
          uri: mongoConnectionString,
        },
      },
      queues: [
        {
          name: 'integration-queue',
          path: 'projects/test-project/locations/us-central1/queues/integration-queue',
          maxRetries: 3,
          retryDelay: 10,
        },
        {
          name: 'limited-queue',
          path: 'projects/test-project/locations/us-central1/queues/limited-queue',
          rateLimiter: {
            maxRequests: 10,
            windowMs: 60000,
          },
        },
      ],
    };

    cloudTaskMQ = new CloudTaskMQ(config);
    await cloudTaskMQ.initialize();

    // Clear all existing tasks to ensure clean state
    const adapter = (cloudTaskMQ as any).storageAdapter;
    await adapter.clearAllTasks();

    // Clear rate limiter state to ensure clean state between tests
    const rateLimiter = (cloudTaskMQ as any).rateLimiterService;
    await rateLimiter.resetRateLimit('limited-queue');

    // Register processor
    processor = new MongoIntegrationProcessor();
    cloudTaskMQ.registerProcessor(processor);
  }, 30000);

  afterEach(async () => {
    if (cloudTaskMQ) {
      // Clean up tasks and shutdown
      const adapter = cloudTaskMQ['storageAdapter'] as MongoStorageAdapter;
      await adapter['clearAllTasks']();
      await cloudTaskMQ.close();
    }
  });

  @Processor('integration-queue')
  class MongoIntegrationProcessor {
    public processedTasks: any[] = [];
    public completedTasks: any[] = [];
    public failedTasks: any[] = [];
    public processCount = 0;

    @Process({ name: 'test-task' })
    async processTestTask(task: any) {
      this.processedTasks.push({ type: 'test', data: task.data });
      this.processCount++;
      return { processed: true, taskId: task.id };
    }

    @Process({ name: 'failing-task' })
    async processFailingTask(task: any) {
      this.processedTasks.push({ type: 'failing', data: task.data });
      this.processCount++;
      throw new Error('Intentional failure for testing');
    }

    @OnTaskCompleted()
    async onCompleted(task: any, result: any) {
      this.completedTasks.push({ taskId: task.id, result });
    }

    @OnTaskFailed()
    async onFailed(task: any, error: any) {
      this.failedTasks.push({ taskId: task.id, error });
    }
  }

  describe('Basic Task Processing with MongoDB', () => {
    it('should add and process tasks successfully', async () => {
      const taskData = { message: 'Hello MongoDB!' };
      
      // Add task with task name
      const result = await cloudTaskMQ.addTask('integration-queue', taskData, { taskName: 'test-task' });
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

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that task was processed
      expect(processor.processedTasks).toHaveLength(1);
      expect(processor.processedTasks[0].data).toEqual(taskData);
      expect(processor.completedTasks).toHaveLength(1);
    });

    it('should handle task failures correctly', async () => {
      const taskData = { message: 'This will fail' };
      
      // Add failing task
      const result = await cloudTaskMQ.addTask('integration-queue', taskData, { 
        uniquenessKey: 'unique-mongo-task-123',
        taskName: 'failing-task'
      });

      expect(result.success).toBe(true);
      
      // Process task manually and expect it to throw - set as final attempt
      let errorThrown = false;
      try {
        // Get the stored task and modify it to be the final attempt
        const storedTasks = await (cloudTaskMQ as any).storageAdapter.getTasks('integration-queue', 1, 0);
        
        if (storedTasks.length === 0) {
          throw new Error('No tasks found in storage');
        }
        
        const task = storedTasks[0];
        task.attempts = task.maxAttempts - 1; // Set to one less than max so next attempt is final
        await (cloudTaskMQ as any).storageAdapter.saveTask(task);
        
        // Create the correct payload for processTask
        const payload = {
          taskId: task.id,
          queueName: task.queueName,
          data: task.data,
          attempts: task.attempts,
          maxAttempts: task.maxAttempts,
          uniquenessKey: task.uniquenessKey,
        };

        await (cloudTaskMQ as any).consumerService.processTask(payload);
      } catch (error) {
        errorThrown = true;
        expect((error as Error).message).toBe('Intentional failure for testing');
      }

      expect(errorThrown).toBe(true);

      // Wait a bit for async processing and events
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that task was processed and failed
      expect(processor.processedTasks).toHaveLength(1);
      expect(processor.failedTasks).toHaveLength(1);
      expect(processor.failedTasks[0].error.message).toBe('Intentional failure for testing');
    });

    it('should store task chain correctly in MongoDB', async () => {
      const tasks = [
        { data: { step: 1 }, options: { taskName: 'send-email' } },
        { data: { step: 2 }, options: { taskName: 'generate-report' } },
        { data: { step: 3 }, options: { taskName: 'send-email' } },
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
      const uniquenessKey = 'unique-mongo-task-123';
      const taskData = { message: 'First task' };

      // Add first task
      const result1 = await cloudTaskMQ.addTask('integration-queue', taskData, { 
        uniquenessKey,
        taskName: 'send-email'
      });

      expect(result1.success).toBe(true);

      // Try to add duplicate task
      const result2 = await cloudTaskMQ.addTask('integration-queue', taskData, { 
        uniquenessKey,
        taskName: 'send-email'
      });

      expect(result2.success).toBe(false);
      expect(result2.skipped).toBe(true);
    });
  });

  describe('Rate Limiting with MongoDB', () => {
    it('should respect rate limits', async () => {
      // Add multiple tasks quickly to trigger rate limiting
      const promises: Promise<any>[] = [];
      for (let i = 0; i < 15; i++) {
        const promise = cloudTaskMQ.addTask('limited-queue', { index: i }, { taskName: 'test-task' });
        promises.push(promise);
      }

      const results = await Promise.all(promises);
      const successful = results.filter(r => r.success);
      const rateLimited = results.filter(r => !r.success && r.error?.includes('Rate limit'));

      expect(successful.length).toBeLessThanOrEqual(10); // Rate limit is 10
      expect(rateLimited.length).toBeGreaterThan(0);
    });
  });

  describe('Event System with MongoDB', () => {
    it('should emit events correctly', async () => {
      const taskData = { event: 'test' };
      let taskAddedEventReceived = false;
      let taskCompletedEventReceived = false;

      // Set up event listeners
      const taskAddedPromise = new Promise((resolve) => {
        cloudTaskMQ.on('taskAdded', (event) => {
          expect(event.taskId).toBeDefined();
          expect(event.queueName).toBe('integration-queue');
          expect(event.data).toEqual(taskData);
          taskAddedEventReceived = true;
          resolve(true);
        });
      });

      const taskCompletedPromise = new Promise((resolve) => {
        cloudTaskMQ.on('taskCompleted', (event) => {
          expect(event.taskId).toBeDefined();
          taskCompletedEventReceived = true;
          resolve(true);
        });
      });

      // Add task
      const result = await cloudTaskMQ.addTask('integration-queue', taskData, { taskName: 'test-task' });
      expect(result.success).toBe(true);

      // Process task
      await cloudTaskMQ.processTask({
        taskId: result.taskId!,
        queueName: 'integration-queue',
        data: taskData,
        attempts: 0,
        maxAttempts: 3,
      });

      // Wait for events
      await Promise.all([taskAddedPromise, taskCompletedPromise]);

      expect(taskAddedEventReceived).toBe(true);
      expect(taskCompletedEventReceived).toBe(true);
    }, 10000);
  });

  describe('Concurrent Processing with MongoDB', () => {
    it('should handle concurrent task processing', async () => {
      // Add multiple tasks concurrently
      const results = await Promise.all([
        cloudTaskMQ.addTask('integration-queue', { id: 1 }, { taskName: 'test-task' }),
        cloudTaskMQ.addTask('integration-queue', { id: 2 }, { taskName: 'test-task' }),
        cloudTaskMQ.addTask('integration-queue', { id: 3 }, { taskName: 'test-task' }),
        cloudTaskMQ.addTask('integration-queue', { id: 4 }, { taskName: 'test-task' }),
        cloudTaskMQ.addTask('integration-queue', { id: 5 }, { taskName: 'test-task' }),
      ]);

      // All tasks should be successfully added
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Process all tasks
      for (const result of results) {
        await cloudTaskMQ.processTask({
          taskId: result.taskId!,
          queueName: 'integration-queue',
          data: { id: results.indexOf(result) + 1 },
          attempts: 0,
          maxAttempts: 3,
        });
      }

      // Wait for processing to complete
      await new Promise(resolve => setTimeout(resolve, 200));

      // All tasks should have been processed
      expect(processor.processCount).toBe(5);
    });
  });

  describe('Task Status Management with MongoDB', () => {
    it('should manage task status correctly', async () => {
      const result = await cloudTaskMQ.addTask('integration-queue', 'test-task', { message: 'test' });
      expect(result.success).toBe(true);

      const task = await cloudTaskMQ.getTask(result.taskId!);
      expect(task?.status).toBe(TaskStatus.IDLE);

      const tasks = await cloudTaskMQ.getTasks({ queueName: 'integration-queue' });
      expect(tasks.some(t => t.id === result.taskId)).toBe(true);

      const count = await cloudTaskMQ.getTaskCount({ queueName: 'integration-queue' });
      expect(count).toBeGreaterThan(0);
    });
  });
});
