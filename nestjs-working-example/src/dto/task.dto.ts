import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEmail, IsOptional, IsArray, IsEnum, IsObject, IsNumber, Min, Max, IsBoolean } from 'class-validator';

export class EmailTaskDto {
  @ApiProperty({ example: 'user@example.com', description: 'Recipient email address' })
  @IsEmail()
  to: string;

  @ApiProperty({ example: 'Welcome to CloudTaskMQ!', description: 'Email subject' })
  @IsString()
  subject: string;

  @ApiProperty({ example: 'Thank you for joining our platform...', description: 'Email text content' })
  @IsString()
  text: string;

  @ApiPropertyOptional({ example: '<h1>Welcome!</h1><p>Thank you for joining...</p>', description: 'Email HTML content' })
  @IsOptional()
  @IsString()
  html?: string;
}

export class WelcomeEmailTaskDto {
  @ApiProperty({ example: 'user@example.com', description: 'New user email address' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'New user name' })
  @IsString()
  userName: string;

  @ApiPropertyOptional({ enum: ['standard', 'premium'], description: 'Welcome email type' })
  @IsOptional()
  @IsEnum(['standard', 'premium'])
  welcomeType?: string;
}

export class ImageProcessingTaskDto {
  @ApiProperty({ example: './uploads/image.jpg', description: 'Path to the image file' })
  @IsString()
  imagePath: string;

  @ApiProperty({ 
    example: ['resize', 'optimize'], 
    description: 'Array of operations to apply',
    enum: ['resize', 'optimize', 'grayscale', 'blur', 'sharpen', 'normalize']
  })
  @IsArray()
  @IsString({ each: true })
  operations: string[];

  @ApiPropertyOptional({ example: './processed/output.jpg', description: 'Output file path' })
  @IsOptional()
  @IsString()
  outputPath?: string;

  @ApiPropertyOptional({ enum: ['jpeg', 'png', 'webp'], description: 'Output format' })
  @IsOptional()
  @IsEnum(['jpeg', 'png', 'webp'])
  format?: 'jpeg' | 'png' | 'webp';

  @ApiPropertyOptional({ example: 80, description: 'Output quality (1-100)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  quality?: number;
}

export class DataExportTaskDto {
  @ApiProperty({ example: 'user123', description: 'User ID for the export' })
  @IsString()
  userId: string;

  @ApiProperty({ enum: ['csv', 'json', 'xml'], description: 'Export format' })
  @IsEnum(['csv', 'json', 'xml'])
  format: 'csv' | 'json' | 'xml';

  @ApiProperty({ 
    example: 'user_activity', 
    description: 'Type of data to export',
    enum: ['user_activity', 'transactions', 'generic']
  })
  @IsString()
  dataType: string;

  @ApiPropertyOptional({ description: 'Filters to apply to the export' })
  @IsOptional()
  @IsObject()
  filters?: any;
}

export class BatchTaskDto {
  @ApiProperty({ example: 'batch_001', description: 'Unique batch identifier' })
  @IsString()
  batchId: string;

  @ApiProperty({ 
    example: 'validate', 
    description: 'Operation to perform on each item',
    enum: ['validate', 'transform', 'enrich', 'compress']
  })
  @IsString()
  operation: string;

  @ApiProperty({ example: [{ id: 1, data: 'item1' }], description: 'Array of items to process' })
  @IsArray()
  items: any[];

  @ApiPropertyOptional({ example: 10, description: 'Number of items to process per chunk' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  chunkSize?: number;
}

export class NotificationTaskDto {
  @ApiProperty({ enum: ['push', 'sms', 'webhook', 'slack'], description: 'Notification type' })
  @IsEnum(['push', 'sms', 'webhook', 'slack'])
  type: 'push' | 'sms' | 'webhook' | 'slack';

  @ApiProperty({ example: 'user@example.com', description: 'Notification recipient' })
  @IsString()
  recipient: string;

  @ApiProperty({ example: 'Task Completed', description: 'Notification title' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Your task has been completed successfully', description: 'Notification message' })
  @IsString()
  message: string;

  @ApiPropertyOptional({ description: 'Additional notification metadata' })
  @IsOptional()
  @IsObject()
  metadata?: any;
}

export class TaskOptionsDto {
  @ApiPropertyOptional({ example: 30, description: 'Task delay in seconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  delay?: number;

  @ApiPropertyOptional({ example: 3, description: 'Maximum retry attempts' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(10)
  maxRetries?: number;

  @ApiPropertyOptional({ example: 'high', enum: ['low', 'normal', 'high'], description: 'Task priority' })
  @IsOptional()
  @IsEnum(['low', 'normal', 'high'])
  priority?: string;

  @ApiPropertyOptional({ example: true, description: 'Whether to remove task data after completion' })
  @IsOptional()
  @IsBoolean()
  removeOnComplete?: boolean;
}
