import { CloudTask } from '../models/cloud-task.model';
import { ITask, TaskStatus } from '../interfaces/storage-adapter.interface';

describe('CloudTask', () => {
  let taskData: ITask;

  beforeEach(() => {
    taskData = {
      id: 'test-task-id',
      queueName: 'test-queue',
      data: { key: 'value' },
      status: TaskStatus.IDLE,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      maxAttempts: 3,
    };
  });

  describe('constructor', () => {
    it('should create CloudTask instance with task data', () => {
      const cloudTask = new CloudTask(taskData);
      
      expect(cloudTask.id).toBe(taskData.id);
      expect(cloudTask.queueName).toBe(taskData.queueName);
      expect(cloudTask.data).toEqual(taskData.data);
      expect(cloudTask.status).toBe(taskData.status);
      expect(cloudTask.attempts).toBe(taskData.attempts);
      expect(cloudTask.maxAttempts).toBe(taskData.maxAttempts);
    });
  });

  describe('status management', () => {
    it('should mark task as active', () => {
      const cloudTask = new CloudTask(taskData);
      cloudTask.markAsActive();
      
      expect(cloudTask.status).toBe(TaskStatus.ACTIVE);
      expect(cloudTask.updatedAt).toBeInstanceOf(Date);
    });

    it('should mark task as completed', () => {
      const cloudTask = new CloudTask(taskData);
      const result = { success: true };
      
      cloudTask.markAsCompleted(result);
      
      expect(cloudTask.status).toBe(TaskStatus.COMPLETED);
      expect(cloudTask.result).toEqual(result);
      expect(cloudTask.completedAt).toBeInstanceOf(Date);
      expect(cloudTask.updatedAt).toBeInstanceOf(Date);
    });

    it('should mark task as failed', () => {
      const cloudTask = new CloudTask(taskData);
      const error = new Error('Test error');
      
      cloudTask.markAsFailed(error);
      
      expect(cloudTask.status).toBe(TaskStatus.FAILED);
      expect(cloudTask.error).toEqual(expect.objectContaining({
        message: 'Test error',
        timestamp: expect.any(Date),
      }));
      expect(cloudTask.failedAt).toBeInstanceOf(Date);
      expect(cloudTask.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('attempts management', () => {
    it('should increment attempts', () => {
      const cloudTask = new CloudTask(taskData);
      
      cloudTask.incrementAttempts();
      
      expect(cloudTask.attempts).toBe(1);
      expect(cloudTask.updatedAt).toBeInstanceOf(Date);
    });

    it('should check if max attempts exceeded', () => {
      const cloudTask = new CloudTask({ ...taskData, attempts: 3, maxAttempts: 3 });
      
      expect(cloudTask.hasExceededMaxAttempts()).toBe(true);
    });

    it('should check if max attempts not exceeded', () => {
      const cloudTask = new CloudTask({ ...taskData, attempts: 2, maxAttempts: 3 });
      
      expect(cloudTask.hasExceededMaxAttempts()).toBe(false);
    });
  });

  describe('progress management', () => {
    it('should update progress', () => {
      const cloudTask = new CloudTask(taskData);
      const progress = { percentage: 50, data: { step: 'processing' } };
      
      cloudTask.updateProgress(progress);
      
      expect(cloudTask.progress).toEqual(progress);
      expect(cloudTask.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('chain management', () => {
    it('should detect if task is in chain', () => {
      const chainTask = new CloudTask({
        ...taskData,
        chain: { id: 'chain-123', index: 1, total: 3 },
      });
      
      expect(chainTask.isInChain()).toBe(true);
    });

    it('should detect if task is not in chain', () => {
      const cloudTask = new CloudTask(taskData);
      
      expect(cloudTask.isInChain()).toBe(false);
    });

    it('should detect if task is first in chain', () => {
      const firstTask = new CloudTask({
        ...taskData,
        chain: { id: 'chain-123', index: 0, total: 3 },
      });
      
      expect(firstTask.isFirstInChain()).toBe(true);
    });

    it('should detect if task is last in chain', () => {
      const lastTask = new CloudTask({
        ...taskData,
        chain: { id: 'chain-123', index: 2, total: 3 },
      });
      
      expect(lastTask.isLastInChain()).toBe(true);
    });

    it('should get next chain index', () => {
      const chainTask = new CloudTask({
        ...taskData,
        chain: { id: 'chain-123', index: 1, total: 3 },
      });
      
      expect(chainTask.getNextChainIndex()).toBe(2);
    });

    it('should return null for next chain index when last', () => {
      const lastTask = new CloudTask({
        ...taskData,
        chain: { id: 'chain-123', index: 2, total: 3 },
      });
      
      expect(lastTask.getNextChainIndex()).toBeNull();
    });
  });

  describe('cleanup options', () => {
    it('should check if task should be removed on complete', () => {
      const cloudTask = new CloudTask({
        ...taskData,
        options: { removeOnComplete: true },
      });
      
      expect(cloudTask.shouldRemoveOnComplete()).toBe(true);
    });

    it('should check if task should be removed on fail', () => {
      const cloudTask = new CloudTask({
        ...taskData,
        options: { removeOnFail: true },
      });
      
      expect(cloudTask.shouldRemoveOnFail()).toBe(true);
    });
  });

  describe('duration calculation', () => {
    it('should calculate duration for completed task', () => {
      const cloudTask = new CloudTask(taskData);
      
      // Mark as active first
      cloudTask.markAsActive();
      
      // Wait a bit and then complete
      setTimeout(() => {
        cloudTask.markAsCompleted({ success: true });
      }, 10);
      
      const duration = cloudTask.getDuration();
      if (duration !== null) {
        expect(duration).toBeGreaterThan(0);
      }
    });

    it('should return null for incomplete task', () => {
      const cloudTask = new CloudTask(taskData);
      const duration = cloudTask.getDuration();
      expect(duration).toBeNull();
    });
  });

  describe('task conversion', () => {
    it('should convert to ITask object', () => {
      const cloudTask = new CloudTask(taskData);
      const taskObject = cloudTask.toObject();
      
      expect(taskObject).toEqual(expect.objectContaining({
        id: taskData.id,
        queueName: taskData.queueName,
        data: taskData.data,
        status: taskData.status,
        attempts: taskData.attempts,
        maxAttempts: taskData.maxAttempts,
      }));
    });
  });

  describe('clone', () => {
    it('should create a copy of the task', () => {
      const cloudTask = new CloudTask(taskData);
      const cloned = CloudTask.fromObject(cloudTask.toObject());
      
      expect(cloned).not.toBe(cloudTask);
      expect(cloned.id).toBe(cloudTask.id);
      expect(cloned.data).toEqual(cloudTask.data);
      expect(cloned.queueName).toBe(cloudTask.queueName);
    });
  });
});
