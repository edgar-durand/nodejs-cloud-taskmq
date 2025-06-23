import { CloudTaskMQ, CloudTaskMQConfig, StorageOptions } from 'cloudtaskmq';
import { config } from './index';

let cloudTaskMQInstance: CloudTaskMQ | null = null;

export const initializeCloudTaskMQ = async (): Promise<CloudTaskMQ> => {
  if (cloudTaskMQInstance) {
    return cloudTaskMQInstance;
  }

  // Create storage options
  const storageOptions: StorageOptions = {};

  // Add storage-specific configuration
  if (config.storage.adapter === 'mongodb') {
    storageOptions.mongo = {
      uri: config.mongodb.url,
      collectionName: 'tasks',
    };
  } else if (config.storage.adapter === 'redis') {
    storageOptions.redis = {
      url: config.redis.url,
      keyPrefix: 'cloudtaskmq:',
    };
  }

  // Create CloudTaskMQ configuration
  const cloudTaskMQConfig: CloudTaskMQConfig = {
    // Use environment variable for real GCP project or fallback to example
    projectId: process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-example',
    
    // Use environment variable for location or fallback to us-central1
    location: process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1',
    
    defaultProcessorUrl: `${process.env.EXTERNAL_URL || `http://localhost:${config.server.port}`}/api/process`,
    auth: {
      // Use service account key file if provided via environment variable
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      // Or use credentials object from environment
      credentials: process.env.GOOGLE_CLOUD_CREDENTIALS ? JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS) : undefined,
    },
    autoCreateQueues: true,
    queues: [
      {
        name: 'email-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/email-queue`,
        processorUrl: `${process.env.EXTERNAL_URL || `http://localhost:${config.server.port}`}/api/process/email`,
      },
      {
        name: 'welcome-email-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/welcome-email-queue`,
        processorUrl: `${process.env.EXTERNAL_URL || `http://localhost:${config.server.port}`}/api/process/welcome-email`,
      },
      {
        name: 'image-processing-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/image-processing-queue`,
        processorUrl: `${process.env.EXTERNAL_URL || `http://localhost:${config.server.port}`}/api/process/image-processing`,
      },
      {
        name: 'thumbnail-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/thumbnail-queue`,
        processorUrl: `${process.env.EXTERNAL_URL || `http://localhost:${config.server.port}`}/api/process/thumbnail`,
      },
      {
        name: 'data-export-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/data-export-queue`,
        processorUrl: `${process.env.EXTERNAL_URL || `http://localhost:${config.server.port}`}/api/process/data-export`,
      },
      {
        name: 'report-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/report-queue`,
        processorUrl: `${process.env.EXTERNAL_URL || `http://localhost:${config.server.port}`}/api/process/report`,
      },
      {
        name: 'batch-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/batch-queue`,
        processorUrl: `${process.env.EXTERNAL_URL || `http://localhost:${config.server.port}`}/api/process/batch`,
      },
      {
        name: 'chain-queue',
        path: `projects/${process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT_ID || 'cloudtaskmq-example'}/locations/${process.env.GOOGLE_CLOUD_LOCATION || process.env.GCP_LOCATION || 'us-central1'}/queues/chain-queue`,
        processorUrl: `${process.env.EXTERNAL_URL || `http://localhost:${config.server.port}`}/api/process/chain`,
      },
    ],
    storageAdapter: config.storage.adapter === 'mongodb' ? 'mongo' : config.storage.adapter,
    storageOptions,
    globalRateLimiter: config.rateLimiting.enabled ? {
      maxRequests: config.rateLimiting.max,
      windowMs: config.rateLimiting.window,
    } : undefined,
  };

  // Create and initialize CloudTaskMQ instance
  cloudTaskMQInstance = new CloudTaskMQ(cloudTaskMQConfig);
  await cloudTaskMQInstance.initialize();

  return cloudTaskMQInstance;
};

export const getCloudTaskMQ = (): CloudTaskMQ => {
  if (!cloudTaskMQInstance) {
    throw new Error('CloudTaskMQ not initialized. Call initializeCloudTaskMQ() first.');
  }
  return cloudTaskMQInstance;
};
