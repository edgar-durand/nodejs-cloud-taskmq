# NodeJS Cloud TaskMQ

A powerful, TypeScript-first task queue library for Node.js with Google Cloud Tasks backend support. This library provides a decorator-based approach to task processing with storage-agnostic persistence, rate limiting, and advanced features like task chaining.

## 🚀 Features

- **Google Cloud Tasks Integration**: Seamless integration with Google Cloud Tasks for reliable task scheduling and delivery
- **Storage Agnostic**: Support for MongoDB, Redis, in-memory storage, and custom adapters
- **Decorator-Based**: TypeScript decorators for clean, readable task processor definitions
- **Rate Limiting**: Built-in rate limiting with persistent storage
- **Task Chaining**: Chain multiple tasks together with dependency management
- **Retry Logic**: Automatic retries with configurable backoff strategies
- **Event System**: Comprehensive event system for task lifecycle monitoring
- **Uniqueness Keys**: Prevent duplicate task execution
- **TypeScript Native**: Full TypeScript support with type safety
- **Framework Agnostic**: Works with Node.js, Express, NestJS, or any Node.js framework

## 📦 Installation

```bash
npm install nodejs-cloud-taskmq

# Optional dependencies for specific storage adapters
npm install ioredis          # For Redis storage
npm install mongoose         # For MongoDB storage
```

## 🛠 Quick Start

### 1. Basic Setup

```typescript
import { CloudTaskMQ, createCloudTaskMQ } from 'nodejs-cloud-taskmq';

// Create and initialize CloudTaskMQ
const taskMQ = createCloudTaskMQ({
  projectId: 'your-gcp-project-id',
  location: 'us-central1',
  storageAdapter: 'memory', // or 'redis' or 'mongo'
  defaultQueue: {
    name: 'default',
    rateLimiter: {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
    },
  },
});

await taskMQ.initialize();
```

### 2. Define Task Processors

```typescript
import { Processor, Process, OnTaskCompleted, OnTaskFailed } from 'nodejs-cloud-taskmq';

@Processor('email-queue')
export class EmailProcessor {
  @Process('send-email')
  async sendEmail(task: CloudTask) {
    const { to, subject, body } = task.data;
    
    // Your email sending logic here
    console.log(`Sending email to ${to}: ${subject}`);
    
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return { messageId: 'email-123', status: 'sent' };
  }

  @OnTaskCompleted()
  async onEmailSent(task: CloudTask, result: any) {
    console.log(`Email sent successfully: ${result.messageId}`);
  }

  @OnTaskFailed()
  async onEmailFailed(task: CloudTask, error: Error) {
    console.error(`Failed to send email: ${error.message}`);
  }
}
```

### 3. Register Processors and Add Tasks

```typescript
// Register the processor
const emailProcessor = new EmailProcessor();
taskMQ.registerProcessor(emailProcessor);

// Add tasks to the queue
const result = await taskMQ.addTask('email-queue', {
  to: 'user@example.com',
  subject: 'Welcome!',
  body: 'Welcome to our service!',
}, {
  maxAttempts: 3,
  uniquenessKey: 'welcome-email-user@example.com',
});

console.log(`Task added: ${result.taskId}`);
```

## 🔧 Configuration

### Storage Adapters

#### Memory Storage (Development)
```typescript
const taskMQ = createCloudTaskMQ({
  storageAdapter: 'memory',
});
```

#### Redis Storage
```typescript
const taskMQ = createCloudTaskMQ({
  storageAdapter: 'redis',
  storageOptions: {
    redis: {
      host: 'localhost',
      port: 6379,
      password: 'your-redis-password',
      keyPrefix: 'taskmq:',
    },
  },
});
```

#### MongoDB Storage
```typescript
const taskMQ = createCloudTaskMQ({
  storageAdapter: 'mongo',
  storageOptions: {
    mongo: {
      uri: 'mongodb://localhost:27017/taskqueue',
      collectionPrefix: 'taskmq_',
    },
  },
});
```

#### Custom Storage Adapter
```typescript
import { IStateStorageAdapter } from 'nodejs-cloud-taskmq';

class MyCustomAdapter implements IStateStorageAdapter {
  // Implement all required methods
}

const taskMQ = createCloudTaskMQ({
  storageAdapter: 'custom',
  storageOptions: {
    customAdapter: new MyCustomAdapter(),
  },
});
```

