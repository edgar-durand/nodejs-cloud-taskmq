import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { config } from '../config';

export interface ImageProcessingTask {
  inputPath: string;
  filename: string;
  operations: {
    resize?: { width: number; height: number };
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp';
    watermark?: { text: string; position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' };
  };
}

export class ImageService {
  private processedDir: string;

  constructor() {
    this.processedDir = config.files.processedDir;
    this.ensureDirectories();
  }

  private async ensureDirectories() {
    try {
      await fs.access(this.processedDir);
    } catch {
      await fs.mkdir(this.processedDir, { recursive: true });
    }
  }

  async processImage(task: ImageProcessingTask): Promise<string> {
    try {
      const { inputPath, filename, operations } = task;
      
      // Generate output filename
      const ext = operations.format || path.extname(filename).slice(1) || 'jpeg';
      const outputFilename = `processed_${Date.now()}_${path.parse(filename).name}.${ext}`;
      const outputPath = path.join(this.processedDir, outputFilename);

      // Start Sharp processing pipeline
      let pipeline = sharp(inputPath);

      // Apply resize if specified
      if (operations.resize) {
        pipeline = pipeline.resize(operations.resize.width, operations.resize.height, {
          fit: 'cover',
          position: 'center',
        });
      }

      // Apply format and quality
      switch (operations.format || 'jpeg') {
        case 'jpeg':
          pipeline = pipeline.jpeg({ quality: operations.quality || 80 });
          break;
        case 'png':
          pipeline = pipeline.png({ quality: operations.quality || 80 });
          break;
        case 'webp':
          pipeline = pipeline.webp({ quality: operations.quality || 80 });
          break;
      }

      // Save the processed image
      await pipeline.toFile(outputPath);

      // Add watermark if specified (simple text overlay)
      if (operations.watermark) {
        await this.addTextWatermark(outputPath, operations.watermark);
      }

      console.log(`🖼️ Image processed successfully: ${outputFilename}`);
      
      // Clean up original file
      try {
        await fs.unlink(inputPath);
      } catch (error) {
        console.warn('⚠️ Failed to delete original file:', error);
      }

      return outputPath;
    } catch (error) {
      console.error('❌ Image processing failed:', error);
      throw error;
    }
  }

  private async addTextWatermark(imagePath: string, watermark: { text: string; position: string }) {
    try {
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      if (!metadata.width || !metadata.height) {
        throw new Error('Cannot get image dimensions');
      }

      // Create text SVG overlay
      const textSize = Math.floor(Math.min(metadata.width, metadata.height) * 0.05);
      const svgText = `
        <svg width="${metadata.width}" height="${metadata.height}">
          <text x="${this.getWatermarkX(watermark.position, metadata.width, watermark.text.length * textSize * 0.6)}" 
                y="${this.getWatermarkY(watermark.position, metadata.height, textSize)}" 
                font-family="Arial" 
                font-size="${textSize}" 
                fill="rgba(255,255,255,0.7)" 
                stroke="rgba(0,0,0,0.3)" 
                stroke-width="1">
            ${watermark.text}
          </text>
        </svg>
      `;

      const svgBuffer = Buffer.from(svgText);

      await image
        .composite([{ input: svgBuffer, top: 0, left: 0 }])
        .toFile(imagePath + '_temp');

      // Replace original with watermarked version
      await fs.rename(imagePath + '_temp', imagePath);
    } catch (error) {
      console.warn('⚠️ Failed to add watermark:', error);
    }
  }

  private getWatermarkX(position: string, width: number, textWidth: number): number {
    switch (position) {
      case 'top-right':
      case 'bottom-right':
        return width - textWidth - 20;
      case 'top-left':
      case 'bottom-left':
      default:
        return 20;
    }
  }

  private getWatermarkY(position: string, height: number, textSize: number): number {
    switch (position) {
      case 'bottom-left':
      case 'bottom-right':
        return height - 20;
      case 'top-left':
      case 'top-right':
      default:
        return textSize + 20;
    }
  }

  async generateThumbnails(inputPath: string, filename: string): Promise<string[]> {
    const thumbnails: string[] = [];
    const sizes = [
      { name: 'small', width: 150, height: 150 },
      { name: 'medium', width: 300, height: 300 },
      { name: 'large', width: 600, height: 600 },
    ];

    for (const size of sizes) {
      try {
        const outputFilename = `thumb_${size.name}_${Date.now()}_${path.parse(filename).name}.jpeg`;
        const outputPath = path.join(this.processedDir, outputFilename);

        await sharp(inputPath)
          .resize(size.width, size.height, { fit: 'cover', position: 'center' })
          .jpeg({ quality: 85 })
          .toFile(outputPath);

        thumbnails.push(outputPath);
        console.log(`🖼️ Thumbnail created: ${outputFilename}`);
      } catch (error) {
        console.error(`❌ Failed to create ${size.name} thumbnail:`, error);
      }
    }

    return thumbnails;
  }
}
