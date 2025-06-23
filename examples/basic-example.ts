import express from 'express';
import { 
  CloudTaskMQ, 
  createCloudTaskMQ, 
  Processor, 
  Process, 
  OnTaskCompleted, 
  OnTaskFailed,
  TaskController,
  CloudTask 
} from '../src';

// Email Processor Example
@Processor('email-queue')
class EmailProcessor {
  @Process('send-welcome-email')
  async sendWelcomeEmail(task: CloudTask) {
    const { email, name } = task.data;
    
    console.log(`Processing welcome email for ${name} (${email})`);
    
    // Simulate email sending
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simulate random failure for demonstration
    if (Math.random() < 0.3) {
      throw new Error('Email service temporarily unavailable');
    }
    
    console.log(`✅ Welcome email sent to ${email}`);
    return { messageId: `msg_${Date.now()}`, status: 'sent' };
  }

  @Process('send-notification')
  async sendNotification(task: CloudTask) {
    const { email, message, type } = task.data;
    
    console.log(`Processing ${type} notification for ${email}`);
    
    // Simulate processing with progress updates
    for (let i = 0; i <= 100; i += 25) {
      await task.updateProgress({ 
        percentage: i, 
        data: { step: `Processing step ${i/25 + 1}` }
      });
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.log(`✅ Notification sent to ${email}`);
    return { messageId: `notif_${Date.now()}`, type };
  }

  @OnTaskCompleted()
  async onEmailCompleted(task: CloudTask, result: any) {
    console.log(`📧 Task ${task.id} completed:`, result);
  }

  @OnTaskFailed()
  async onEmailFailed(task: CloudTask, error: Error) {
    console.error(`❌ Task ${task.id} failed: ${error.message}`);
  }
}

// Data Processing Processor Example
@Processor('data-processing')
class DataProcessor {
  @Process('process-user-data')
  async processUserData(task: CloudTask) {
    const { userId, dataType } = task.data;
    
    console.log(`Processing ${dataType} data for user ${userId}`);
    
    // Simulate long-running process with progress updates
    const steps = ['validate', 'transform', 'analyze', 'store'];
    
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`  - ${step}ing data...`);
      
      await task.updateProgress({
        percentage: Math.round((i + 1) / steps.length * 100),
        data: { currentStep: step, completedSteps: i + 1 }
      });
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`✅ Data processing completed for user ${userId}`);
    return { 
      userId, 
      dataType, 
      processedAt: new Date().toISOString(),
      recordsProcessed: Math.floor(Math.random() * 1000) + 100
    };
  }

  @OnTaskCompleted()
  async onDataProcessed(task: CloudTask, result: any) {
    console.log(`📊 Data processing completed: ${result.recordsProcessed} records processed`);
  }
}

