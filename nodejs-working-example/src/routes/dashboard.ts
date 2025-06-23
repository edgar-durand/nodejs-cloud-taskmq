import { Router, Request, Response } from 'express';
import { getCloudTaskMQ } from '../config/cloudtaskmq';
import { config } from '../config';
import type { TaskStatus } from 'cloudtaskmq';

const router = Router();

// Dashboard overview
router.get('/', async (req: Request, res: Response) => {
  try {
    const taskMQ = getCloudTaskMQ();
    
    // Define all queue names
    const queueNames = [
      'email-queue',
      'welcome-email-queue', 
      'image-processing-queue',
      'thumbnail-queue',
      'data-export-queue',
      'report-queue',
      'batch-queue',
      'chain-queue',
    ];

    // Get stats for all queues
    const queueStats = await Promise.all(
      queueNames.map(async (queueName) => {
        try {
          const tasks = await taskMQ.getTasks({ queueName });
          return {
            queueName,
            totalTasks: tasks.length,
            idle: tasks.filter(t => t.status === 'idle').length,
            active: tasks.filter(t => t.status === 'active').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            lastUpdated: new Date().toISOString(),
          };
        } catch {
          return {
            queueName,
            totalTasks: 0,
            idle: 0,
            active: 0,
            completed: 0,
            failed: 0,
            lastUpdated: new Date().toISOString(),
            error: 'Failed to fetch queue data',
          };
        }
      })
    );

    // Calculate totals
    const totals = queueStats.reduce((acc, stats) => ({
      totalTasks: acc.totalTasks + stats.totalTasks,
      idle: acc.idle + stats.idle,
      active: acc.active + stats.active,
      completed: acc.completed + stats.completed,
      failed: acc.failed + stats.failed,
    }), { totalTasks: 0, idle: 0, active: 0, completed: 0, failed: 0 });

    res.json({
      success: true,
      dashboard: {
        overview: totals,
        queues: queueStats,
        configuration: {
          storageAdapter: config.storage.adapter,
          rateLimitingEnabled: config.rateLimiting.enabled,
          maxRetries: config.tasks.maxRetries,
          concurrentWorkers: config.tasks.concurrentWorkers,
        },
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get dashboard data:', error);
    res.status(500).json({ 
      error: 'Failed to get dashboard data',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get recent tasks across all queues
router.get('/recent-tasks', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    const taskMQ = getCloudTaskMQ();
    
    const queueNames = [
      'email-queue',
      'welcome-email-queue', 
      'image-processing-queue',
      'thumbnail-queue',
      'data-export-queue',
      'report-queue',
      'batch-queue',
      'chain-queue',
    ];

    // Get recent tasks from all queues
    const allTasks = [];
    for (const queueName of queueNames) {
      try {
        const queueTasks = await taskMQ.getTasks({ queueName });
        allTasks.push(...queueTasks.map(task => ({
          ...task,
          queueName,
        })));
      } catch {
        // Skip queue if error
      }
    }

    // Sort by creation time (newest first) and limit
    const recentTasks = allTasks
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, parseInt(limit as string))
      .map(task => ({
        id: task.id,
        queueName: task.queueName,
        status: task.status,
        attempts: task.attempts,
        maxAttempts: task.maxAttempts,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        error: task.error?.message,
        hasChain: !!task.chain,
      }));

    res.json({
      success: true,
      totalTasks: allTasks.length,
      recentTasks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to get recent tasks:', error);
    res.status(500).json({ 
      error: 'Failed to get recent tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get system health
router.get('/health', async (req: Request, res: Response) => {
  try {
    const taskMQ = getCloudTaskMQ();
    
    // Test storage adapter health
    let storageHealth = 'unknown';
    try {
      // Try to perform a simple operation to test storage
      await taskMQ.getTasks({ queueName: 'health-check-queue' });
      storageHealth = 'healthy';
    } catch (error) {
      storageHealth = 'unhealthy';
      console.error('Storage health check failed:', error);
    }

    // System information
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(),
    };

    // Rate limiting status
    const rateLimitingStatus = config.rateLimiting.enabled ? {
      enabled: true,
      maxRequests: config.rateLimiting.max,
      windowMs: config.rateLimiting.window,
    } : {
      enabled: false,
    };

    res.json({
      success: true,
      health: {
        status: storageHealth === 'healthy' ? 'healthy' : 'degraded',
        storage: {
          adapter: config.storage.adapter,
          status: storageHealth,
        },
        rateLimiting: rateLimitingStatus,
        system: systemInfo,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to get health status:', error);
    res.status(500).json({ 
      error: 'Failed to get health status',
      details: error instanceof Error ? error.message : 'Unknown error',
      health: {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

// Clear completed tasks from a queue
router.delete('/queue/:queueName/completed', async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    const taskMQ = getCloudTaskMQ();
    
    const tasks = await taskMQ.getTasks({ queueName });
    const completedTasks = tasks.filter(t => t.status === 'completed');
    
    // Note: deleteTask method not available in current CloudTaskMQ API
    // This would need to be implemented or use cleanup method instead
    const deletedCount = await taskMQ.cleanup({
      statuses: ['completed' as TaskStatus],
    });

    res.json({
      success: true,
      queueName,
      deletedCount,
      totalCompleted: completedTasks.length,
      message: `Cleared ${deletedCount} completed tasks from ${queueName}`,
    });
  } catch (error) {
    console.error('Failed to clear completed tasks:', error);
    res.status(500).json({ 
      error: 'Failed to clear completed tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Retry failed tasks in a queue
router.post('/queue/:queueName/retry-failed', async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    const taskMQ = getCloudTaskMQ();
    
    const tasks = await taskMQ.getTasks({ queueName });
    const failedTasks = tasks.filter(t => t.status === 'failed');
    
    let retriedCount = 0;
    for (const task of failedTasks) {
      try {
        // Re-add the task with original data
        await taskMQ.addTask(queueName, task.data, {
          maxAttempts: config.tasks.maxRetries,
        });
        retriedCount++;
      } catch (error) {
        console.warn('Failed to retry task:', task.id, error);
      }
    }

    res.json({
      success: true,
      queueName,
      retriedCount,
      totalFailed: failedTasks.length,
      message: `Retried ${retriedCount} failed tasks in ${queueName}`,
    });
  } catch (error) {
    console.error('Failed to retry failed tasks:', error);
    res.status(500).json({ 
      error: 'Failed to retry failed tasks',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
