import { Controller, Post, Body, Param, Req, Res, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';

@ApiTags('processors')
@Controller('processors')
export class ProcessorsController {
  private readonly logger = new Logger(ProcessorsController.name);

  @Post('email')
  @ApiExcludeEndpoint() // Hide from Swagger as this is for GCP callbacks only
  async processEmail(@Body() taskData: any, @Req() req: Request, @Res() res: Response) {
    return this.handleProcessorCallback('email', taskData, req, res);
  }

  @Post('welcome-email')
  @ApiExcludeEndpoint()
  async processWelcomeEmail(@Body() taskData: any, @Req() req: Request, @Res() res: Response) {
    return this.handleProcessorCallback('welcome-email', taskData, req, res);
  }

  @Post('image-processing')
  @ApiExcludeEndpoint()
  async processImageProcessing(@Body() taskData: any, @Req() req: Request, @Res() res: Response) {
    return this.handleProcessorCallback('image-processing', taskData, req, res);
  }

  @Post('thumbnail')
  @ApiExcludeEndpoint()
  async processThumbnail(@Body() taskData: any, @Req() req: Request, @Res() res: Response) {
    return this.handleProcessorCallback('thumbnail', taskData, req, res);
  }

  @Post('data-export')
  @ApiExcludeEndpoint()
  async processDataExport(@Body() taskData: any, @Req() req: Request, @Res() res: Response) {
    return this.handleProcessorCallback('data-export', taskData, req, res);
  }

  @Post('report')
  @ApiExcludeEndpoint()
  async processReport(@Body() taskData: any, @Req() req: Request, @Res() res: Response) {
    return this.handleProcessorCallback('report', taskData, req, res);
  }

  @Post('batch')
  @ApiExcludeEndpoint()
  async processBatch(@Body() taskData: any, @Req() req: Request, @Res() res: Response) {
    return this.handleProcessorCallback('batch', taskData, req, res);
  }

  @Post('notification')
  @ApiExcludeEndpoint()
  async processNotification(@Body() taskData: any, @Req() req: Request, @Res() res: Response) {
    return this.handleProcessorCallback('notification', taskData, req, res);
  }

  @Post()
  @ApiExcludeEndpoint()
  async processDefault(@Body() taskData: any, @Req() req: Request, @Res() res: Response) {
    return this.handleProcessorCallback('default', taskData, req, res);
  }

  private async handleProcessorCallback(
    processorType: string,
    taskData: any,
    req: Request,
    res: Response,
  ) {
    const userAgent = req.get('User-Agent') || '';
    const isGCPCallback = userAgent.includes('Google-Cloud-Tasks');
    
    this.logger.log(`🔄 Processor callback received for ${processorType}`);
    this.logger.log(`📊 Task data: ${JSON.stringify(taskData)}`);
    this.logger.log(`🤖 User-Agent: ${userAgent}`);
    this.logger.log(`☁️ Is GCP callback: ${isGCPCallback}`);

    try {
      // CloudTaskMQ handles the actual processing through decorators
      // This endpoint is just for GCP Cloud Tasks to call
      // The actual processing happens in the processor classes

      if (isGCPCallback) {
        this.logger.log(`✅ ${processorType} processor callback handled successfully (GCP)`);
      } else {
        this.logger.log(`✅ ${processorType} processor callback handled successfully (Local)`);
      }

      res.status(HttpStatus.OK).json({
        success: true,
        processor: processorType,
        taskId: taskData?.taskId,
        message: `${processorType} processor callback handled successfully`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      this.logger.error(`❌ Failed to handle ${processorType} processor callback: ${error.message}`);
      
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: error.message,
        processor: processorType,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
