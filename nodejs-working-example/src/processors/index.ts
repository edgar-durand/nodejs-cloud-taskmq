import 'reflect-metadata';
import { getCloudTaskMQ } from '../config/cloudtaskmq';
import { EmailService } from '../services/email.service';
import { Processor, Process } from 'cloudtaskmq';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config';

// Initialize email service
const emailService = new EmailService();

// Email Processor
@Processor('email-queue')
export class EmailProcessor {
  @Process()
  async processEmail(task: any) {
    const { to, subject, text, html } = task.data;
    
    console.log(`📧 Processing email task: ${task.id}`);
    
    try {
      const messageId = await emailService.sendEmail({
        to,
        subject,
        text,
        html,
      });

      console.log(`✅ Email sent successfully: ${messageId}`);
      return { messageId, success: true };
    } catch (error) {
      console.error(`❌ Failed to send email:`, error);
      throw error;
    }
  }
}

// Welcome Email Processor
@Processor('welcome-email-queue')
export class WelcomeEmailProcessor {
  @Process()
  async processWelcomeEmail(task: any) {
    const { email, userName } = task.data;
    
    console.log(`👋 Processing welcome email for: ${userName} (${email})`);
    
    try {
      const messageId = await emailService.sendWelcomeEmail(email, userName);

      console.log(`✅ Welcome email sent successfully: ${messageId}`);
      return { messageId, success: true };
    } catch (error) {
      console.error(`❌ Failed to send welcome email:`, error);
      throw error;
    }
  }
}

// Image Processing Processor
@Processor('image-processing-queue')
export class ImageProcessor {
  @Process()
  async processImage(task: any) {
    const { inputPath, filename, operations } = task.data;
    
    console.log(`🖼️ Processing image: ${filename}`);
    
    try {
      const outputPath = path.join(config.files.processedDir, `processed_${filename}`);
      
      // Ensure output directory exists
      await fs.mkdir(config.files.processedDir, { recursive: true });
      
      let image = sharp(inputPath);
      
      // Apply operations
      if (operations.quality && operations.quality < 100) {
        image = image.jpeg({ quality: operations.quality });
      }
      
      if (operations.format) {
        switch (operations.format) {
          case 'jpeg':
            image = image.jpeg();
            break;
          case 'png':
            image = image.png();
            break;
          case 'webp':
            image = image.webp();
            break;
        }
      }
      
      await image.toFile(outputPath);
      
      console.log(`✅ Image processed successfully: ${outputPath}`);
      return { 
        success: true, 
        outputPath, 
        originalPath: inputPath,
        filename: `processed_${filename}`
      };
    } catch (error) {
      console.error(`❌ Failed to process image:`, error);
      throw error;
    }
  }
}

// Thumbnail Generation Processor
@Processor('thumbnail-queue')
export class ThumbnailProcessor {
  @Process()
  async generateThumbnail(task: any) {
    const { inputPath, filename } = task.data;
    
    console.log(`🖼️ Generating thumbnail for: ${filename}`);
    
    try {
      const thumbnailPath = path.join(config.files.processedDir, `thumb_${filename}`);
      
      // Ensure output directory exists
      await fs.mkdir(config.files.processedDir, { recursive: true });
      
      await sharp(inputPath)
        .resize(200, 200, { 
          fit: 'cover',
          withoutEnlargement: true 
        })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);
      
      console.log(`✅ Thumbnail generated: ${thumbnailPath}`);
      return { 
        success: true, 
        thumbnailPath, 
        originalPath: inputPath,
        filename: `thumb_${filename}`
      };
    } catch (error) {
      console.error(`❌ Failed to generate thumbnail:`, error);
      throw error;
    }
  }
}

// Data Export Processor
@Processor('data-export-queue')
export class DataExportProcessor {
  @Process()
  async exportData(task: any) {
    const { format, filters, outputPath: customPath } = task.data;
    
    console.log(`📊 Processing data export in format: ${format}`);
    
    try {
      // Simulate data export process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const exportPath = customPath || path.join(config.files.processedDir, `export_${Date.now()}.${format}`);
      
      // Ensure output directory exists
      await fs.mkdir(path.dirname(exportPath), { recursive: true });
      
      // Simulate export file creation
      const mockData = {
        exported_at: new Date().toISOString(),
        format,
        filters,
        records_count: Math.floor(Math.random() * 1000) + 100,
        data: Array.from({ length: 10 }, (_, i) => ({
          id: i + 1,
          name: `Record ${i + 1}`,
          value: Math.random() * 100,
        })),
      };
      
      await fs.writeFile(exportPath, JSON.stringify(mockData, null, 2));
      
      console.log(`✅ Data exported successfully: ${exportPath}`);
      return { 
        success: true, 
        exportPath, 
        format,
        recordsCount: mockData.records_count
      };
    } catch (error) {
      console.error(`❌ Failed to export data:`, error);
      throw error;
    }
  }
}

