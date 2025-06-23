import { Module } from '@nestjs/common';
import { EmailProcessor } from './email.processor';
import { WelcomeEmailProcessor } from './welcome-email.processor';
import { ImageProcessingProcessor } from './image-processing.processor';
import { ThumbnailProcessor } from './thumbnail.processor';
import { DataExportProcessor } from './data-export.processor';
import { ReportProcessor } from './report.processor';
import { BatchProcessor } from './batch.processor';
import { NotificationProcessor } from './notification.processor';

@Module({
  providers: [
    EmailProcessor,
    WelcomeEmailProcessor,
    ImageProcessingProcessor,
    ThumbnailProcessor,
    DataExportProcessor,
    ReportProcessor,
    BatchProcessor,
    NotificationProcessor,
  ],
  exports: [
    EmailProcessor,
    WelcomeEmailProcessor,
    ImageProcessingProcessor,
    ThumbnailProcessor,
    DataExportProcessor,
    ReportProcessor,
    BatchProcessor,
    NotificationProcessor,
  ],
})
export class ProcessorsModule {}
