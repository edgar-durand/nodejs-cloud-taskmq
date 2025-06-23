import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import { config } from './config';
import { initializeCloudTaskMQ } from './config/cloudtaskmq';
import { registerProcessors } from './processors';

// Import routes
import tasksRoutes from './routes/tasks';
import uploadRoutes from './routes/upload';
import dashboardRoutes from './routes/dashboard';
import processRoutes from './routes/process';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files for processed images
app.use('/processed', express.static(path.join(__dirname, '../processed')));

// API Routes
app.use('/api/tasks', tasksRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/process', processRoutes);

// Root endpoint with API documentation
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CloudTaskMQ Example API',
    version: '1.0.0',
    documentation: {
      baseUrl: `http://localhost:${config.server.port}`,
      endpoints: {
        // Task Management
        'POST /api/tasks/email': 'Send email task',
        'POST /api/tasks/welcome-email': 'Send welcome email task',
        'POST /api/tasks/data-export': 'Export data task',
        'POST /api/tasks/report': 'Generate report task',
        'POST /api/tasks/batch': 'Batch processing task',
        'POST /api/tasks/chain': 'Chained tasks',
        'GET /api/tasks/:taskId/status': 'Get task status',
        'GET /api/tasks/queue/:queueName/stats': 'Get queue statistics',
        
        // File Upload & Processing
        'POST /api/upload/image': 'Upload and process single image',
        'POST /api/upload/thumbnails': 'Upload and generate thumbnails',
        'POST /api/upload/batch': 'Upload and batch process images',
        'GET /api/upload/processed': 'List processed files',
        'GET /api/upload/processed/:filename': 'Download processed file',
        
        // Dashboard & Monitoring
        'GET /api/dashboard': 'Dashboard overview',
        'GET /api/dashboard/recent-tasks': 'Recent tasks',
        'GET /api/dashboard/health': 'System health check',
        'DELETE /api/dashboard/queue/:queueName/completed': 'Clear completed tasks',
        'POST /api/dashboard/queue/:queueName/retry-failed': 'Retry failed tasks',
        
        // GCP Cloud Tasks Processor Endpoints (called by GCP)
        'POST /api/process/email': 'Process email task (GCP callback)',
        'POST /api/process/welcome-email': 'Process welcome email task (GCP callback)',
        'POST /api/process/image-processing': 'Process image processing task (GCP callback)',
        'POST /api/process/thumbnail': 'Process thumbnail task (GCP callback)',
        'POST /api/process/data-export': 'Process data export task (GCP callback)',
        'POST /api/process/report': 'Process report task (GCP callback)',
        'POST /api/process/batch': 'Process batch task (GCP callback)',
        'POST /api/process/chain': 'Process chain task (GCP callback)',
        'POST /api/process': 'Process any task (default GCP callback)',
      },
      examples: {
        emailTask: {
          method: 'POST',
          url: '/api/tasks/email',
          body: {
            to: 'user@example.com',
            subject: 'Test Email',
            text: 'Hello from CloudTaskMQ!',
            html: '<h1>Hello from CloudTaskMQ!</h1>',
          },
        },
        imageUpload: {
          method: 'POST',
          url: '/api/upload/image',
          contentType: 'multipart/form-data',
          fields: {
            image: 'file',
            resize_width: '800',
            resize_height: '600',
            quality: '85',
            format: 'jpeg',
            watermark_text: 'CloudTaskMQ',
            watermark_position: 'bottom-right',
          },
        },
        dataExport: {
          method: 'POST',
          url: '/api/tasks/data-export',
          body: {
            userId: 'user123',
            format: 'csv',
          },
        },
        taskChain: {
          method: 'POST',
          url: '/api/tasks/chain',
          body: {
            steps: 5,
            payload: { userId: 'user123', operation: 'process' },
          },
        },
      },
    },
    configuration: {
      storageAdapter: config.storage.adapter,
      rateLimitingEnabled: config.rateLimiting.enabled,
      environment: config.server.nodeEnv,
    },
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  });
});

// Error handling middleware
app.use((error: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: config.server.nodeEnv === 'development' ? error.message : 'Something went wrong',
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /',
      'GET /health',
      'POST /api/tasks/*',
      'POST /api/upload/*',
      'GET /api/dashboard/*',
    ],
  });
});

// Initialize and start server
async function startServer() {
  try {
    console.log('🚀 Starting CloudTaskMQ Example API...');
    
    // Initialize CloudTaskMQ
    console.log('📡 Initializing CloudTaskMQ...');
    await initializeCloudTaskMQ();
    console.log(`✅ CloudTaskMQ initialized with ${config.storage.adapter} adapter`);
    
    // Register task processors
    console.log('🎯 Registering task processors...');
    await registerProcessors();
    console.log('✅ Task processors registered successfully');
    
    // Start HTTP server
    const server = app.listen(config.server.port, () => {
      console.log('\n🎉 CloudTaskMQ Example API is running!');
      console.log(`📍 Server: http://localhost:${config.server.port}`);
      console.log(`📊 Dashboard: http://localhost:${config.server.port}/api/dashboard`);
      console.log(`📚 API Docs: http://localhost:${config.server.port}/`);
      console.log(`🔧 Environment: ${config.server.nodeEnv}`);
      console.log(`💾 Storage: ${config.storage.adapter}`);
      console.log(`⚡ Rate Limiting: ${config.rateLimiting.enabled ? 'enabled' : 'disabled'}`);
      console.log('\n📝 Available queues:');
      console.log('   • email-queue');
      console.log('   • welcome-email-queue');
      console.log('   • image-processing-queue');
      console.log('   • thumbnail-queue');
      console.log('   • data-export-queue');
      console.log('   • report-queue');
      console.log('   • batch-queue');
      console.log('   • chain-queue');
      console.log('\n🎯 Ready to process tasks!');
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n⚠️ Received ${signal}, shutting down gracefully...`);
      
      server.close(async () => {
        try {
          const taskMQ = await initializeCloudTaskMQ();
          await taskMQ.close();
          console.log('✅ CloudTaskMQ closed successfully');
          process.exit(0);
        } catch (error) {
          console.error('❌ Error during shutdown:', error);
          process.exit(1);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer().catch((error) => {
  console.error('💥 Startup failed:', error);
  process.exit(1);
});
