import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000'),
    nodeEnv: process.env.NODE_ENV || 'development',
  },
  storage: {
    adapter: process.env.STORAGE_ADAPTER as 'memory' | 'redis' | 'mongodb' || 'memory',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
  },
  mongodb: {
    url: process.env.MONGODB_URL || 'mongodb://localhost:27017/cloudtaskmq-example',
  },
  email: {
    smtp: {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    from: process.env.EMAIL_FROM || 'CloudTaskMQ <noreply@cloudtaskmq.com>',
  },
  files: {
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    processedDir: process.env.PROCESSED_DIR || './processed',
  },
  rateLimiting: {
    enabled: process.env.ENABLE_RATE_LIMITING === 'true',
    max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    window: parseInt(process.env.RATE_LIMIT_WINDOW || '60000'),
  },
  tasks: {
    maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
    timeout: parseInt(process.env.TASK_TIMEOUT || '30000'),
    concurrentWorkers: parseInt(process.env.CONCURRENT_WORKERS || '5'),
  },
};
