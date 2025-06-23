import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from 'cloudtaskmq';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
@Processor('data-export-queue')
export class DataExportProcessor {
  private readonly logger = new Logger(DataExportProcessor.name);

  @Process()
  async handleDataExport(data: { 
    userId: string; 
    format: 'csv' | 'json' | 'xml'; 
    dataType: string;
    filters?: any;
  }) {
    this.logger.log(`📊 Processing data export task: ${JSON.stringify(data)}`);

    try {
      const { userId, format, dataType, filters } = data;
      
      // Simulate data generation
      const exportData = await this.generateExportData(userId, dataType, filters);
      
      // Ensure export directory exists
      const exportDir = './exports';
      await fs.mkdir(exportDir, { recursive: true });
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${dataType}_export_${userId}_${timestamp}.${format}`;
      const filePath = path.join(exportDir, filename);
      
      // Convert and save data based on format
      let content: string;
      switch (format) {
        case 'csv':
          content = this.convertToCSV(exportData);
          break;
        case 'json':
          content = JSON.stringify(exportData, null, 2);
          break;
        case 'xml':
          content = this.convertToXML(exportData);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
      
      await fs.writeFile(filePath, content, 'utf8');
      
      this.logger.log(`✅ Data export completed: ${filePath}`);
      this.logger.log(`📊 Export stats: ${exportData.length} records, ${content.length} bytes`);

      return {
        success: true,
        filePath,
        filename,
        recordCount: exportData.length,
        fileSize: content.length,
        format,
        message: `Data export completed successfully (${format.toUpperCase()})`,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to export data: ${error.message}`);
      throw error;
    }
  }

  private async generateExportData(userId: string, dataType: string, filters?: any): Promise<any[]> {
    // Simulate data generation based on type
    const baseData = [];
    const recordCount = Math.floor(Math.random() * 100) + 50; // 50-150 records

    for (let i = 0; i < recordCount; i++) {
      switch (dataType) {
        case 'user_activity':
          baseData.push({
            id: i + 1,
            userId,
            action: ['login', 'logout', 'view_page', 'click_button', 'download'][Math.floor(Math.random() * 5)],
            timestamp: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
            ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`,
            user_agent: 'Mozilla/5.0 (compatible; CloudTaskMQ/1.0)',
          });
          break;
        case 'transactions':
          baseData.push({
            id: i + 1,
            userId,
            amount: (Math.random() * 1000).toFixed(2),
            currency: 'USD',
            status: ['completed', 'pending', 'failed'][Math.floor(Math.random() * 3)],
            created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
          break;
        default:
          baseData.push({
            id: i + 1,
            userId,
            data: `Sample data record ${i + 1}`,
            created_at: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          });
      }
    }

    // Apply filters if provided
    if (filters) {
      // Simple filter implementation
      return baseData.filter(record => {
        for (const [key, value] of Object.entries(filters)) {
          if (record[key] && record[key] !== value) {
            return false;
          }
        }
        return true;
      });
    }

    return baseData;
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];
    
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        return typeof value === 'string' ? `"${value.replace(/"/g, '""')}"` : value;
      });
      csvRows.push(values.join(','));
    }
    
    return csvRows.join('\n');
  }

  private convertToXML(data: any[]): string {
    const xmlRows = ['<?xml version="1.0" encoding="UTF-8"?>', '<data>'];
    
    for (const item of data) {
      xmlRows.push('  <record>');
      for (const [key, value] of Object.entries(item)) {
        xmlRows.push(`    <${key}>${this.escapeXml(String(value))}</${key}>`);
      }
      xmlRows.push('  </record>');
    }
    
    xmlRows.push('</data>');
    return xmlRows.join('\n');
  }

  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
