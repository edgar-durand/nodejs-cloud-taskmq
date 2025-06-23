import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CloudTaskMQ, CloudTaskMQConfig } from 'cloudtaskmq';

@Injectable()
export class CloudTaskMQService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CloudTaskMQService.name);
  private cloudTaskMQ: CloudTaskMQ;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const config = this.configService.get<CloudTaskMQConfig>('cloudtaskmq');
    
    this.logger.log('🚀 Initializing CloudTaskMQ...');
    this.logger.log(`📍 Project: ${config.projectId}`);
    this.logger.log(`🌍 Location: ${config.location}`);
    this.logger.log(`💾 Storage: ${config.storageAdapter}`);
    
    try {
      this.cloudTaskMQ = new CloudTaskMQ(config);
      await this.cloudTaskMQ.initialize();
      this.logger.log('✅ CloudTaskMQ initialized successfully');
    } catch (error) {
      this.logger.error('❌ Failed to initialize CloudTaskMQ:', error.message);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.cloudTaskMQ) {
      await this.cloudTaskMQ.close();
      this.logger.log('🔒 CloudTaskMQ connection closed');
    }
  }

  getInstance(): CloudTaskMQ {
    if (!this.cloudTaskMQ) {
      throw new Error('CloudTaskMQ not initialized');
    }
    return this.cloudTaskMQ;
  }

  // Convenience methods
  async addTask(queueName: string, data: any, options?: any) {
    return this.getInstance().addTask(queueName, data, options);
  }

  async getTask(taskId: string) {
    return this.getInstance().getTask(taskId);
  }

  async getQueueStats(queueName: string) {
    return this.getInstance().getQueueStats(queueName);
  }

  async retryTask(taskId: string) {
    return this.getInstance().retryTask(taskId);
  }

  async cleanup(options?: any) {
    return this.getInstance().cleanup(options);
  }

  async pauseQueue(queueName: string) {
    return this.getInstance().pauseQueue(queueName);
  }

  async resumeQueue(queueName: string) {
    return this.getInstance().resumeQueue(queueName);
  }
}
