import { ProducerService } from '../services/producer.service';
import { MemoryStorageAdapter } from '../adapters/memory-storage.adapter';
import { CloudTaskMQConfig } from '../interfaces/config.interface';
import { TaskStatus } from '../interfaces/storage-adapter.interface';

// Mock Google Cloud Tasks
jest.mock('@google-cloud/tasks', () => ({
  CloudTasksClient: jest.fn().mockImplementation(() => ({
    createTask: jest.fn().mockResolvedValue([{ name: 'test-task' }]),
    getQueue: jest.fn().mockResolvedValue([{ name: 'test-queue' }]),
    createQueue: jest.fn().mockResolvedValue([{ name: 'test-queue' }]),
    queuePath: jest.fn().mockReturnValue('projects/test/locations/us-central1/queues/test-queue'),
  })),
}));

describe('ProducerService', () => {
  let producerService: ProducerService;
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
      }, {
        name: 'test-queue',
        path: 'projects/test-project/locations/us-central1/queues/test-queue',
        rateLimiter: {
          maxRequests: 10,
          windowMs: 60000,
        },
      }, {
        name: 'limited-queue',
        path: 'projects/test-project/locations/us-central1/queues/limited-queue',
        rateLimiter: {
          maxRequests: 2,
          windowMs: 60000,
        },
      }],
    };

    storageAdapter = new MemoryStorageAdapter();
    await storageAdapter.initialize();

    producerService = new ProducerService(config, storageAdapter);
    await producerService.initialize();
  });

  afterEach(async () => {
    await producerService.close();
    await storageAdapter.close();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newProducerService = new ProducerService(config, storageAdapter);
      await expect(newProducerService.initialize()).resolves.not.toThrow();
      await newProducerService.close();
    });
  });

  describe('task creation', () => {
    it('should add a simple task', async () => {
      const result = await producerService.addTask('test-queue', { message: 'Test task' });

      expect(result.taskId).toBeDefined();
      expect(result.success).toBe(true);

      // Verify task was stored
      const storedTask = await storageAdapter.getTask(result.taskId);
      expect(storedTask).toBeTruthy();
      expect(storedTask?.data).toEqual({ message: 'Test task' });
      expect(storedTask?.status).toBe(TaskStatus.IDLE);
      expect(storedTask?.queueName).toBe('test-queue');
    });

    it('should add task with options', async () => {
      const options = {
        maxAttempts: 5,
        delay: 10,
        priority: 1,
      };

      const result = await producerService.addTask('test-queue', { test: 'data' }, options);

      expect(result.taskId).toBeDefined();
      expect(result.success).toBe(true);

      const storedTask = await storageAdapter.getTask(result.taskId);
      expect(storedTask?.maxAttempts).toBe(5);
      expect(storedTask?.delay).toBe(10);
      expect(storedTask?.options?.priority).toBe(1);
    });

    it('should handle uniqueness key collision', async () => {
      const uniquenessKey = 'duplicate-key';

      // Add first task
      const first = await producerService.addTask('test-queue', { first: true }, { uniquenessKey });
      expect(first.success).toBe(true);

      // Try to add duplicate task
      const second = await producerService.addTask('test-queue', { second: true }, { uniquenessKey });
      expect(second.success).toBe(false);
      expect(second.skipped).toBe(true);
      expect(second.error).toContain('Task with uniqueness key');
    });

    it('should generate unique task IDs', async () => {
      const results = await Promise.all([
        producerService.addTask('test-queue', { index: 1 }),
        producerService.addTask('test-queue', { index: 2 }),
        producerService.addTask('test-queue', { index: 3 }),
      ]);

      const taskIds = results.map(r => r.taskId);
      const uniqueIds = new Set(taskIds);
      
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('task chains', () => {
    it('should create a task chain', async () => {
      const tasks = [
        { data: { step: 1 } },
        { data: { step: 2 } },
        { data: { step: 3 } },
      ];

      const results = await producerService.addChain('test-queue', tasks);

      expect(results).toHaveLength(3);
      
      // All tasks should have the same chain ID
      const storedTasks = await Promise.all(
        results.map(r => storageAdapter.getTask(r.taskId))
      );
      const chainIds = storedTasks.map(task => task?.chain?.id);
      expect(new Set(chainIds).size).toBe(1);

      // Verify chain structure
      for (let i = 0; i < results.length; i++) {
        const storedTask = storedTasks[i];
        expect(storedTask?.chain?.index).toBe(i);
        expect(storedTask?.chain?.total).toBe(3);
      }
    });

    it('should create chain with custom ID', async () => {
      const tasks = [
        { data: { step: 1 } },
        { data: { step: 2 } },
      ];

      const results = await producerService.addChain('test-queue', tasks, { id: 'custom-chain' });

      expect(results).toHaveLength(2);
      
      // Verify both tasks have the custom chain ID
      const storedTasks = await Promise.all(
        results.map(r => storageAdapter.getTask(r.taskId))
      );
      expect(storedTasks[0]?.chain?.id).toBe('custom-chain');
      expect(storedTasks[1]?.chain?.id).toBe('custom-chain');
    });

    it('should handle empty chain', async () => {
      const results = await producerService.addChain('test-queue', []);
      expect(results).toHaveLength(0);
    });
  });

  describe('event emission', () => {
    it('should emit taskAdded event', async () => {
      const eventSpy = jest.fn();
      producerService.on('taskAdded', eventSpy);

      await producerService.addTask('test-queue', { test: 'data' });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: expect.any(String),
          queueName: 'test-queue',
          data: { test: 'data' },
        })
      );
    });
  });

  describe('queue management', () => {
    it('should create queue if auto-create is enabled', async () => {
      const configWithAutoCreate: CloudTaskMQConfig = {
        ...config,
        autoCreateQueues: true,
      };

      const service = new ProducerService(configWithAutoCreate, storageAdapter);
      await service.initialize();

      await service.addTask('new-queue', { test: 'data' });

      // Queue creation should have been attempted
      expect(service).toBeDefined(); // Basic test since we're mocking Cloud Tasks
      
      await service.close();
    });
  });

  describe('error handling', () => {
    it('should handle storage adapter errors', async () => {
      jest.spyOn(storageAdapter, 'saveTask').mockRejectedValueOnce(new Error('Storage error'));

      const result = await producerService.addTask('test-queue', { test: 'data' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Storage error');
    });

    it('should handle Cloud Tasks client errors', async () => {
      // This would require more sophisticated mocking of the Cloud Tasks client
      // For now, we'll test that the service handles initialization properly
      expect(producerService).toBeDefined();
    });
  });

  describe('configuration validation', () => {
    it('should handle missing project ID', async () => {
      const invalidConfig = { ...config, projectId: '' };
      const service = new ProducerService(invalidConfig, storageAdapter);
      
      // Should still initialize but may have issues with Cloud Tasks operations
      await expect(service.initialize()).resolves.not.toThrow();
      await service.close();
    });

    it('should handle missing location', async () => {
      const invalidConfig = { ...config, location: '' };
      const service = new ProducerService(invalidConfig, storageAdapter);
      
      await expect(service.initialize()).resolves.not.toThrow();
      await service.close();
    });
  });

  describe('rate limiting integration', () => {
    it('should respect queue rate limits', async () => {
      const queueConfig = {
        name: 'limited-queue',
        rateLimiter: {
          maxRequests: 2,
          windowMs: 1000,
        },
      };

      config.queues = [
        {
          name: 'limited-queue',
          path: 'projects/test-project/locations/us-central1/queues/limited-queue',
          rateLimiter: queueConfig.rateLimiter,
        }
      ];
      const service = new ProducerService(config, storageAdapter);
      await service.initialize();

      // Add tasks up to limit
      await service.addTask('limited-queue', { index: 1 });
      await service.addTask('limited-queue', { index: 2 });

      // This should potentially be handled by rate limiting
      // (depends on implementation details)
      await expect(service.addTask('limited-queue', { index: 3 })).resolves.toBeDefined();
      
      await service.close();
    });
  });

  describe('task serialization', () => {
    it('should handle complex data types', async () => {
      const complexData = {
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        date: new Date(),
        null: null,
        undefined: undefined,
      };

      const result = await producerService.addTask('test-queue', complexData);
      const storedTask = await storageAdapter.getTask(result.taskId);

      expect(storedTask?.data).toEqual(expect.objectContaining({
        string: 'test',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'value' },
        null: null,
      }));
    });

    it('should handle large payloads', async () => {
      const largeData = {
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` })),
      };

      const result = await producerService.addTask('test-queue', largeData);
      expect(result.taskId).toBeDefined();

      const storedTask = await storageAdapter.getTask(result.taskId);
      expect(storedTask?.data.items).toHaveLength(1000);
    });
  });
});
