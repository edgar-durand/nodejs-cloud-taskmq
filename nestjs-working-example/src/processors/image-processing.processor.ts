import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from 'cloudtaskmq';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
@Processor('image-processing-queue')
export class ImageProcessingProcessor {
  private readonly logger = new Logger(ImageProcessingProcessor.name);

  @Process()
  async handleImageProcessing(data: { 
    imagePath: string; 
    operations: string[]; 
    outputPath?: string;
    format?: 'jpeg' | 'png' | 'webp';
    quality?: number;
  }) {
    this.logger.log(`🖼️ Processing image task: ${JSON.stringify(data)}`);

    try {
      const { imagePath, operations, outputPath, format = 'jpeg', quality = 80 } = data;
      
      // Ensure upload directories exist
      const uploadDir = './uploads';
      const processedDir = './processed';
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.mkdir(processedDir, { recursive: true });

      let image = sharp(imagePath);
      
      // Apply operations
      for (const operation of operations) {
        switch (operation) {
          case 'resize':
            image = image.resize(800, 600, { fit: 'inside', withoutEnlargement: true });
            break;
          case 'optimize':
            image = image.jpeg({ quality, progressive: true });
            break;
          case 'grayscale':
            image = image.grayscale();
            break;
          case 'blur':
            image = image.blur(2);
            break;
          case 'sharpen':
            image = image.sharpen();
            break;
          case 'normalize':
            image = image.normalize();
            break;
        }
      }

      // Set output format
      switch (format) {
        case 'png':
          image = image.png({ quality });
          break;
        case 'webp':
          image = image.webp({ quality });
          break;
        default:
          image = image.jpeg({ quality });
      }

      // Generate output path if not provided
      const finalOutputPath = outputPath || path.join(
        processedDir, 
        `processed_${Date.now()}_${path.basename(imagePath, path.extname(imagePath))}.${format}`
      );

      // Process and save image
      const info = await image.toFile(finalOutputPath);
      
      this.logger.log(`✅ Image processed successfully: ${finalOutputPath}`);
      this.logger.log(`📊 Image info: ${info.width}x${info.height}, ${info.size} bytes, ${info.format}`);

      return {
        success: true,
        outputPath: finalOutputPath,
        info: {
          width: info.width,
          height: info.height,
          size: info.size,
          format: info.format,
        },
        operations: operations,
        message: 'Image processed successfully',
      };
    } catch (error) {
      this.logger.error(`❌ Failed to process image: ${error.message}`);
      throw error;
    }
  }
}