## 🎯 Advanced Features

### Task Chaining

Chain multiple tasks together:

```typescript
const chainResults = await taskMQ.addChain('processing-queue', [
  { 
    data: { step: 'validate', userId: 123 },
    options: { maxAttempts: 2 }
  },
  { 
    data: { step: 'process', userId: 123 },
    options: { maxAttempts: 3 }
  },
  { 
    data: { step: 'notify', userId: 123 },
    options: { maxAttempts: 1 }
  },
], {
  waitForPrevious: true,
});
```

### Progress Tracking

```typescript
@Processor('long-task-queue')
export class LongTaskProcessor {
  @Process('process-data')
  async processData(task: CloudTask) {
    const items = task.data.items;
    
    for (let i = 0; i < items.length; i++) {
      // Process item
      await this.processItem(items[i]);
      
      // Update progress
      const percentage = Math.round((i + 1) / items.length * 100);
      await task.updateProgress({ 
        percentage,
        data: { processedItems: i + 1, totalItems: items.length }
      });
    }
    
    return { processedCount: items.length };
  }
}
```

### Rate Limiting

```typescript
// Queue-level rate limiting
const taskMQ = createCloudTaskMQ({
  defaultQueue: {
    name: 'api-calls',
    rateLimiter: {
      maxRequests: 10,
      windowMs: 1000, // 10 requests per second
    },
  },
});

// Manual rate limiting
const rateLimitResult = await taskMQ.checkRateLimit('user:123', {
  maxRequests: 5,
  windowMs: 60000, // 5 requests per minute per user
});

if (!rateLimitResult.allowed) {
  throw new Error('Rate limit exceeded');
}
```

### Event Handling

```typescript
@Processor('notification-queue')
export class NotificationProcessor {
  @OnTaskActive()
  async onTaskStarted(task: CloudTask) {
    console.log(`Task ${task.id} started processing`);
  }

  @OnTaskProgress()
  async onTaskProgress(task: CloudTask, progress: TaskProgress) {
    console.log(`Task ${task.id} progress: ${progress.percentage}%`);
  }

  @OnTaskCompleted()
  async onTaskCompleted(task: CloudTask, result: any) {
    console.log(`Task ${task.id} completed with result:`, result);
  }

  @OnTaskFailed()
  async onTaskFailed(task: CloudTask, error: Error) {
    console.error(`Task ${task.id} failed:`, error.message);
  }
}
```

## 🌐 HTTP Integration

### Express.js Setup

```typescript
import express from 'express';
import { TaskController } from 'nodejs-cloud-taskmq';

const app = express();
app.use(express.json());

const taskController = new TaskController(taskMQ);

// Cloud Tasks will POST to this endpoint
app.post('/tasks/process', (req, res) => taskController.processTask(req, res));
app.post('/tasks/:taskId/progress', (req, res) => taskController.updateProgress(req, res));
app.get('/tasks/:taskId', (req, res) => taskController.getTask(req, res));
app.get('/tasks', (req, res) => taskController.listTasks(req, res));
app.get('/health', (req, res) => taskController.healthCheck(req, res));

app.listen(3000, () => {
  console.log('Task processing server running on port 3000');
});
```

### Cloud Tasks Consumer Decorator

```typescript
@CloudTaskConsumer({
  endpoint: '/tasks/process',
  methods: ['POST'],
})
export class TaskConsumer {
  constructor(private taskMQ: CloudTaskMQ) {}

  async handleRequest(req: Request, res: Response) {
    try {
      const result = await this.taskMQ.processTask(req.body);
      res.json({ success: true, result });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}
```

## 📊 Monitoring and Management

### Task Queries

```typescript
// Get tasks by status
const activeTasks = await taskMQ.getTasks({
  status: ['active'],
  limit: 10,
});

// Get tasks by queue
const queueTasks = await taskMQ.getTasks({
  queueName: 'email-queue',
  limit: 50,
  sort: { field: 'createdAt', order: 'desc' },
});

// Get task count
const taskCount = await taskMQ.getTaskCount({
  status: ['idle', 'active'],
});
```

### Cleanup Old Tasks

```typescript
// Clean up completed tasks older than 1 day
const cleanedCount = await taskMQ.cleanup({
  olderThan: new Date(Date.now() - 24 * 60 * 60 * 1000),
  removeCompleted: true,
  removeFailed: false,
});

console.log(`Cleaned up ${cleanedCount} old tasks`);
```

