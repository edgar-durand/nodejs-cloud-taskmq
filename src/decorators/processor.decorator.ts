import 'reflect-metadata';

/**
 * Metadata key for processor decorators
 */
export const PROCESSOR_QUEUE_KEY = 'cloud_taskmq:processor_queue';

/**
 * Metadata key for processor metadata
 */
export const PROCESSOR_METADATA_KEY = 'cloud_taskmq:processor_metadata';

/**
 * Processor options
 */
export interface ProcessorOptions {
  /**
   * Concurrency limit (how many tasks can be processed simultaneously)
   */
  concurrency?: number;

  /**
   * Custom handler name (if different than the method name)
   */
  name?: string;

  /**
   * Queue-specific options
   */
  queueOptions?: {
    /**
     * Maximum number of retries for failed tasks
     */
    maxRetries?: number;

    /**
     * Retry delay in seconds
     */
    retryDelay?: number;
  };
}

/**
 * Marks a class as a task processor for a specific queue.
 * This processor will handle tasks from the specified queue name.
 *
 * @param queueName Name of the queue to process tasks from
 * @param options Additional processor options
 *
 * @example
 * ```typescript
 * @Processor('email-queue')
 * export class EmailProcessor {
 *   @Process()
 *   async handleEmailTask(job: CloudTask<EmailData>) {
 *     // Process the email task
 *   }
 * }
 * ```
 */
export function Processor(queueName: string, options: ProcessorOptions = {}) {
  return (target: any) => {
    Reflect.defineMetadata(PROCESSOR_QUEUE_KEY, queueName, target);
    Reflect.defineMetadata(PROCESSOR_METADATA_KEY, options, target);
  };
}
