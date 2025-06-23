/**
 * Task status enumeration
 */
export enum TaskStatus {
  IDLE = 'idle',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

/**
 * Basic task interface for storage
 */
export interface ITask {
  /**
   * Unique task identifier
   */
  id: string;

  /**
   * Queue name
   */
  queueName: string;

  /**
   * Task data payload
   */
  data: any;

  /**
   * Current task status
   */
  status: TaskStatus;

  /**
   * Task creation timestamp
   */
  createdAt: Date;

  /**
   * Task last update timestamp
   */
  updatedAt: Date;

  /**
   * Task completion timestamp
   */
  completedAt?: Date;

  /**
   * Task activation timestamp
   */
  activeAt?: Date;

  /**
   * Task failure timestamp
   */
  failedAt?: Date;

  /**
   * Number of retry attempts
   */
  attempts: number;

  /**
   * Maximum retry attempts allowed
   */
  maxAttempts: number;

  /**
   * Error information for failed tasks
   */
  error?: {
    message: string;
    stack?: string;
    timestamp: Date;
  };

  /**
   * Task progress information
   */
  progress?: {
    percentage: number;
    data?: any;
  };

  /**
   * Task result data
   */
  result?: any;

  /**
   * Task scheduling delay in seconds
   */
  delay?: number;

  /**
   * Task scheduled execution time
   */
  scheduledFor?: Date;

  /**
   * Task chain information
   */
  chain?: {
    id: string;
    index: number;
    total: number;
  };

  /**
   * Task uniqueness key
   */
  uniquenessKey?: string;

  /**
   * Task priority (higher number = higher priority)
   */
  priority?: number;

  /**
   * Custom task options
   */
  options?: {
    removeOnComplete?: boolean;
    removeOnFail?: boolean;
    priority?: number;
    [key: string]: any;
  };
}

/**
 * Task query options for filtering and pagination
 */
export interface TaskQueryOptions {
  /**
   * Filter by task status
   */
  status?: TaskStatus | TaskStatus[];

  /**
   * Filter by queue name
   */
  queueName?: string;

  /**
   * Filter by chain ID
   */
  chainId?: string;

  /**
   * Filter by uniqueness key
   */
  uniquenessKey?: string;

  /**
   * Date range filter
   */
  dateRange?: {
    from?: Date;
    to?: Date;
  };

  /**
   * Pagination limit
   */
  limit?: number;

  /**
   * Pagination offset
   */
  offset?: number;

  /**
   * Sort options
   */
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

/**
 * Storage adapter interface for state persistence
 */
export interface IStateStorageAdapter {
  /**
   * Initialize the storage adapter
   */
  initialize(): Promise<void>;

  /**
   * Save a task to storage
   */
  saveTask(task: ITask): Promise<void>;

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Promise<ITask | null>;

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: TaskStatus, updateData?: Partial<ITask>): Promise<void>;

  /**
   * Delete a task
   */
  deleteTask(taskId: string): Promise<boolean>;

  /**
   * Create a task
   */
  createTask(task: ITask): Promise<ITask>;

  /**
   * Get tasks with filtering options
   */
  getTasks(options?: TaskQueryOptions): Promise<ITask[]>;

  /**
   * Get task count with filtering options
   */
  getTaskCount(options?: TaskQueryOptions): Promise<number>;

  /**
   * Check if a uniqueness key is active
   */
  isUniquenessKeyActive(key: string): Promise<boolean>;

  /**
   * Set a uniqueness key as active
   */
  setUniquenessKeyActive(key: string, taskId: string, ttlSeconds?: number): Promise<void>;

  /**
   * Remove a uniqueness key
   */
  removeUniquenessKey(key: string): Promise<void>;

  /**
   * Get rate limit information
   */
  getRateLimit(key: string): Promise<{ count: number; resetTime: Date } | null>;

  /**
   * Increment rate limit counter
   * @param key Rate limit key
   * @param windowMs Window duration
   * @param maxRequests Maximum requests allowed
   * @returns Object with allowed status and current count
   */
  incrementRateLimit(key: string, windowMs: number, maxRequests: number): Promise<{ allowed: boolean; count: number; resetTime: Date }>;

  /**
   * Delete rate limit entry
   * @param key Rate limit key
   */
  deleteRateLimit?(key: string): Promise<void>;

  /**
   * Check if there are active tasks in chain
   */
  hasActiveTaskInChain(chainId: string): Promise<boolean>;

  /**
   * Get next task index in chain
   */
  getNextChainIndex(chainId: string): Promise<number>;

  /**
   * Clean up old tasks
   */
  cleanup(options?: {
    olderThan?: Date;
    statuses?: TaskStatus[];
    removeCompleted?: boolean;
    removeFailed?: boolean;
  }): Promise<number>;

  /**
   * Close the storage connection
   */
  close(): Promise<void>;
}
