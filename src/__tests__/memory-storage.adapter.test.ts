import { MemoryStorageAdapter } from '../adapters/memory-storage.adapter';
import { TaskStatus } from '../interfaces/storage-adapter.interface';

describe('MemoryStorageAdapter', () => {
  let adapter: MemoryStorageAdapter;

  beforeEach(async () => {
    adapter = new MemoryStorageAdapter();
    await adapter.initialize();
  });

  afterEach(async () => {
    await adapter.close();
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      const newAdapter = new MemoryStorageAdapter();
      await expect(newAdapter.initialize()).resolves.not.toThrow();
      await newAdapter.close();
    });
  });

  describe('task management', () => {
    const mockTask = {
      id: 'test-task-1',
      queueName: 'test-queue',
      taskName: 'test-task',
      data: { test: 'data' },
      status: TaskStatus.IDLE,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a task', async () => {
      const result = await adapter.createTask(mockTask);
      expect(result).toEqual(mockTask);
    });

    it('should get a task by id', async () => {
      await adapter.createTask(mockTask);
      const retrieved = await adapter.getTask(mockTask.id);
      expect(retrieved).toEqual(mockTask);
    });

    it('should return null for non-existent task', async () => {
      const retrieved = await adapter.getTask('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should update task status', async () => {
      await adapter.createTask(mockTask);
      const now = new Date();
      
      await adapter.updateTaskStatus(mockTask.id, TaskStatus.ACTIVE, {
        activeAt: now,
        updatedAt: now,
      });

      const updated = await adapter.getTask(mockTask.id);
      expect(updated?.status).toBe(TaskStatus.ACTIVE);
      expect(updated?.activeAt).toEqual(now);
      expect(updated?.updatedAt).toEqual(now);
    });

    it('should delete a task', async () => {
      await adapter.createTask(mockTask);
      const deleted = await adapter.deleteTask(mockTask.id);
      expect(deleted).toBe(true);

      const retrieved = await adapter.getTask(mockTask.id);
      expect(retrieved).toBeNull();
    });

    it('should return false when deleting non-existent task', async () => {
      const deleted = await adapter.deleteTask('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('task queries', () => {
    beforeEach(async () => {
      const tasks = [
        {
          id: 'task-1',
          queueName: 'queue-1',
          taskName: 'task-type-1',
          data: {},
          status: TaskStatus.IDLE,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date('2023-01-01'),
          updatedAt: new Date('2023-01-01'),
        },
        {
          id: 'task-2',
          queueName: 'queue-1',
          taskName: 'task-type-2',
          data: {},
          status: TaskStatus.ACTIVE,
          attempts: 1,
          maxAttempts: 3,
          createdAt: new Date('2023-01-02'),
          updatedAt: new Date('2023-01-02'),
        },
        {
          id: 'task-3',
          queueName: 'queue-2',
          taskName: 'task-type-1',
          data: {},
          status: TaskStatus.COMPLETED,
          attempts: 1,
          maxAttempts: 3,
          createdAt: new Date('2023-01-03'),
          updatedAt: new Date('2023-01-03'),
        },
      ];

      for (const task of tasks) {
        await adapter.createTask(task);
      }
    });

    it('should get all tasks', async () => {
      const tasks = await adapter.getTasks();
      expect(tasks).toHaveLength(3);
    });

    it('should filter tasks by status', async () => {
      const activeTasks = await adapter.getTasks({
        status: [TaskStatus.ACTIVE],
      });
      expect(activeTasks).toHaveLength(1);
      expect(activeTasks[0].id).toBe('task-2');
    });

    it('should filter tasks by queue name', async () => {
      const queue1Tasks = await adapter.getTasks({
        queueName: 'queue-1',
      });
      expect(queue1Tasks).toHaveLength(2);
    });

    it('should limit results', async () => {
      const limitedTasks = await adapter.getTasks({
        limit: 2,
      });
      expect(limitedTasks).toHaveLength(2);
    });

    it('should offset results', async () => {
      const offsetTasks = await adapter.getTasks({
        offset: 1,
        limit: 2,
      });
      expect(offsetTasks).toHaveLength(2);
      expect(offsetTasks[0].id).not.toBe('task-1');
    });

    it('should sort tasks', async () => {
      const sortedTasks = await adapter.getTasks({
        sort: { field: 'createdAt', order: 'desc' },
      });
      expect(sortedTasks[0].id).toBe('task-3');
      expect(sortedTasks[2].id).toBe('task-1');
    });

    it('should count tasks', async () => {
      const count = await adapter.getTaskCount();
      expect(count).toBe(3);
    });

    it('should count tasks with filters', async () => {
      const count = await adapter.getTaskCount({
        status: [TaskStatus.IDLE, TaskStatus.ACTIVE],
      });
      expect(count).toBe(2);
    });
  });

  describe('uniqueness keys', () => {
    it('should check if uniqueness key exists', async () => {
      const exists = await adapter.hasUniquenessKey('test-key');
      expect(exists).toBe(false);
    });

    it('should add uniqueness key', async () => {
      const added = await adapter.addUniquenessKey('test-key', 'task-123');
      expect(added).toBe(true);

      const exists = await adapter.hasUniquenessKey('test-key');
      expect(exists).toBe(true);
    });

    it('should not add duplicate uniqueness key', async () => {
      await adapter.addUniquenessKey('test-key', 'task-123');
      const added = await adapter.addUniquenessKey('test-key', 'task-456');
      expect(added).toBe(false);
    });

    it('should remove uniqueness key', async () => {
      await adapter.addUniquenessKey('test-key', 'task-123');
      await adapter.removeUniquenessKey('test-key');

      const exists = await adapter.hasUniquenessKey('test-key');
      expect(exists).toBe(false);
    });

    it('should get uniqueness key info', async () => {
      const now = new Date();
      await adapter.addUniquenessKey('test-key', 'task-123');
      
      const info = await adapter.getUniquenessKeyInfo('test-key');
      expect(info?.taskId).toBe('task-123');
      expect(info?.expiresAt).toBeInstanceOf(Date);
    });
  });

  describe('rate limiting', () => {
    it('should increment rate limit', async () => {
      const result = await adapter.incrementRateLimit('test-key', 60000, 10);
      expect(result.allowed).toBe(true);
      expect(result.count).toBe(1);
      expect(result.resetTime).toBeInstanceOf(Date);
    });

    it('should enforce rate limit', async () => {
      // Fill the limit
      for (let i = 0; i < 10; i++) {
        const result = await adapter.incrementRateLimit('test-key', 60000, 10);
        expect(result.allowed).toBe(true);
        expect(result.count).toBe(i + 1);
      }

      // Next request should be denied
      const denied = await adapter.incrementRateLimit('test-key', 60000, 10);
      expect(denied.allowed).toBe(false);
      expect(denied.count).toBe(10);
    });

    it('should get rate limit info', async () => {
      await adapter.incrementRateLimit('test-key', 60000, 10);
      
      const info = await adapter.getRateLimit('test-key');
      expect(info?.count).toBe(1);
      expect(info?.resetTime).toBeInstanceOf(Date);
    });

    it('should reset rate limit after window', async () => {
      // Use very short window for testing
      await adapter.incrementRateLimit('test-key', 1, 1); // 1ms window, 1 request max
      
      // Wait for window to expire
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Should allow new request
      const allowed = await adapter.incrementRateLimit('test-key', 60000, 1);
      expect(allowed.allowed).toBe(true);
    });
  });

  describe('chain management', () => {
    beforeEach(async () => {
      const chainTasks = [
        {
          id: 'chain-task-1',
          queueName: 'test-queue',
          taskName: 'test-task',
          data: {},
          status: TaskStatus.COMPLETED,
          attempts: 1,
          maxAttempts: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          chain: { id: 'chain-123', index: 0, total: 3 },
        },
        {
          id: 'chain-task-2',
          queueName: 'test-queue',
          taskName: 'test-task',
          data: {},
          status: TaskStatus.IDLE,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          chain: { id: 'chain-123', index: 1, total: 3 },
        },
        {
          id: 'chain-task-3',
          queueName: 'test-queue',
          taskName: 'test-task',
          data: {},
          status: TaskStatus.IDLE,
          attempts: 0,
          maxAttempts: 3,
          createdAt: new Date(),
          updatedAt: new Date(),
          chain: { id: 'chain-123', index: 2, total: 3 },
        },
      ];

      for (const task of chainTasks) {
        await adapter.createTask(task);
      }
    });

    it('should get chain tasks', async () => {
      const chainTasks = await adapter.getChainTasks('chain-123');
      expect(chainTasks).toHaveLength(3);
      expect(chainTasks[0].chain?.index).toBe(0);
      expect(chainTasks[1].chain?.index).toBe(1);
      expect(chainTasks[2].chain?.index).toBe(2);
    });

    it('should get next task in chain', async () => {
      const nextTask = await adapter.getNextTaskInChain('chain-123', 0);
      expect(nextTask?.id).toBe('chain-task-2');
      expect(nextTask?.chain?.index).toBe(1);
    });

    it('should return null for last task in chain', async () => {
      const nextTask = await adapter.getNextTaskInChain('chain-123', 2);
      expect(nextTask).toBeNull();
    });
  });

  describe('cleanup', () => {
    beforeEach(async () => {
      const oldDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
      const newDate = new Date();

      const tasks = [
        {
          id: 'old-completed',
          queueName: 'test-queue',
          taskName: 'test-task',
          data: {},
          status: TaskStatus.COMPLETED,
          attempts: 1,
          maxAttempts: 3,
          createdAt: oldDate,
          updatedAt: oldDate,
          completedAt: oldDate,
        },
        {
          id: 'old-failed',
          queueName: 'test-queue',
          taskName: 'test-task',
          data: {},
          status: TaskStatus.FAILED,
          attempts: 3,
          maxAttempts: 3,
          createdAt: oldDate,
          updatedAt: oldDate,
          failedAt: oldDate,
        },
        {
          id: 'new-completed',
          queueName: 'test-queue',
          taskName: 'test-task',
          data: {},
          status: TaskStatus.COMPLETED,
          attempts: 1,
          maxAttempts: 3,
          createdAt: newDate,
          updatedAt: newDate,
          completedAt: newDate,
        },
      ];

      for (const task of tasks) {
        await adapter.createTask(task);
      }
    });

    it('should cleanup old completed tasks', async () => {
      const cleaned = await adapter.cleanup({
        olderThan: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        removeCompleted: true,
      });

      expect(cleaned).toBe(1);
      
      const remaining = await adapter.getTasks();
      expect(remaining).toHaveLength(2);
      expect(remaining.find(t => t.id === 'old-completed')).toBeUndefined();
    });

    it('should cleanup old failed tasks', async () => {
      const cleaned = await adapter.cleanup({
        olderThan: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
        removeFailed: true,
      });

      expect(cleaned).toBe(1);
      
      const remaining = await adapter.getTasks();
      expect(remaining).toHaveLength(2);
      expect(remaining.find(t => t.id === 'old-failed')).toBeUndefined();
    });

    it('should cleanup by status', async () => {
      const cleaned = await adapter.cleanup({
        statuses: [TaskStatus.COMPLETED],
      });

      expect(cleaned).toBe(2); // Both completed tasks
      
      const remaining = await adapter.getTasks();
      expect(remaining).toHaveLength(1);
      expect(remaining[0].status).toBe(TaskStatus.FAILED);
    });
  });
});
