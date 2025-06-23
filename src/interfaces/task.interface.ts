export { ITask, TaskStatus } from './storage-adapter.interface';

/**
 * Options for adding a task to the queue
 */
export interface AddTaskOptions {
  /**
   * Task execution delay in seconds
   */
  delay?: number;

  /**
   * Maximum number of retry attempts
   */
  maxAttempts?: number;

  /**
   * Task priority (higher number = higher priority)
   */
  priority?: number;

  /**
   * Remove task when completed
   */
  removeOnComplete?: boolean;

  /**
   * Remove task when failed
   */
  removeOnFail?: boolean;

  /**
   * Uniqueness key to prevent duplicate tasks
   */
  uniquenessKey?: string;

  /**
   * Chain options for task chaining
   */
  chain?: ChainOptions;

  /**
   * Custom task options
   */
  [key: string]: any;
}

/**
 * Result of adding a task to the queue
 */
export interface AddTaskResult {
  /**
   * Generated task ID
   */
  taskId: string;

  /**
   * Whether the task was successfully added
   */
  success: boolean;

  /**
   * Error message if task was not added
   */
  error?: string;

  /**
   * Whether the task was skipped due to uniqueness key
   */
  skipped?: boolean;
}

/**
 * Chain options for sequential task execution
 */
export interface ChainOptions {
  /**
   * Chain identifier
   */
  id: string;

  /**
   * Task index in the chain (0-based)
   */
  index?: number;

  /**
   * Total number of tasks in the chain
   */
  total?: number;

  /**
   * Wait for previous task completion
   */
  waitForPrevious?: boolean;
}

/**
 * Task progress information
 */
export interface TaskProgress {
  /**
   * Progress percentage (0-100)
   */
  percentage: number;

  /**
   * Additional progress data
   */
  data?: any;
}

/**
 * Task event data
 */
export interface TaskEvent<T = any> {
  /**
   * Task ID
   */
  taskId: string;

  /**
   * Queue name
   */
  queueName: string;

  /**
   * Task data
   */
  data: T;

  /**
   * Event timestamp
   */
  timestamp: Date;

  /**
   * Additional event data
   */
  metadata?: any;
}

/**
 * Task completion event data
 */
export interface TaskCompletedEvent<T = any> extends TaskEvent<T> {
  /**
   * Task result
   */
  result: any;

  /**
   * Task duration in milliseconds
   */
  duration: number;
}

/**
 * Task failure event data
 */
export interface TaskFailedEvent<T = any> extends TaskEvent<T> {
  /**
   * Error information
   */
  error: {
    message: string;
    stack?: string;
  };

  /**
   * Number of attempts made
   */
  attempts: number;

  /**
   * Maximum attempts allowed
   */
  maxAttempts: number;

  /**
   * Whether this was the final attempt
   */
  isFinalAttempt: boolean;
}

/**
 * Task progress event data
 */
export interface TaskProgressEvent<T = any> extends TaskEvent<T> {
  /**
   * Progress information
   */
  progress: TaskProgress;
}
