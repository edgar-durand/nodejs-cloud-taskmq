import 'reflect-metadata';
import { 
  Processor, 
  PROCESSOR_QUEUE_KEY, 
  PROCESSOR_METADATA_KEY 
} from '../decorators/processor.decorator';
import { 
  Process, 
  PROCESS_METADATA_KEY 
} from '../decorators/process.decorator';
import { 
  OnTaskActive, 
  OnTaskCompleted, 
  OnTaskFailed, 
  OnTaskProgress,
  EVENT_HANDLERS_KEY 
} from '../decorators/events.decorator';
import { 
  CloudTaskConsumer, 
  CLOUD_TASK_CONSUMER_KEY 
} from '../decorators/cloud-task-consumer.decorator';

describe('Decorators', () => {
  describe('@Processor', () => {
    it('should set queue name metadata', () => {
      @Processor('test-queue')
      class TestProcessor {}

      const queueName = Reflect.getMetadata(PROCESSOR_QUEUE_KEY, TestProcessor);
      expect(queueName).toBe('test-queue');
    });

    it('should set processor options metadata', () => {
      @Processor('test-queue', { concurrency: 5 })
      class TestProcessor {}

      const options = Reflect.getMetadata(PROCESSOR_METADATA_KEY, TestProcessor);
      expect(options).toEqual({ concurrency: 5 });
    });

    it('should handle processor without options', () => {
      @Processor('simple-queue')
      class SimpleProcessor {}

      const options = Reflect.getMetadata(PROCESSOR_METADATA_KEY, SimpleProcessor);
      expect(options).toEqual({});
    });
  });

  describe('@Process', () => {
    it('should set process metadata on method', () => {
      class TestProcessor {
        @Process({ name: 'test-task' })
        testMethod() {}
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(PROCESS_METADATA_KEY, instance);
      
      expect(metadata).toHaveLength(1);
      expect(metadata[0]).toEqual({
        methodName: 'testMethod',
        name: 'test-task',
        concurrency: undefined,
        handler: expect.any(Function),
      });
    });

    it('should set process metadata with concurrency', () => {
      class TestProcessor {
        @Process({ name: 'concurrent-task', concurrency: 3 })
        concurrentMethod() {}
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(PROCESS_METADATA_KEY, instance);
      
      expect(metadata[0].concurrency).toBe(3);
    });

    it('should use method name as task name when not provided', () => {
      class TestProcessor {
        @Process()
        myTaskMethod() {}
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(PROCESS_METADATA_KEY, instance);
      
      expect(metadata[0].name).toBe('myTaskMethod');
    });

    it('should handle multiple process methods', () => {
      class TestProcessor {
        @Process({ name: 'task-1' })
        method1() {}

        @Process({ name: 'task-2' })
        method2() {}
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(PROCESS_METADATA_KEY, instance);
      
      expect(metadata).toHaveLength(2);
      expect(metadata.map((m: any) => m.name)).toEqual(['task-1', 'task-2']);
    });
  });

  describe('Event Decorators', () => {
    it('should set OnTaskActive metadata', () => {
      class TestProcessor {
        @OnTaskActive()
        onActive() {}
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(EVENT_HANDLERS_KEY, instance);
      
      expect(metadata).toHaveLength(1);
      expect(metadata[0]).toEqual({
        event: 'active',
        methodName: 'onActive',
        handler: expect.any(Function),
      });
    });

    it('should set OnTaskCompleted metadata', () => {
      class TestProcessor {
        @OnTaskCompleted()
        onCompleted() {}
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(EVENT_HANDLERS_KEY, instance);
      
      expect(metadata[0].event).toBe('completed');
    });

    it('should set OnTaskFailed metadata', () => {
      class TestProcessor {
        @OnTaskFailed()
        onFailed() {}
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(EVENT_HANDLERS_KEY, instance);
      
      expect(metadata[0].event).toBe('failed');
    });

    it('should set OnTaskProgress metadata', () => {
      class TestProcessor {
        @OnTaskProgress()
        onProgress() {}
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(EVENT_HANDLERS_KEY, instance);
      
      expect(metadata[0].event).toBe('progress');
    });

    it('should handle multiple event handlers', () => {
      class TestProcessor {
        @OnTaskActive()
        onActive() {}

        @OnTaskCompleted()
        onCompleted() {}

        @OnTaskFailed()
        onFailed() {}

        @OnTaskProgress()
        onProgress() {}
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(EVENT_HANDLERS_KEY, instance);
      
      expect(metadata).toHaveLength(4);
      expect(metadata.map((m: any) => m.event)).toEqual(['active', 'completed', 'failed', 'progress']);
    });
  });

  describe('@CloudTaskConsumer', () => {
    it('should set consumer metadata', () => {
      @CloudTaskConsumer({
        queueName: 'test-queue',
        path: '/tasks/process',
        method: 'POST',
        maxConcurrency: 5,
        timeout: 30000,
      })
      class TestConsumer {}

      const metadata = Reflect.getMetadata(CLOUD_TASK_CONSUMER_KEY, TestConsumer);
      expect(metadata).toBeDefined();
      expect(metadata.queueName).toBe('test-queue');
      expect(metadata.path).toBe('/tasks/process');
      expect(metadata.method).toBe('POST');
      expect(metadata.maxConcurrency).toBe(5);
      expect(metadata.timeout).toBe(30000);
    });

    it('should handle consumer with default options', () => {
      @CloudTaskConsumer({ queueName: 'minimal-queue' })
      class MinimalConsumer {}

      const metadata = Reflect.getMetadata(CLOUD_TASK_CONSUMER_KEY, MinimalConsumer);
      expect(metadata).toBeDefined();
      expect(metadata.queueName).toBe('minimal-queue');
    });

    it('should handle consumer with multiple methods', () => {
      @CloudTaskConsumer({
        queueName: 'api-queue',
        path: '/api/tasks',
        method: 'POST',
        maxConcurrency: 10,
        timeout: 60000,
      })
      class ApiConsumer {}

      const metadata = Reflect.getMetadata(CLOUD_TASK_CONSUMER_KEY, ApiConsumer);
      expect(metadata.queueName).toBe('api-queue');
      expect(metadata.path).toBe('/api/tasks');
      expect(metadata.method).toBe('POST');
      expect(metadata.maxConcurrency).toBe(10);
      expect(metadata.timeout).toBe(60000);
    });
  });

  describe('Integration', () => {
    it('should work with complete processor class', () => {
      @Processor('integration-queue', { concurrency: 10 })
      class IntegrationProcessor {
        @Process({ name: 'main-task' })
        async processTask() {
          return 'processed';
        }

        @Process({ name: 'secondary-task', concurrency: 2 })
        async processSecondary() {
          return 'secondary';
        }

        @OnTaskActive()
        async onTaskActive() {
          console.log('Task started');
        }

        @OnTaskCompleted()
        async onTaskCompleted() {
          console.log('Task completed');
        }

        @OnTaskFailed()
        async onTaskFailed() {
          console.log('Task failed');
        }
      }

      const instance = new IntegrationProcessor();

      // Check processor metadata
      const queueName = Reflect.getMetadata(PROCESSOR_QUEUE_KEY, IntegrationProcessor);
      const processorOptions = Reflect.getMetadata(PROCESSOR_METADATA_KEY, IntegrationProcessor);
      expect(queueName).toBe('integration-queue');
      expect(processorOptions.concurrency).toBe(10);

      // Check process methods
      const processMetadata = Reflect.getMetadata(PROCESS_METADATA_KEY, instance);
      expect(processMetadata).toHaveLength(2);
      expect(processMetadata.map((m: any) => m.name)).toEqual(['main-task', 'secondary-task']);

      // Check event handlers
      const eventMetadata = Reflect.getMetadata(EVENT_HANDLERS_KEY, instance);
      expect(eventMetadata).toHaveLength(3);
      expect(eventMetadata.map((m: any) => m.event)).toEqual(['active', 'completed', 'failed']);
    });

    it('should handle inheritance', () => {
      @Processor('base-queue')
      class BaseProcessor {
        @Process({ name: 'base-task' })
        baseMethod() {}

        @OnTaskCompleted()
        onCompleted() {}
      }

      @Processor('derived-queue')
      class DerivedProcessor extends BaseProcessor {
        @Process({ name: 'derived-task' })
        derivedMethod() {}

        @OnTaskFailed()
        onFailed() {}
      }

      const instance = new DerivedProcessor();

      // Should have metadata from derived class
      const queueName = Reflect.getMetadata(PROCESSOR_QUEUE_KEY, DerivedProcessor);
      expect(queueName).toBe('derived-queue');

      // Should have both base and derived process methods
      const processMetadata = Reflect.getMetadata(PROCESS_METADATA_KEY, instance);
      expect(processMetadata).toHaveLength(2);

      // Should have both base and derived event handlers
      const eventMetadata = Reflect.getMetadata(EVENT_HANDLERS_KEY, instance);
      expect(eventMetadata).toHaveLength(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle missing reflect-metadata', () => {
      // Temporarily disable reflect-metadata
      const originalDefineMetadata = Reflect.defineMetadata;
      const originalGetMetadata = Reflect.getMetadata;
      
      // @ts-ignore
      Reflect.defineMetadata = undefined;
      // @ts-ignore
      Reflect.getMetadata = undefined;

      expect(() => {
        @Processor('test-queue')
        class TestProcessor {}
      }).toThrow();

      // Restore reflect-metadata
      Reflect.defineMetadata = originalDefineMetadata;
      Reflect.getMetadata = originalGetMetadata;
    });

    it('should handle edge cases gracefully', () => {
      // Process without options should work
      class TestProcessor {
        @Process()
        testMethod() {}
      }

      const processMetadata = Reflect.getMetadata(PROCESS_METADATA_KEY, new TestProcessor());
      expect(processMetadata).toBeDefined();
    });
  });

  describe('Metadata Utilities', () => {
    it('should preserve method references', () => {
      class TestProcessor {
        @Process({ name: 'test-task' })
        async testMethod(arg: string) {
          return `processed: ${arg}`;
        }
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(PROCESS_METADATA_KEY, instance);
      const handler = metadata[0].handler;

      expect(typeof handler).toBe('function');
      expect(handler).toBe(instance.testMethod);
    });

    it('should handle async methods', async () => {
      class TestProcessor {
        @Process({ name: 'async-task' })
        async asyncMethod() {
          return new Promise(resolve => setTimeout(() => resolve('async result'), 10));
        }
      }

      const instance = new TestProcessor();
      const metadata = Reflect.getMetadata(PROCESS_METADATA_KEY, instance);
      const handler = metadata[0].handler;

      const result = await handler();
      expect(result).toBe('async result');
    });
  });
});
