import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiExcludeEndpoint()
  getRoot() {
    return this.appService.getInfo();
  }

  @Get('health')
  @ApiTags('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Application health status' })
  getHealth() {
    return this.appService.getHealthCheck();
  }

  @Get('info')
  @ApiTags('info')
  @ApiOperation({ summary: 'Application information' })
  @ApiResponse({ status: 200, description: 'Application information and features' })
  getInfo() {
    return this.appService.getInfo();
  }
}
