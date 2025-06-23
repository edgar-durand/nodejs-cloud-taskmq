import { CloudTaskMQ, createCloudTaskMQ, Processor, Process, MemoryStorageAdapter } from '../index';
import { CloudTask } from '../models/cloud-task.model';

// Test processor
@Processor('test-queue')
class TestProcessor {
  @Process({ name: 'test-task' })
  async testTask(task: CloudTask) {
    return { processed: true, data: task.data };
  }

  @Process({ name: 'error-task' })
  async errorTask(task: CloudTask) {
    throw new Error('Test error');
  }
}

describe('CloudTaskMQ', () => {
  let taskMQ: CloudTaskMQ;
  let testProcessor: TestProcessor;

  beforeEach(async () => {
    taskMQ = createCloudTaskMQ({
      projectId: 'test-project',
      location: 'us-central1',
      storageAdapter: 'memory',
      queues: [{
        name: 'test-queue',
        path: 'projects/test-project/locations/us-central1/queues/test-queue',
      }],
    });

    await taskMQ.initialize();
    
    testProcessor = new TestProcessor();
    taskMQ.registerProcessor(testProcessor);
  });

  afterEach(async () => {
    await taskMQ.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(taskMQ.isInitialized()).toBe(true);
    });

    it('should have the correct configuration', () => {
      const config = taskMQ.getConfig();
      expect(config.projectId).toBe('test-project');
      expect(config.location).toBe('us-central1');
      expect(config.storageAdapter).toBe('memory');
    });
  });

  describe('Task Management', () => {
    it('should add a task successfully', async () => {
      const result = await taskMQ.addTask('test-queue', {
        message: 'Hello World',
      }, {
        taskName: 'test-task',
        maxAttempts: 3,
      });

      expect(result.taskId).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should get a task by ID', async () => {
      const addResult = await taskMQ.addTask('test-queue', {
        message: 'Hello World',
      });

      const task = await taskMQ.getTask(addResult.taskId);
      expect(task).toBeDefined();
      expect(task!.id).toBe(addResult.taskId);
      expect(task!.data.message).toBe('Hello World');
    });

    it('should list tasks', async () => {
      await taskMQ.addTask('test-queue', { message: 'Task 1' });
      await taskMQ.addTask('test-queue', { message: 'Task 2' });

      const tasks = await taskMQ.getTasks();
      expect(tasks.length).toBeGreaterThanOrEqual(2);
    });

    it('should count tasks', async () => {
      const initialCount = await taskMQ.getTaskCount();
      
      await taskMQ.addTask('test-queue', { message: 'Task 1' });
      await taskMQ.addTask('test-queue', { message: 'Task 2' });

      const newCount = await taskMQ.getTaskCount();
      expect(newCount).toBe(initialCount + 2);
    });
  });

  describe('Task Processing', () => {
    it('should process a task successfully', async () => {
      const addResult = await taskMQ.addTask('test-queue', {
        message: 'Process me',
      }, {
        taskName: 'test-task',
      });

      const processResult = await taskMQ.processTask({
        taskId: addResult.taskId,
        queueName: 'test-queue',
        data: { message: 'Process me' },
        attempts: 0,
        maxAttempts: 3,
      });

      expect(processResult.processed).toBe(true);
      expect(processResult.data.message).toBe('Process me');

      // Check task status
      const task = await taskMQ.getTask(addResult.taskId);
      expect(task!.status).toBeDefined();
    });

    it('should handle task processing errors', async () => {
      const addResult = await taskMQ.addTask('test-queue', {
        message: 'Error me',
      }, {
        taskName: 'error-task',
        maxAttempts: 1,
      });

      await expect(taskMQ.processTask({
        taskId: addResult.taskId,
        queueName: 'test-queue',
        data: { message: 'Error me' },
        attempts: 0,
        maxAttempts: 1,
      })).rejects.toThrow('Test error');

      // Check task status
      const task = await taskMQ.getTask(addResult.taskId);
      expect(task!.status).toBeDefined();
    });
  });

  describe('Task Chains', () => {
    it('should create a task chain', async () => {
      const tasks = [
        { data: { step: 1 } },
        { data: { step: 2 } },
        { data: { step: 3 } },
      ];

      const chainResults = await taskMQ.addChain('test-queue', tasks);

      expect(chainResults).toHaveLength(3);
      
      // All tasks should have the same chain ID
      const storedTasks = await Promise.all(
        chainResults.map(result => taskMQ.getTask(result.taskId))
      );
      const chainIds = storedTasks.map(task => task?.chain?.id);
      expect(new Set(chainIds).size).toBe(1);
      
      chainResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(storedTasks[index]?.chain?.index).toBe(index);
        expect(storedTasks[index]?.chain?.total).toBe(3);
      });
    });
  });

  describe('Uniqueness Keys', () => {
    it('should prevent duplicate tasks with same uniqueness key', async () => {
      const uniquenessKey = 'unique-task-123';

      // Add first task
      const result1 = await taskMQ.addTask('test-queue', { 
        message: 'First task' 
      }, { uniquenessKey });

      expect(result1.success).toBe(true);
      expect(result1.taskId).toBeDefined();

      // Try to add second task with same uniqueness key
      const result2 = await taskMQ.addTask('test-queue', { 
        message: 'Duplicate task' 
      }, { uniquenessKey });

      // Second task should be rejected
      expect(result2.success).toBe(false);
      expect(result2.skipped).toBe(true);
      expect(result2.error).toContain('uniqueness key');
    });
  });

  describe('Rate Limiting', () => {
    it('should check rate limits', async () => {
      const rateLimitResult = await taskMQ.checkRateLimit('test-key', {
        maxRequests: 5,
        windowMs: 60000,
      });

      expect(rateLimitResult.allowed).toBe(true);
      expect(rateLimitResult.count).toBe(1);
      expect(rateLimitResult.limit).toBe(5);
      expect(rateLimitResult.remaining).toBe(4);
    });

    it('should enforce rate limits', async () => {
      const key = 'rate-limit-test';
      const options = { maxRequests: 2, windowMs: 60000 };

      // First two requests should be allowed
      let result = await taskMQ.checkRateLimit(key, options);
      expect(result.allowed).toBe(true);

      result = await taskMQ.checkRateLimit(key, options);
      expect(result.allowed).toBe(true);

      // Third request should be blocked
      result = await taskMQ.checkRateLimit(key, options);
      expect(result.allowed).toBe(false);
    });
  });

  describe('Storage Adapters', () => {
    it('should use memory storage adapter', () => {
      const storageAdapter = taskMQ.getStorageAdapter();
      expect(storageAdapter).toBeInstanceOf(MemoryStorageAdapter);
    });
  });

  describe('Events', () => {
    it('should emit taskCompleted event', async () => {
      const eventPromise = new Promise((resolve) => {
        taskMQ.once('taskCompleted', resolve);
      });

      const addResult = await taskMQ.addTask('test-queue', {
        message: 'Event test',
      }, {
        taskName: 'test-task',
      });

      await taskMQ.processTask({
        taskId: addResult.taskId,
        queueName: 'test-queue',
        data: { message: 'Event test' },
        attempts: 0,
        maxAttempts: 3,
      });

      const event = await eventPromise;
      expect(event).toBeDefined();
    });

    it('should emit taskFailed event', async () => {
      const eventPromise = new Promise((resolve) => {
        taskMQ.once('taskFailed', resolve);
      });

      const addResult = await taskMQ.addTask('test-queue', {
        message: 'Error test',
      }, {
        taskName: 'error-task',
        maxAttempts: 1,
      });

      try {
        await taskMQ.processTask({
          taskId: addResult.taskId,
          queueName: 'test-queue',
          data: { message: 'Error test' },
          attempts: 0,
          maxAttempts: 1,
        });
      } catch (error) {
        // Expected error
      }

      const event = await eventPromise;
      expect(event).toBeDefined();
    });
  });

  describe('Cleanup', () => {
    it('should cleanup old tasks', async () => {
      // Add some tasks
      await taskMQ.addTask('test-queue', { message: 'Task 1' });
      await taskMQ.addTask('test-queue', { message: 'Task 2' });

      const initialCount = await taskMQ.getTaskCount();
      expect(initialCount).toBeGreaterThanOrEqual(2);

      // Cleanup (this won't clean much in a new test, but tests the method)
      const cleanedCount = await taskMQ.cleanup({
        olderThan: new Date(Date.now() + 1000), // Future date to clean all
        removeCompleted: true,
        removeFailed: true,
      });

      expect(typeof cleanedCount).toBe('number');
    });
  });
});
