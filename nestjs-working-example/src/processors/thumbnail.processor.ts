import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from 'cloudtaskmq';
import * as sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
@Processor('thumbnail-queue')
export class ThumbnailProcessor {
  private readonly logger = new Logger(ThumbnailProcessor.name);

  @Process()
  async handleThumbnailGeneration(data: { 
    imagePath: string; 
    sizes: Array<{ width: number; height: number; suffix: string }>;
    outputDir?: string;
  }) {
    this.logger.log(`🖼️ Processing thumbnail generation task: ${JSON.stringify(data)}`);

    try {
      const { imagePath, sizes, outputDir = './thumbnails' } = data;
      
      // Ensure output directory exists
      await fs.mkdir(outputDir, { recursive: true });

      const results = [];
      const originalFileName = path.basename(imagePath, path.extname(imagePath));
      const originalExt = path.extname(imagePath);

      for (const size of sizes) {
        const thumbnailPath = path.join(
          outputDir, 
          `${originalFileName}_${size.suffix}_${size.width}x${size.height}${originalExt}`
        );

        try {
          const info = await sharp(imagePath)
            .resize(size.width, size.height, {
              fit: 'cover',
              position: 'center',
            })
            .jpeg({ quality: 85, progressive: true })
            .toFile(thumbnailPath);

          results.push({
            size: `${size.width}x${size.height}`,
            suffix: size.suffix,
            path: thumbnailPath,
            info: {
              width: info.width,
              height: info.height,
              size: info.size,
              format: info.format,
            },
          });

          this.logger.log(`✅ Thumbnail generated: ${size.suffix} (${size.width}x${size.height})`);
        } catch (sizeError) {
          this.logger.error(`❌ Failed to generate ${size.suffix} thumbnail: ${sizeError.message}`);
          results.push({
            size: `${size.width}x${size.height}`,
            suffix: size.suffix,
            error: sizeError.message,
          });
        }
      }

      const successCount = results.filter(result => !result.error).length;
      const failureCount = results.filter(result => result.error).length;

      this.logger.log(`✅ Thumbnail generation completed: ${successCount} successful, ${failureCount} failed`);

      return {
        success: true,
        originalImage: imagePath,
        thumbnails: results,
        summary: {
          total: sizes.length,
          successful: successCount,
          failed: failureCount,
        },
        message: `Thumbnail generation completed (${successCount}/${sizes.length} successful)`,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to generate thumbnails: ${error.message}`);
      throw error;
    }
  }
}
