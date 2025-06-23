import { registerAs } from '@nestjs/config';
import { CloudTaskMQConfig } from 'cloudtaskmq';

export default registerAs('cloudtaskmq', (): CloudTaskMQConfig => {
  const port = process.env.PORT || 3001;
  const baseUrl = process.env.EXTERNAL_URL || `http://localhost:${port}`;

  return {
    // GCP Project Configuration
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example',
    location: process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1',
    
    // Processor URLs for GCP Cloud Tasks callbacks
    defaultProcessorUrl: `${baseUrl}/api/processors`,
    
    // GCP Authentication
    auth: {
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      credentials: process.env.GOOGLE_CLOUD_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS) : undefined,
    },
    
    // Auto-create queues in GCP
    autoCreateQueues: true,
    
    // Queue Configuration
    queues: [
      {
        name: 'email-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/email-queue`,
        processorUrl: `${baseUrl}/api/processors/email`,
      },
      {
        name: 'welcome-email-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/welcome-email-queue`,
        processorUrl: `${baseUrl}/api/processors/welcome-email`,
      },
      {
        name: 'image-processing-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/image-processing-queue`,
        processorUrl: `${baseUrl}/api/processors/image-processing`,
      },
      {
        name: 'thumbnail-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/thumbnail-queue`,
        processorUrl: `${baseUrl}/api/processors/thumbnail`,
      },
      {
        name: 'data-export-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/data-export-queue`,
        processorUrl: `${baseUrl}/api/processors/data-export`,
      },
      {
        name: 'report-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/report-queue`,
        processorUrl: `${baseUrl}/api/processors/report`,
      },
      {
        name: 'batch-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/batch-queue`,
        processorUrl: `${baseUrl}/api/processors/batch`,
      },
      {
        name: 'notification-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/notification-queue`,
        processorUrl: `${baseUrl}/api/processors/notification`,
      },
    ],
    
    // Storage Configuration
    storageAdapter: (process.env.STORAGE_ADAPTER === 'mongodb' ? 'mongo' : process.env.STORAGE_ADAPTER) as any || 'memory',
    
    // Storage Options
    storageOptions: {
      // Redis configuration
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      },
      
      // MongoDB configuration
      mongodb: {
        url: process.env.MONGODB_URL || 'mongodb://localhost:27017/cloudtaskmq-nestjs',
      },
    },
    
    // Rate Limiting
    rateLimiting: {
      enabled: process.env.ENABLE_RATE_LIMITING === 'true',
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
    },
    
    // Task Configuration
    taskOptions: {
      maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
      defaultTimeout: parseInt(process.env.TASK_TIMEOUT || '30000'),
    },
  };
});