## 🧪 Testing

### Unit Testing with Jest

```typescript
import { CloudTaskMQ, MemoryStorageAdapter } from 'nodejs-cloud-taskmq';

describe('EmailProcessor', () => {
  let taskMQ: CloudTaskMQ;
  let emailProcessor: EmailProcessor;

  beforeEach(async () => {
    taskMQ = new CloudTaskMQ({
      projectId: 'test-project',
      location: 'us-central1',
      storageAdapter: 'memory',
    });
    
    await taskMQ.initialize();
    
    emailProcessor = new EmailProcessor();
    taskMQ.registerProcessor(emailProcessor);
  });

  afterEach(async () => {
    await taskMQ.close();
  });

  it('should process email task successfully', async () => {
    const result = await taskMQ.addTask('email-queue', {
      to: 'test@example.com',
      subject: 'Test',
      body: 'Test email',
    });

    expect(result.taskId).toBeDefined();
    
    // Process the task
    const processResult = await taskMQ.processTask({
      taskId: result.taskId,
      queueName: 'email-queue',
      data: { to: 'test@example.com', subject: 'Test', body: 'Test email' },
      attempts: 0,
      maxAttempts: 3,
    });

    expect(processResult.status).toBe('sent');
  });
});
```

## 🚀 Deployment

### Google Cloud Run

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY src ./src

EXPOSE 8080
CMD ["node", "dist/server.js"]
```

### Environment Variables

```bash
# Google Cloud
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Storage (Redis example)
REDIS_HOST=redis-host
REDIS_PORT=6379
REDIS_PASSWORD=redis-password

# Storage (MongoDB example)
MONGODB_URI=mongodb://mongo-host:27017/taskqueue
```

## 🤝 NestJS Integration

While this library is framework-agnostic, it works seamlessly with NestJS:

```typescript
import { Module } from '@nestjs/common';
import { CloudTaskMQ, createCloudTaskMQ } from 'nodejs-cloud-taskmq';

@Module({
  providers: [
    {
      provide: 'CLOUD_TASK_MQ',
      useFactory: async () => {
        const taskMQ = createCloudTaskMQ({
          projectId: process.env.GOOGLE_CLOUD_PROJECT,
          location: process.env.GOOGLE_CLOUD_LOCATION,
          storageAdapter: 'redis',
          storageOptions: {
            redis: {
              host: process.env.REDIS_HOST,
              port: parseInt(process.env.REDIS_PORT),
            },
          },
        });
        await taskMQ.initialize();
        return taskMQ;
      },
    },
  ],
  exports: ['CLOUD_TASK_MQ'],
})
export class TaskModule {}
```

## 📝 API Reference

### Main Classes

- `CloudTaskMQ` - Main orchestrator class
- `ProducerService` - Handles task creation and queueing
- `ConsumerService` - Handles task processing and processor registration
- `RateLimiterService` - Handles rate limiting logic
- `TaskController` - HTTP controller for task endpoints

### Decorators

- `@Processor(queueName)` - Mark a class as a task processor
- `@Process(taskName?)` - Mark a method as a task handler
- `@OnTaskActive()` - Event handler for when task becomes active
- `@OnTaskCompleted()` - Event handler for task completion
- `@OnTaskFailed()` - Event handler for task failure
- `@OnTaskProgress()` - Event handler for task progress updates
- `@CloudTaskConsumer(options)` - Mark a class as HTTP task consumer

### Storage Adapters

- `MemoryStorageAdapter` - In-memory storage (development only)
- `RedisStorageAdapter` - Redis-based persistent storage
- `MongoStorageAdapter` - MongoDB-based persistent storage

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- 📖 [Documentation](https://github.com/your-org/nodejs-cloud-taskmq/wiki)
- 🐛 [Issue Tracker](https://github.com/your-org/nodejs-cloud-taskmq/issues)
- 💬 [Discussions](https://github.com/your-org/nodejs-cloud-taskmq/discussions)

## 🙏 Acknowledgments

This library is inspired by and maintains compatibility with the [nestjs-cloud-taskmq](https://github.com/your-org/nestjs-cloud-taskmq) library, providing a framework-agnostic alternative for Node.js applications.
