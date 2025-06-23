import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from 'cloudtaskmq';

@Injectable()
@Processor('batch-queue')
export class BatchProcessor {
  private readonly logger = new Logger(BatchProcessor.name);

  @Process({ concurrency: 2 })
  async handleBatchOperation(data: { 
    batchId: string; 
    operation: string; 
    items: any[];
    chunkSize?: number;
  }) {
    this.logger.log(`🔄 Processing batch operation: ${JSON.stringify({ batchId: data.batchId, operation: data.operation, itemCount: data.items.length })}`);

    try {
      const { batchId, operation, items, chunkSize = 10 } = data;
      const results = [];
      const errors = [];
      
      // Process items in chunks
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        
        this.logger.log(`🔄 Processing chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(items.length / chunkSize)} (${chunk.length} items)`);
        
        const chunkResults = await Promise.allSettled(
          chunk.map(item => this.processItem(operation, item, i + chunk.indexOf(item)))
        );
        
        chunkResults.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            errors.push({
              index: i + index,
              item: chunk[index],
              error: result.reason.message,
            });
          }
        });
        
        // Small delay between chunks
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      this.logger.log(`✅ Batch operation completed: ${batchId}`);
      this.logger.log(`📊 Results: ${results.length} successful, ${errors.length} failed`);

      return {
        success: true,
        batchId,
        operation,
        totalItems: items.length,
        successCount: results.length,
        errorCount: errors.length,
        results,
        errors: errors.length > 0 ? errors : undefined,
        message: `Batch operation completed (${results.length}/${items.length} successful)`,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to process batch operation: ${error.message}`);
      throw error;
    }
  }

  private async processItem(operation: string, item: any, index: number): Promise<any> {
    // Simulate processing time
    const processingTime = Math.random() * 500 + 100; // 100-600ms
    await new Promise(resolve => setTimeout(resolve, processingTime));
    
    // Simulate occasional failures (5% chance)
    if (Math.random() < 0.05) {
      throw new Error(`Processing failed for item ${index}`);
    }
    
    switch (operation) {
      case 'validate':
        return {
          index,
          status: 'validated',
          item,
          timestamp: new Date().toISOString(),
          processingTime: Math.round(processingTime),
        };
        
      case 'transform':
        return {
          index,
          status: 'transformed',
          original: item,
          transformed: {
            ...item,
            processed: true,
            processedAt: new Date().toISOString(),
          },
          processingTime: Math.round(processingTime),
        };
        
      case 'enrich':
        return {
          index,
          status: 'enriched',
          item: {
            ...item,
            enrichedData: {
              processedBy: 'CloudTaskMQ BatchProcessor',
              processingTime: Math.round(processingTime),
              enrichedAt: new Date().toISOString(),
              metadata: {
                batchIndex: index,
                randomValue: Math.random(),
              },
            },
          },
          processingTime: Math.round(processingTime),
        };
        
      case 'compress':
        return {
          index,
          status: 'compressed',
          originalSize: JSON.stringify(item).length,
          compressedSize: Math.floor(JSON.stringify(item).length * 0.7), // Simulate compression
          item,
          processingTime: Math.round(processingTime),
        };
        
      default:
        return {
          index,
          status: 'processed',
          item,
          operation,
          processingTime: Math.round(processingTime),
        };
    }
  }
}