async function main() {
  console.log('🚀 Starting CloudTaskMQ Basic Example...\n');

  // Create and initialize CloudTaskMQ
  const taskMQ = createCloudTaskMQ({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || 'demo-project',
    location: process.env.GOOGLE_CLOUD_LOCATION || 'us-central1',
    storageAdapter: 'memory', // Use memory storage for this example
    defaultQueue: {
      name: 'default',
      rateLimiter: {
        maxRequests: 10,
        windowMs: 60000, // 10 requests per minute
      },
    },
  });

  try {
    // Initialize TaskMQ
    await taskMQ.initialize();
    console.log('✅ CloudTaskMQ initialized\n');

    // Register processors
    const emailProcessor = new EmailProcessor();
    const dataProcessor = new DataProcessor();
    
    taskMQ.registerProcessor(emailProcessor);
    taskMQ.registerProcessor(dataProcessor);
    console.log('✅ Processors registered\n');

    // Set up Express server for HTTP endpoints
    const app = express();
    app.use(express.json());

    const taskController = new TaskController(taskMQ);

    // Task processing endpoints
    app.post('/tasks/process', (req, res) => taskController.processTask(req, res));
    app.post('/tasks/:taskId/progress', (req, res) => taskController.updateProgress(req, res));
    app.get('/tasks/:taskId', (req, res) => taskController.getTask(req, res));
    app.get('/tasks', (req, res) => taskController.listTasks(req, res));
    app.get('/health', (req, res) => taskController.healthCheck(req, res));

    // Demo endpoints
    app.post('/demo/send-welcome-email', async (req, res) => {
      try {
        const { email, name } = req.body;
        const result = await taskMQ.addTask('email-queue', 
          { email, name },
          { 
            taskName: 'send-welcome-email',
            maxAttempts: 3,
            uniquenessKey: `welcome-${email}`,
          }
        );
        res.json({ success: true, taskId: result.taskId });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/demo/send-notification', async (req, res) => {
      try {
        const { email, message, type } = req.body;
        const result = await taskMQ.addTask('email-queue',
          { email, message, type },
          { 
            taskName: 'send-notification',
            maxAttempts: 2,
          }
        );
        res.json({ success: true, taskId: result.taskId });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/demo/process-data', async (req, res) => {
      try {
        const { userId, dataType } = req.body;
        const result = await taskMQ.addTask('data-processing',
          { userId, dataType },
          { 
            taskName: 'process-user-data',
            maxAttempts: 2,
          }
        );
        res.json({ success: true, taskId: result.taskId });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    app.post('/demo/create-chain', async (req, res) => {
      try {
        const { userId } = req.body;
        
        const chainResults = await taskMQ.addChain('data-processing', [
          {
            data: { userId, dataType: 'profile' },
            options: { taskName: 'process-user-data', maxAttempts: 2 }
          },
          {
            data: { userId, dataType: 'preferences' },
            options: { taskName: 'process-user-data', maxAttempts: 2 }
          },
          {
            data: { userId, dataType: 'activity' },
            options: { taskName: 'process-user-data', maxAttempts: 2 }
          },
        ], {
          waitForPrevious: true,
        });

        res.json({ 
          success: true, 
          chainId: chainResults[0].taskId.split('-')[0],
          tasks: chainResults.map(r => ({ taskId: r.taskId, status: r.status }))
        });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });

    // Start server
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`🌐 Server running on port ${PORT}`);
      console.log(`\n📖 Try these demo endpoints:`);
      console.log(`   POST http://localhost:${PORT}/demo/send-welcome-email`);
      console.log(`        Body: { "email": "user@example.com", "name": "John Doe" }`);
      console.log(`   POST http://localhost:${PORT}/demo/send-notification`);
      console.log(`        Body: { "email": "user@example.com", "message": "Hello!", "type": "info" }`);
      console.log(`   POST http://localhost:${PORT}/demo/process-data`);
      console.log(`        Body: { "userId": "123", "dataType": "profile" }`);
      console.log(`   POST http://localhost:${PORT}/demo/create-chain`);
      console.log(`        Body: { "userId": "123" }`);
      console.log(`   GET  http://localhost:${PORT}/tasks - List all tasks`);
      console.log(`   GET  http://localhost:${PORT}/health - Health check\n`);
    });

    // Demonstrate programmatic task creation
    console.log('📤 Adding some demo tasks...\n');

    // Add a welcome email task
    const emailTask = await taskMQ.addTask('email-queue', {
      email: 'demo@example.com',
      name: 'Demo User',
    }, {
      taskName: 'send-welcome-email',
      maxAttempts: 3,
      uniquenessKey: 'welcome-demo@example.com',
    });

    console.log(`✅ Welcome email task added: ${emailTask.taskId}`);

    // Add a data processing task
    const dataTask = await taskMQ.addTask('data-processing', {
      userId: 'demo-user-123',
      dataType: 'analytics',
    }, {
      taskName: 'process-user-data',
      maxAttempts: 2,
    });

    console.log(`✅ Data processing task added: ${dataTask.taskId}`);

    // Simulate processing these tasks (in real app, Cloud Tasks would trigger these)
    setTimeout(async () => {
      console.log('\n🔄 Simulating task processing...\n');
      
      try {
        await taskMQ.processTask({
          taskId: emailTask.taskId,
          queueName: 'email-queue',
          data: { email: 'demo@example.com', name: 'Demo User' },
          attempts: 0,
          maxAttempts: 3,
        });
      } catch (error) {
        console.error('Email task processing failed:', error.message);
      }

      try {
        await taskMQ.processTask({
          taskId: dataTask.taskId,
          queueName: 'data-processing', 
          data: { userId: 'demo-user-123', dataType: 'analytics' },
          attempts: 0,
          maxAttempts: 2,
        });
      } catch (error) {
        console.error('Data task processing failed:', error.message);
      }
    }, 2000);

    // Event listeners for monitoring
    taskMQ.on('taskCompleted', (event) => {
      console.log(`🎉 Task completed: ${event.taskId} in ${event.duration}ms`);
    });

    taskMQ.on('taskFailed', (event) => {
      console.log(`💥 Task failed: ${event.taskId} (attempt ${event.attempts}/${event.maxAttempts})`);
    });

    taskMQ.on('taskProgress', (event) => {
      console.log(`📈 Task progress: ${event.taskId} - ${event.progress.percentage}%`);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🛑 Shutting down gracefully...');
      await taskMQ.close();
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Failed to start application:', error);
    process.exit(1);
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error);
}

export { main };
