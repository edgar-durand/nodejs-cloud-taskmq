import 'reflect-metadata';

/**
 * Metadata key for cloud task consumer decorators
 */
export const CLOUD_TASK_CONSUMER_KEY = 'cloud_taskmq:cloud_task_consumer';

/**
 * CloudTask consumer options
 */
export interface CloudTaskConsumerOptions {
  /**
   * Queue name to consume tasks from
   */
  queueName: string;

  /**
   * HTTP endpoint path for receiving tasks
   */
  path?: string;

  /**
   * HTTP method for the endpoint
   */
  method?: 'POST' | 'GET' | 'PUT' | 'DELETE';

  /**
   * Maximum concurrent tasks
   */
  maxConcurrency?: number;

  /**
   * Task timeout in milliseconds
   */
  timeout?: number;

  /**
   * Custom headers to validate
   */
  headers?: Record<string, string>;
}

/**
 * Decorator for marking a class as a CloudTask consumer.
 * This decorator sets up HTTP endpoints for Google Cloud Tasks to call.
 *
 * @param options Consumer configuration options
 *
 * @example
 * ```typescript
 * @CloudTaskConsumer({
 *   queueName: 'email-queue',
 *   path: '/tasks/email',
 *   method: 'POST'
 * })
 * export class EmailTaskConsumer {
 *   async handleTask(taskData: any) {
 *     // Process the task
 *     return { success: true };
 *   }
 * }
 * ```
 */
export function CloudTaskConsumer(options: CloudTaskConsumerOptions) {
  return (target: any) => {
    Reflect.defineMetadata(CLOUD_TASK_CONSUMER_KEY, options, target);
  };
}
