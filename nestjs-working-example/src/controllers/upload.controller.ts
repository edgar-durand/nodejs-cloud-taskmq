import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes } from '@nestjs/swagger';
import * as multer from 'multer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { CloudTaskMQService } from '../cloudtaskmq/cloudtaskmq.service';
import { UploadProcessingDto } from '../dto/upload.dto';

@ApiTags('upload')
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly cloudTaskMQService: CloudTaskMQService) {}

  @Post('image')
  @ApiOperation({ summary: 'Upload and process image file' })
  @ApiResponse({ status: 201, description: 'Image uploaded and processing task queued' })
  @ApiResponse({ status: 400, description: 'Invalid file or request data' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.diskStorage({
        destination: async (req, file, cb) => {
          const uploadDir = './uploads';
          await fs.mkdir(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'), false);
        }
      },
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
      },
    }),
  )
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() processingOptions: UploadProcessingDto,
  ) {
    if (!file) {
      throw new HttpException('No file provided', HttpStatus.BAD_REQUEST);
    }

    try {
      this.logger.log(`📤 Image uploaded: ${file.filename} (${file.size} bytes)`);

      const tasks = [];
      
      // Queue image processing task
      if (processingOptions.operations && processingOptions.operations.length > 0) {
        const imageTask = await this.cloudTaskMQService.addTask('image-processing-queue', {
          imagePath: file.path,
          operations: processingOptions.operations,
          format: processingOptions.format || 'jpeg',
          quality: processingOptions.quality || 80,
        });
        
        tasks.push({
          type: 'image-processing',
          taskId: imageTask.taskId,
          queueName: 'image-processing-queue',
        });
      }

      // Queue thumbnail generation if requested
      if (processingOptions.generateThumbnails) {
        const thumbnailTask = await this.cloudTaskMQService.addTask('thumbnail-queue', {
          imagePath: file.path,
          sizes: [
            { width: 150, height: 150, suffix: 'thumb' },
            { width: 300, height: 300, suffix: 'medium' },
            { width: 600, height: 600, suffix: 'large' },
          ],
        });
        
        tasks.push({
          type: 'thumbnail-generation',
          taskId: thumbnailTask.taskId,
          queueName: 'thumbnail-queue',
        });
      }

      return {
        success: true,
        file: {
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          size: file.size,
          mimetype: file.mimetype,
        },
        tasks,
        message: `Image uploaded successfully. ${tasks.length} processing task(s) queued.`,
      };
    } catch (error) {
      this.logger.error(`Failed to process uploaded image: ${error.message}`);
      
      // Clean up uploaded file on error
      if (file && file.path) {
        try {
          await fs.unlink(file.path);
        } catch (cleanupError) {
          this.logger.error(`Failed to cleanup file: ${cleanupError.message}`);
        }
      }
      
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('batch-images')
  @ApiOperation({ summary: 'Upload multiple images for batch processing' })
  @ApiResponse({ status: 201, description: 'Images uploaded and batch processing task queued' })
  @UseInterceptors(
    FileInterceptor('files', {
      storage: multer.diskStorage({
        destination: async (req, file, cb) => {
          const uploadDir = './uploads/batch';
          await fs.mkdir(uploadDir, { recursive: true });
          cb(null, uploadDir);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
          const ext = path.extname(file.originalname);
          cb(null, `batch-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
          cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'), false);
        }
      },
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB total limit
      },
    }),
  )
  async uploadBatchImages(
    @UploadedFile() files: Express.Multer.File[],
    @Body() processingOptions: UploadProcessingDto,
  ) {
    if (!files || files.length === 0) {
      throw new HttpException('No files provided', HttpStatus.BAD_REQUEST);
    }

    try {
      this.logger.log(`📤 Batch upload: ${files.length} images`);

      const fileData = Array.isArray(files) ? files : [files];
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const items = fileData.map((file, index) => ({
        index,
        imagePath: file.path,
        originalName: file.originalname,
        operations: processingOptions.operations || ['resize', 'optimize'],
        format: processingOptions.format || 'jpeg',
        quality: processingOptions.quality || 80,
      }));

      const batchTask = await this.cloudTaskMQService.addTask('batch-queue', {
        batchId,
        operation: 'image_processing',
        items,
        chunkSize: 5, // Process 5 images at a time
      });

      return {
        success: true,
        batchId,
        taskId: batchTask.taskId,
        queueName: 'batch-queue',
        fileCount: fileData.length,
        files: fileData.map(file => ({
          originalName: file.originalname,
          filename: file.filename,
          size: file.size,
        })),
        message: `${fileData.length} images uploaded successfully. Batch processing task queued.`,
      };
    } catch (error) {
      this.logger.error(`Failed to process batch upload: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
