import { Controller, Get, Post, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CloudTaskMQService } from '../cloudtaskmq/cloudtaskmq.service';

@ApiTags('queues')
@Controller('queues')
export class QueuesController {
  private readonly logger = new Logger(QueuesController.name);

  constructor(private readonly cloudTaskMQService: CloudTaskMQService) {}

  @Get()
  @ApiOperation({ summary: 'Get all queue statistics' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved successfully' })
  async getAllQueueStats() {
    try {
      const queueNames = [
        'email-queue',
        'welcome-email-queue',
        'image-processing-queue',
        'thumbnail-queue',
        'data-export-queue',
        'report-queue',
        'batch-queue',
        'notification-queue',
      ];

      const stats = {};
      
      for (const queueName of queueNames) {
        try {
          stats[queueName] = await this.cloudTaskMQService.getQueueStats(queueName);
        } catch (error) {
          this.logger.warn(`Failed to get stats for queue ${queueName}: ${error.message}`);
          stats[queueName] = { error: error.message };
        }
      }

      return {
        success: true,
        queues: stats,
        totalQueues: queueNames.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get queue statistics: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':queueName')
  @ApiOperation({ summary: 'Get statistics for a specific queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue' })
  @ApiResponse({ status: 200, description: 'Queue statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Queue not found' })
  async getQueueStats(@Param('queueName') queueName: string) {
    try {
      const stats = await this.cloudTaskMQService.getQueueStats(queueName);
      
      return {
        success: true,
        queueName,
        stats,
      };
    } catch (error) {
      this.logger.error(`Failed to get stats for queue ${queueName}: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':queueName/pause')
  @ApiOperation({ summary: 'Pause a queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to pause' })
  @ApiResponse({ status: 200, description: 'Queue paused successfully' })
  async pauseQueue(@Param('queueName') queueName: string) {
    try {
      await this.cloudTaskMQService.pauseQueue(queueName);
      
      this.logger.log(`⏸️ Queue paused: ${queueName}`);
      
      return {
        success: true,
        queueName,
        status: 'paused',
        message: 'Queue paused successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to pause queue ${queueName}: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':queueName/resume')
  @ApiOperation({ summary: 'Resume a paused queue' })
  @ApiParam({ name: 'queueName', description: 'Name of the queue to resume' })
  @ApiResponse({ status: 200, description: 'Queue resumed successfully' })
  async resumeQueue(@Param('queueName') queueName: string) {
    try {
      await this.cloudTaskMQService.resumeQueue(queueName);
      
      this.logger.log(`▶️ Queue resumed: ${queueName}`);
      
      return {
        success: true,
        queueName,
        status: 'active',
        message: 'Queue resumed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to resume queue ${queueName}: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('cleanup')
  @ApiOperation({ summary: 'Clean up completed and failed tasks' })
  @ApiQuery({ name: 'olderThan', required: false, description: 'Clean tasks older than this many hours' })
  @ApiQuery({ name: 'status', required: false, description: 'Status of tasks to clean', enum: ['completed', 'failed', 'all'] })
  @ApiResponse({ status: 200, description: 'Cleanup completed successfully' })
  async cleanupTasks(
    @Query('olderThan') olderThan?: number,
    @Query('status') status?: string,
  ) {
    try {
      const options = {
        olderThan: olderThan ? parseInt(String(olderThan)) : 24, // Default 24 hours
        status: status || 'completed',
      };

      const result = await this.cloudTaskMQService.cleanup(options);
      
      this.logger.log(`🧹 Cleanup completed: ${JSON.stringify(result)}`);
      
      return {
        success: true,
        options,
        result,
        message: 'Cleanup completed successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to cleanup tasks: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
