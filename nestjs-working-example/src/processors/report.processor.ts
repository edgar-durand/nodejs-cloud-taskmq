import { Injectable, Logger } from '@nestjs/common';
import { Processor, Process } from 'cloudtaskmq';
import * as fs from 'fs/promises';
import * as path from 'path';

@Injectable()
@Processor('report-queue')
export class ReportProcessor {
  private readonly logger = new Logger(ReportProcessor.name);

  @Process()
  async handleReportGeneration(data: { 
    reportType: string; 
    userId: string;
    dateRange: { start: string; end: string };
    format: 'pdf' | 'excel' | 'html' | 'json';
    options?: any;
  }) {
    this.logger.log(`📊 Processing report generation task: ${JSON.stringify(data)}`);

    try {
      const { reportType, userId, dateRange, format, options = {} } = data;
      
      // Ensure reports directory exists
      const reportsDir = './reports';
      await fs.mkdir(reportsDir, { recursive: true });
      
      // Generate report data based on type
      const reportData = await this.generateReportData(reportType, userId, dateRange, options);
      
      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${reportType}_${userId}_${timestamp}.${format}`;
      const filePath = path.join(reportsDir, filename);
      
      // Generate report in requested format
      let content: string;
      switch (format) {
        case 'json':
          content = JSON.stringify(reportData, null, 2);
          break;
        case 'html':
          content = this.generateHTMLReport(reportData, reportType);
          break;
        case 'pdf':
          content = await this.generatePDFReport(reportData, reportType);
          break;
        case 'excel':
          content = await this.generateExcelReport(reportData, reportType);
          break;
        default:
          throw new Error(`Unsupported report format: ${format}`);
      }
      
      await fs.writeFile(filePath, content, format === 'json' || format === 'html' ? 'utf8' : 'binary');
      
      this.logger.log(`✅ Report generated successfully: ${filePath}`);
      this.logger.log(`📊 Report stats: ${reportData.length} records, ${content.length} bytes`);

      return {
        success: true,
        reportType,
        userId,
        filePath,
        filename,
        format,
        dateRange,
        recordCount: reportData.length,
        fileSize: content.length,
        generatedAt: new Date().toISOString(),
        message: `${reportType} report generated successfully (${format.toUpperCase()})`,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to generate report: ${error.message}`);
      throw error;
    }
  }

  private async generateReportData(reportType: string, userId: string, dateRange: any, options: any): Promise<any[]> {
    // Simulate report data generation
    const data = [];
    const recordCount = Math.floor(Math.random() * 200) + 100; // 100-300 records

    const startDate = new Date(dateRange.start);
    const endDate = new Date(dateRange.end);
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    for (let i = 0; i < recordCount; i++) {
      const randomDate = new Date(startDate.getTime() + Math.random() * daysDiff * 24 * 60 * 60 * 1000);
      
      switch (reportType) {
        case 'activity_report':
          data.push({
            id: i + 1,
            userId,
            action: ['login', 'logout', 'view_page', 'download_file', 'upload_file', 'send_email'][Math.floor(Math.random() * 6)],
            timestamp: randomDate.toISOString(),
            duration: Math.floor(Math.random() * 3600), // seconds
            ip_address: `192.168.1.${Math.floor(Math.random() * 255)}`,
            device: ['desktop', 'mobile', 'tablet'][Math.floor(Math.random() * 3)],
          });
          break;
          
        case 'performance_report':
          data.push({
            id: i + 1,
            userId,
            metric: ['page_load_time', 'api_response_time', 'database_query_time'][Math.floor(Math.random() * 3)],
            value: (Math.random() * 2000).toFixed(2), // milliseconds
            timestamp: randomDate.toISOString(),
            endpoint: ['/api/tasks', '/api/upload', '/api/dashboard', '/api/queues'][Math.floor(Math.random() * 4)],
          });
          break;
          
        case 'usage_report':
          data.push({
            id: i + 1,
            userId,
            feature: ['email_processing', 'image_processing', 'data_export', 'batch_processing'][Math.floor(Math.random() * 4)],
            usage_count: Math.floor(Math.random() * 100),
            timestamp: randomDate.toISOString(),
            success_rate: (Math.random() * 40 + 60).toFixed(2) + '%', // 60-100%
          });
          break;
          
        default:
          data.push({
            id: i + 1,
            userId,
            type: reportType,
            value: Math.random() * 1000,
            timestamp: randomDate.toISOString(),
            status: ['completed', 'processing', 'failed'][Math.floor(Math.random() * 3)],
          });
      }
    }

    // Sort by timestamp
    return data.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  private generateHTMLReport(data: any[], reportType: string): string {
    const headers = data.length > 0 ? Object.keys(data[0]) : [];
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${reportType.replace('_', ' ').toUpperCase()} Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        table { border-collapse: collapse; width: 100%; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <h1>${reportType.replace('_', ' ').toUpperCase()} Report</h1>
    
    <div class="summary">
        <h3>Summary</h3>
        <p><strong>Total Records:</strong> ${data.length}</p>
        <p><strong>Generated:</strong> ${new Date().toISOString()}</p>
        <p><strong>Report Type:</strong> ${reportType}</p>
    </div>
    
    <table>
        <thead>
            <tr>
                ${headers.map(header => `<th>${header.replace('_', ' ').toUpperCase()}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${data.map(row => `
                <tr>
                    ${headers.map(header => `<td>${row[header]}</td>`).join('')}
                </tr>
            `).join('')}
        </tbody>
    </table>
</body>
</html>`;
  }

  private async generatePDFReport(data: any[], reportType: string): Promise<string> {
    // In a real implementation, you would use a PDF generation library like puppeteer or pdfkit
    // For this example, we'll return a placeholder
    return `PDF Report for ${reportType} - ${data.length} records - Generated: ${new Date().toISOString()}`;
  }

  private async generateExcelReport(data: any[], reportType: string): Promise<string> {
    // In a real implementation, you would use an Excel generation library like exceljs
    // For this example, we'll return CSV format as a placeholder
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
}
