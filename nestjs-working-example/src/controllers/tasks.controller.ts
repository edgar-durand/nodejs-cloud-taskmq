import { Controller, Post, Get, Body, Param, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { CloudTaskMQService } from '../cloudtaskmq/cloudtaskmq.service';
import {
  EmailTaskDto,
  WelcomeEmailTaskDto,
  ImageProcessingTaskDto,
  DataExportTaskDto,
  BatchTaskDto,
  NotificationTaskDto,
  TaskOptionsDto,
} from '../dto/task.dto';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  private readonly logger = new Logger(TasksController.name);

  constructor(private readonly cloudTaskMQService: CloudTaskMQService) {}

  @Post('email')
  @ApiOperation({ summary: 'Send email task to queue' })
  @ApiResponse({ status: 201, description: 'Email task queued successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  async sendEmail(@Body() emailData: EmailTaskDto, @Query() options?: TaskOptionsDto) {
    try {
      this.logger.log(`📧 Queuing email task: ${emailData.to}`);
      
      const task = await this.cloudTaskMQService.addTask('email-queue', emailData, options);
      
      return {
        success: true,
        taskId: task.id,
        queueName: 'email-queue',
        data: emailData,
        message: 'Email task queued successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to queue email task: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('welcome-email')
  @ApiOperation({ summary: 'Send welcome email task to queue' })
  @ApiResponse({ status: 201, description: 'Welcome email task queued successfully' })
  async sendWelcomeEmail(@Body() welcomeData: WelcomeEmailTaskDto, @Query() options?: TaskOptionsDto) {
    try {
      this.logger.log(`👋 Queuing welcome email task: ${welcomeData.email}`);
      
      const task = await this.cloudTaskMQService.addTask('welcome-email-queue', welcomeData, options);
      
      return {
        success: true,
        taskId: task.id,
        queueName: 'welcome-email-queue',
        data: welcomeData,
        message: 'Welcome email task queued successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to queue welcome email task: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('image-processing')
  @ApiOperation({ summary: 'Process image task' })
  @ApiResponse({ status: 201, description: 'Image processing task queued successfully' })
  async processImage(@Body() imageData: ImageProcessingTaskDto, @Query() options?: TaskOptionsDto) {
    try {
      this.logger.log(`🖼️ Queuing image processing task: ${imageData.imagePath}`);
      
      const task = await this.cloudTaskMQService.addTask('image-processing-queue', imageData, options);
      
      return {
        success: true,
        taskId: task.id,
        queueName: 'image-processing-queue',
        data: imageData,
        message: 'Image processing task queued successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to queue image processing task: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('data-export')
  @ApiOperation({ summary: 'Export data task' })
  @ApiResponse({ status: 201, description: 'Data export task queued successfully' })
  async exportData(@Body() exportData: DataExportTaskDto, @Query() options?: TaskOptionsDto) {
    try {
      this.logger.log(`📊 Queuing data export task: ${exportData.userId} (${exportData.format})`);
      
      const task = await this.cloudTaskMQService.addTask('data-export-queue', exportData, options);
      
      return {
        success: true,
        taskId: task.id,
        queueName: 'data-export-queue',
        data: exportData,
        message: 'Data export task queued successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to queue data export task: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('batch')
  @ApiOperation({ summary: 'Process batch operations' })
  @ApiResponse({ status: 201, description: 'Batch processing task queued successfully' })
  async processBatch(@Body() batchData: BatchTaskDto, @Query() options?: TaskOptionsDto) {
    try {
      this.logger.log(`🔄 Queuing batch task: ${batchData.batchId} (${batchData.items.length} items)`);
      
      const task = await this.cloudTaskMQService.addTask('batch-queue', batchData, options);
      
      return {
        success: true,
        taskId: task.id,
        queueName: 'batch-queue',
        data: {
          batchId: batchData.batchId,
          operation: batchData.operation,
          itemCount: batchData.items.length,
        },
        message: 'Batch processing task queued successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to queue batch task: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('notification')
  @ApiOperation({ summary: 'Send notification task' })
  @ApiResponse({ status: 201, description: 'Notification task queued successfully' })
  async sendNotification(@Body() notificationData: NotificationTaskDto, @Query() options?: TaskOptionsDto) {
    try {
      this.logger.log(`🔔 Queuing notification task: ${notificationData.type} to ${notificationData.recipient}`);
      
      const task = await this.cloudTaskMQService.addTask('notification-queue', notificationData, options);
      
      return {
        success: true,
        taskId: task.id,
        queueName: 'notification-queue',
        data: notificationData,
        message: 'Notification task queued successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to queue notification task: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get(':taskId')
  @ApiOperation({ summary: 'Get task details by ID' })
  @ApiParam({ name: 'taskId', description: 'Task ID' })
  @ApiResponse({ status: 200, description: 'Task details retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async getTask(@Param('taskId') taskId: string) {
    try {
      const task = await this.cloudTaskMQService.getTask(taskId);
      
      if (!task) {
        throw new HttpException('Task not found', HttpStatus.NOT_FOUND);
      }
      
      return {
        success: true,
        task,
      };
    } catch (error) {
      this.logger.error(`Failed to get task ${taskId}: ${error.message}`);
      
      if (error instanceof HttpException) {
        throw error;
      }
      
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post(':taskId/retry')
  @ApiOperation({ summary: 'Retry a failed task' })
  @ApiParam({ name: 'taskId', description: 'Task ID to retry' })
  @ApiResponse({ status: 200, description: 'Task retry initiated successfully' })
  @ApiResponse({ status: 404, description: 'Task not found' })
  async retryTask(@Param('taskId') taskId: string) {
    try {
      const result = await this.cloudTaskMQService.retryTask(taskId);
      
      return {
        success: true,
        taskId,
        message: 'Task retry initiated successfully',
        result,
      };
    } catch (error) {
      this.logger.error(`Failed to retry task ${taskId}: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
