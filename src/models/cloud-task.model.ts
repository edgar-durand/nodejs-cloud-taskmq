import { ITask, TaskStatus } from '../interfaces/storage-adapter.interface';
import { TaskProgress } from '../interfaces/task.interface';

/**
 * CloudTask model representing a task in the queue system
 */
export class CloudTask<T = any> {
  public readonly id: string;
  public readonly queueName: string;
  public readonly data: T;
  public status: TaskStatus;
  public readonly createdAt: Date;
  public updatedAt: Date;
  public completedAt?: Date;
  public failedAt?: Date;
  public attempts: number;
  public readonly maxAttempts: number;
  public error?: { message: string; stack?: string; timestamp: Date };
  public progress?: { percentage: number; data?: any };
  public result?: any;
  public readonly delay?: number;
  public readonly scheduledFor?: Date;
  public readonly chain?: { id: string; index: number; total: number };
  public readonly uniquenessKey?: string;
  public readonly options?: { removeOnComplete?: boolean; removeOnFail?: boolean; priority?: number; [key: string]: any };

  constructor(task: ITask) {
    this.id = task.id;
    this.queueName = task.queueName;
    this.data = task.data;
    this.status = task.status;
    this.createdAt = task.createdAt;
    this.updatedAt = task.updatedAt;
    this.completedAt = task.completedAt;
    this.failedAt = task.failedAt;
    this.attempts = task.attempts;
    this.maxAttempts = task.maxAttempts;
    this.error = task.error;
    this.progress = task.progress;
    this.result = task.result;
    this.delay = task.delay;
    this.scheduledFor = task.scheduledFor;
    this.chain = task.chain;
    this.uniquenessKey = task.uniquenessKey;
    this.options = task.options;
  }

  /**
   * Update task progress
   */
  updateProgress(progress: TaskProgress): void {
    this.progress = {
      percentage: Math.max(0, Math.min(100, progress.percentage)),
      data: progress.data,
    };
    this.updatedAt = new Date();
  }

  /**
   * Mark task as active
   */
  markAsActive(): void {
    this.status = TaskStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  /**
   * Mark task as completed
   */
  markAsCompleted(result?: any): void {
    this.status = TaskStatus.COMPLETED;
    this.result = result;
    this.completedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Mark task as failed
   */
  markAsFailed(error: Error | string): void {
    this.status = TaskStatus.FAILED;
    this.error = {
      message: typeof error === 'string' ? error : error.message,
      stack: typeof error === 'string' ? undefined : error.stack,
      timestamp: new Date(),
    };
    this.failedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Increment attempt counter
   */
  incrementAttempts(): void {
    this.attempts++;
    this.updatedAt = new Date();
  }

  /**
   * Check if task has exceeded maximum attempts
   */
  hasExceededMaxAttempts(): boolean {
    return this.attempts >= this.maxAttempts;
  }

  /**
   * Check if task is in a chain
   */
  isInChain(): boolean {
    return !!this.chain;
  }

  /**
   * Check if task is the first in chain
   */
  isFirstInChain(): boolean {
    return this.chain?.index === 0;
  }

  /**
   * Check if task is the last in chain
   */
  isLastInChain(): boolean {
    return this.chain ? this.chain.index === this.chain.total - 1 : false;
  }

  /**
   * Get next task index in chain
   */
  getNextChainIndex(): number | null {
    if (!this.chain || this.isLastInChain()) {
      return null;
    }
    return this.chain.index + 1;
  }

  /**
   * Check if task should be removed on completion
   */
  shouldRemoveOnComplete(): boolean {
    return this.options?.removeOnComplete ?? false;
  }

  /**
   * Check if task should be removed on failure
   */
  shouldRemoveOnFail(): boolean {
    return this.options?.removeOnFail ?? false;
  }

  /**
   * Get task priority
   */
  getPriority(): number {
    return this.options?.priority ?? 0;
  }

  /**
   * Get task age in milliseconds
   */
  getAge(): number {
    return Date.now() - this.createdAt.getTime();
  }

  /**
   * Get task duration (if completed or failed)
   */
  getDuration(): number | null {
    const endTime = this.completedAt || this.failedAt;
    if (!endTime) {
      return null;
    }
    return endTime.getTime() - this.createdAt.getTime();
  }

  /**
   * Convert to plain object
   */
  toObject(): ITask {
    return {
      id: this.id,
      queueName: this.queueName,
      data: this.data,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      completedAt: this.completedAt,
      failedAt: this.failedAt,
      attempts: this.attempts,
      maxAttempts: this.maxAttempts,
      error: this.error,
      progress: this.progress,
      result: this.result,
      delay: this.delay,
      scheduledFor: this.scheduledFor,
      chain: this.chain,
      uniquenessKey: this.uniquenessKey,
      options: this.options,
    };
  }

  /**
   * Create CloudTask from plain object
   */
  static fromObject<T = any>(obj: ITask): CloudTask<T> {
    return new CloudTask<T>(obj);
  }
}