// Report Generation Processor
@Processor('report-queue')
export class ReportProcessor {
  @Process()
  async generateReport(task: any) {
    const { reportType, dateRange, includeCharts } = task.data;
    
    console.log(`📈 Generating ${reportType} report for range: ${dateRange?.start} to ${dateRange?.end}`);
    
    try {
      // Simulate report generation with progress updates
      await task.updateProgress({ percentage: 25, data: { stage: 'Collecting data' } });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await task.updateProgress({ percentage: 50, data: { stage: 'Processing data' } });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await task.updateProgress({ percentage: 75, data: { stage: 'Generating charts' } });
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const reportPath = path.join(config.files.processedDir, `report_${reportType}_${Date.now()}.pdf`);
      
      // Ensure output directory exists
      await fs.mkdir(config.files.processedDir, { recursive: true });
      
      // Simulate report file creation
      await fs.writeFile(reportPath, `Mock ${reportType} report content`);
      
      await task.updateProgress({ percentage: 100, data: { stage: 'Report completed' } });
      
      console.log(`✅ Report generated successfully: ${reportPath}`);
      return { 
        success: true, 
        reportPath, 
        reportType,
        includeCharts,
        generatedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Failed to generate report:`, error);
      throw error;
    }
  }
}

// Batch Processing Processor
@Processor('batch-queue')
export class BatchProcessor {
  @Process()
  async processBatch(task: any) {
    const { items, operation } = task.data;
    
    console.log(`🔄 Processing batch of ${items.length} items with operation: ${operation}`);
    
    try {
      const results = [];
      
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const percentage = Math.round(((i + 1) / items.length) * 100);
        
        // Update progress
        await task.updateProgress({ 
          percentage, 
          data: { 
            processedItems: i + 1, 
            totalItems: items.length,
            currentItem: item.id || i + 1 
          } 
        });
        
        // Simulate processing each item
        await new Promise(resolve => setTimeout(resolve, 200));
        
        results.push({
          id: item.id || i + 1,
          input: item,
          output: `${operation}: ${JSON.stringify(item)}`,
          processedAt: new Date().toISOString(),
        });
      }
      
      console.log(`✅ Batch processing completed: ${results.length} items processed`);
      return { 
        success: true, 
        operation,
        processedCount: results.length,
        results: results.slice(0, 10), // Return first 10 for brevity
        totalResults: results.length
      };
    } catch (error) {
      console.error(`❌ Failed to process batch:`, error);
      throw error;
    }
  }
}

// Chain Processing Processor
@Processor('chain-queue')
export class ChainProcessor {
  @Process()
  async processChainStep(task: any) {
    const { step, totalSteps, payload } = task.data;
    
    console.log(`🔗 Processing chain step ${step}/${totalSteps}`);
    
    try {
      // Simulate step processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const result = {
        step,
        totalSteps,
        payload,
        processedAt: new Date().toISOString(),
        stepResult: `Step ${step} completed with payload: ${JSON.stringify(payload)}`,
      };
      
      console.log(`✅ Chain step ${step}/${totalSteps} completed`);
      return result;
    } catch (error) {
      console.error(`❌ Failed to process chain step:`, error);
      throw error;
    }
  }
}

// Register all processors
export async function registerProcessors() {
  const taskMQ = getCloudTaskMQ();
  
  console.log('📝 Registering processor instances...');
  
  // Register processor instances
  taskMQ.registerProcessor(new EmailProcessor());
  taskMQ.registerProcessor(new WelcomeEmailProcessor());
  taskMQ.registerProcessor(new ImageProcessor());
  taskMQ.registerProcessor(new ThumbnailProcessor());
  taskMQ.registerProcessor(new DataExportProcessor());
  taskMQ.registerProcessor(new ReportProcessor());
  taskMQ.registerProcessor(new BatchProcessor());
  taskMQ.registerProcessor(new ChainProcessor());
  
  console.log('✅ All processors registered successfully');
}
