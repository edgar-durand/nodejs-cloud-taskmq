import { Controller, Get, Query, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { CloudTaskMQService } from '../cloudtaskmq/cloudtaskmq.service';
import { ConfigService } from '@nestjs/config';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly cloudTaskMQService: CloudTaskMQService,
    private readonly configService: ConfigService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get comprehensive dashboard data' })
  @ApiResponse({ status: 200, description: 'Dashboard data retrieved successfully' })
  async getDashboard(@Query('detailed') detailed?: string) {
    try {
      const isDetailed = detailed === 'true';
      
      // Get configuration
      const config = this.configService.get('cloudtaskmq');
      
      // Get queue statistics
      const queueNames = [
        'email-queue',
        'welcome-email-queue',
        'image-processing-queue',
        'thumbnail-queue',
        'data-export-queue',
        'report-queue',
        'batch-queue',
        'notification-queue',
      ];

      const queueStats = {};
      let totalTasks = 0;
      let totalCompleted = 0;
      let totalFailed = 0;
      let totalActive = 0;

      for (const queueName of queueNames) {
        try {
          const stats = await this.cloudTaskMQService.getQueueStats(queueName);
          queueStats[queueName] = stats;
          
          if (stats) {
            totalTasks += (stats.waiting || 0) + (stats.active || 0) + (stats.completed || 0) + (stats.failed || 0);
            totalCompleted += stats.completed || 0;
            totalFailed += stats.failed || 0;
            totalActive += stats.active || 0;
          }
        } catch (error) {
          this.logger.warn(`Failed to get stats for queue ${queueName}: ${error.message}`);
          queueStats[queueName] = { error: error.message };
        }
      }

      const summary = {
        totalQueues: queueNames.length,
        totalTasks,
        totalCompleted,
        totalFailed,
        totalActive,
        successRate: totalTasks > 0 ? ((totalCompleted / totalTasks) * 100).toFixed(2) + '%' : '0%',
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        nodeVersion: process.version,
        timestamp: new Date().toISOString(),
      };

      const response = {
        success: true,
        summary,
        configuration: {
          projectId: config?.projectId || 'Not configured',
          location: config?.location || 'Not configured',
          storageAdapter: config?.storageAdapter || 'memory',
          autoCreateQueues: config?.autoCreateQueues || false,
          environment: process.env.NODE_ENV || 'development',
          port: process.env.PORT || 3001,
          externalUrl: process.env.EXTERNAL_URL || null,
        },
        queues: queueStats,
      };

      if (isDetailed) {
        response['systemInfo'] = {
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          env: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT,
            STORAGE_ADAPTER: process.env.STORAGE_ADAPTER,
            GOOGLE_CLOUD_PROJECT: process.env.GOOGLE_CLOUD_PROJECT ? '***configured***' : 'Not configured',
            GOOGLE_CLOUD_LOCATION: process.env.GOOGLE_CLOUD_LOCATION || 'Not configured',
            EXTERNAL_URL: process.env.EXTERNAL_URL ? '***configured***' : 'Not configured',
          },
        };

        response['healthChecks'] = await this.performHealthChecks();
      }

      return response;
    } catch (error) {
      this.logger.error(`Failed to get dashboard data: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Health check passed' })
  async getHealth() {
    try {
      const healthChecks = await this.performHealthChecks();
      
      const allHealthy = Object.values(healthChecks).every(check => check.status === 'healthy');
      
      return {
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        checks: healthChecks,
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get system metrics' })
  @ApiResponse({ status: 200, description: 'System metrics retrieved successfully' })
  async getMetrics() {
    try {
      const metrics = {
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage(),
          platform: process.platform,
          arch: process.arch,
          nodeVersion: process.version,
        },
        application: {
          environment: process.env.NODE_ENV || 'development',
          port: process.env.PORT || 3001,
          pid: process.pid,
          startTime: new Date(Date.now() - process.uptime() * 1000).toISOString(),
        },
        cloudtaskmq: {
          version: '1.0.0', // Would come from package.json in real app
          storageAdapter: this.configService.get('cloudtaskmq.storageAdapter') || 'memory',
          projectId: this.configService.get('cloudtaskmq.projectId') || 'Not configured',
          location: this.configService.get('cloudtaskmq.location') || 'Not configured',
        },
        timestamp: new Date().toISOString(),
      };

      return {
        success: true,
        metrics,
      };
    } catch (error) {
      this.logger.error(`Failed to get metrics: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  private async performHealthChecks() {
    const checks = {};

    // Check CloudTaskMQ service
    try {
      const instance = this.cloudTaskMQService.getInstance();
      checks.cloudtaskmq = {
        status: instance ? 'healthy' : 'unhealthy',
        message: instance ? 'CloudTaskMQ service is running' : 'CloudTaskMQ service not initialized',
      };
    } catch (error) {
      checks.cloudtaskmq = {
        status: 'unhealthy',
        message: error.message,
      };
    }

    // Check memory usage
    const memoryUsage = process.memoryUsage();
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    checks.memory = {
      status: memoryUsagePercent < 90 ? 'healthy' : 'warning',
      message: `Memory usage: ${memoryUsagePercent.toFixed(2)}%`,
      details: memoryUsage,
    };

    // Check uptime
    const uptime = process.uptime();
    checks.uptime = {
      status: uptime > 0 ? 'healthy' : 'unhealthy',
      message: `Uptime: ${Math.floor(uptime / 60)} minutes`,
      uptimeSeconds: uptime,
    };

    // Check environment variables
    const requiredEnvVars = ['NODE_ENV'];
    const missingEnvVars = requiredEnvVars.filter(env => !process.env[env]);
    checks.environment = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'warning',
      message: missingEnvVars.length === 0 ? 'All required environment variables are set' : `Missing: ${missingEnvVars.join(', ')}`,
    };

    return checks;
  }
}
