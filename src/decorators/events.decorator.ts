import 'reflect-metadata';

/**
 * Metadata keys for event decorators
 */
export const EVENT_HANDLERS_KEY = 'cloud_taskmq:event_handlers';

/**
 * Event handler metadata
 */
export interface EventHandlerMetadata {
  event: string;
  methodName: string;
  handler: Function;
}

/**
 * Base event decorator factory
 */
function createEventDecorator(eventName: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const existingHandlers: EventHandlerMetadata[] = Reflect.getMetadata(EVENT_HANDLERS_KEY, target) || [];
    existingHandlers.push({
      event: eventName,
      methodName: propertyKey,
      handler: descriptor.value,
    });
    Reflect.defineMetadata(EVENT_HANDLERS_KEY, existingHandlers, target);
  };
}

/**
 * Decorator for handling task active events.
 * This method will be called when a task becomes active.
 *
 * @example
 * ```typescript
 * @Processor('email-queue')
 * export class EmailProcessor {
 *   @OnTaskActive()
 *   async onTaskActive(task: CloudTask<EmailData>) {
 *     console.log(`Task ${task.id} is now active`);
 *   }
 * }
 * ```
 */
export function OnTaskActive() {
  return createEventDecorator('active');
}

/**
 * Decorator for handling task completed events.
 * This method will be called when a task completes successfully.
 *
 * @example
 * ```typescript
 * @Processor('email-queue')
 * export class EmailProcessor {
 *   @OnTaskCompleted()
 *   async onTaskCompleted(task: CloudTask<EmailData>, result: any) {
 *     console.log(`Task ${task.id} completed with result:`, result);
 *   }
 * }
 * ```
 */
export function OnTaskCompleted() {
  return createEventDecorator('completed');
}

/**
 * Decorator for handling task failed events.
 * This method will be called when a task fails.
 *
 * @example
 * ```typescript
 * @Processor('email-queue')
 * export class EmailProcessor {
 *   @OnTaskFailed()
 *   async onTaskFailed(task: CloudTask<EmailData>, error: Error) {
 *     console.error(`Task ${task.id} failed:`, error);
 *   }
 * }
 * ```
 */
export function OnTaskFailed() {
  return createEventDecorator('failed');
}

/**
 * Decorator for handling task progress events.
 * This method will be called when a task reports progress.
 *
 * @example
 * ```typescript
 * @Processor('email-queue')
 * export class EmailProcessor {
 *   @OnTaskProgress()
 *   async onTaskProgress(task: CloudTask<EmailData>, progress: { percentage: number; data?: any }) {
 *     console.log(`Task ${task.id} progress: ${progress.percentage}%`);
 *   }
 * }
 * ```
 */
export function OnTaskProgress() {
  return createEventDecorator('progress');
}
