import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private configService: ConfigService) {}

  getHealthCheck() {
    const config = this.configService.get('cloudtaskmq');
    
    return {
      status: 'healthy',
      message: 'CloudTaskMQ NestJS Example API is running!',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      configuration: {
        projectId: config?.projectId || 'Not configured',
        location: config?.location || 'Not configured',
        storageAdapter: config?.storageAdapter || 'memory',
        autoCreateQueues: config?.autoCreateQueues || false,
      },
      endpoints: {
        dashboard: '/api/dashboard',
        docs: '/docs',
        health: '/api/health',
        queues: '/api/queues',
        tasks: '/api/tasks',
        upload: '/api/upload',
        processors: '/api/processors',
      },
    };
  }

  getInfo() {
    return {
      name: 'CloudTaskMQ NestJS Example',
      description: 'Production-ready task queue with Google Cloud Tasks integration using NestJS',
      version: '1.0.0',
      author: 'CloudTaskMQ Team',
      features: [
        '📧 Email processing with multiple providers',
        '🖼️ Image processing and thumbnail generation',
        '📊 Data exports in multiple formats',
        '🔄 Batch processing with chunking',
        '🔔 Multi-channel notifications',
        '📈 Real-time monitoring and analytics',
        '☁️ Google Cloud Tasks integration',
        '🔧 Environment-based configuration',
        '📚 OpenAPI/Swagger documentation',
        '🧪 Health checks and metrics',
      ],
      architecture: {
        framework: 'NestJS',
        taskQueue: 'CloudTaskMQ',
        cloudProvider: 'Google Cloud Platform',
        storage: 'Configurable (Memory/Redis/MongoDB)',
        documentation: 'Swagger/OpenAPI',
        validation: 'class-validator',
        configuration: '@nestjs/config',
      },
    };
  }
}
