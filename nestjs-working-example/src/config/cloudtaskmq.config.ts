import { registerAs } from '@nestjs/config';
import { CloudTaskMQConfig } from 'cloudtaskmq';

export default registerAs('cloudtaskmq', (): CloudTaskMQConfig => {
  const port = process.env.PORT || 3001;
  const baseUrl = process.env.EXTERNAL_URL || `http://localhost:${port}`;

  return {
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-nestjs-example',
    location: process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1',
    defaultProcessorUrl: `${baseUrl}/api/processors`,
    auth: {
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      credentials: process.env.GOOGLE_CLOUD_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS) : undefined,
    },
    autoCreateQueues: true,
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
    storageAdapter: (process.env.STORAGE_ADAPTER === 'mongodb' ? 'mongo' : process.env.STORAGE_ADAPTER) as any || 'memory',
    storageOptions: {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
      },
      mongo: {
        uri: process.env.MONGODB_URL || 'mongodb://localhost:27017/cloudtaskmq-nestjs',
      },
    },
  };
});
