import 'reflect-metadata';

/**
 * Metadata key for process decorators
 */
export const PROCESS_METADATA_KEY = 'cloud_taskmq:process_metadata';

/**
 * Process options
 */
export interface ProcessOptions {
  /**
   * Process name (if different from method name)
   */
  name?: string;

  /**
   * Concurrency limit for this specific process
   */
  concurrency?: number;
}

/**
 * Marks a method as a task processor.
 * This method will be called to process tasks from the queue.
 *
 * @param options Process options
 *
 * @example
 * ```typescript
 * @Processor('email-queue')
 * export class EmailProcessor {
 *   @Process({ name: 'send-email' })
 *   async handleEmailTask(job: CloudTask<EmailData>) {
 *     // Process the email task
 *     return { success: true };
 *   }
 * }
 * ```
 */
export function Process(options: ProcessOptions = {}) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const existingProcesses = Reflect.getMetadata(PROCESS_METADATA_KEY, target) || [];
    existingProcesses.push({
      methodName: propertyKey,
      name: options.name || propertyKey,
      concurrency: options.concurrency,
      handler: descriptor.value,
    });
    Reflect.defineMetadata(PROCESS_METADATA_KEY, existingProcesses, target);
  };
}
