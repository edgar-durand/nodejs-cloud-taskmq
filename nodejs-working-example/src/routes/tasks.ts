import { Router, Request, Response } from 'express';
import { getCloudTaskMQ } from '../config/cloudtaskmq';
import { config } from '../config';

const router = Router();

// Add email task
router.post('/email', async (req: Request, res: Response) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject) {
      return res.status(400).json({ 
        error: 'Missing required fields: to, subject' 
      });
    }

    const taskMQ = getCloudTaskMQ();
    const taskId = await taskMQ.addTask('email-queue', {
      to,
      subject,
      text,
      html,
    }, {
      maxAttempts: config.tasks.maxRetries,
    });

    res.json({ 
      success: true, 
      taskId,
      message: 'Email task queued successfully' 
    });
  } catch (error) {
    console.error('Failed to queue email task:', error);
    res.status(500).json({ 
      error: 'Failed to queue email task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add welcome email task
router.post('/welcome-email', async (req: Request, res: Response) => {
  try {
    const { email, userName } = req.body;

    if (!email || !userName) {
      return res.status(400).json({ 
        error: 'Missing required fields: email, userName' 
      });
    }

    const taskMQ = getCloudTaskMQ();
    const taskId = await taskMQ.addTask('welcome-email-queue', {
      email,
      userName,
    });

    res.json({ 
      success: true, 
      taskId,
      message: 'Welcome email task queued successfully' 
    });
  } catch (error) {
    console.error('Failed to queue welcome email task:', error);
    res.status(500).json({ 
      error: 'Failed to queue welcome email task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add data export task
router.post('/data-export', async (req: Request, res: Response) => {
  try {
    const { userId, format = 'csv' } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        error: 'Missing required field: userId' 
      });
    }

    if (!['csv', 'json', 'xml'].includes(format)) {
      return res.status(400).json({ 
        error: 'Invalid format. Must be csv, json, or xml' 
      });
    }

    const taskMQ = getCloudTaskMQ();
    const taskId = await taskMQ.addTask('data-export-queue', {
      userId,
      format,
    }, {
      delay: 1000, // Start after 1 second
    });

    res.json({ 
      success: true, 
      taskId,
      message: `Data export task queued successfully (format: ${format})` 
    });
  } catch (error) {
    console.error('Failed to queue data export task:', error);
    res.status(500).json({ 
      error: 'Failed to queue data export task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add report generation task
router.post('/report', async (req: Request, res: Response) => {
  try {
    const { reportType, dateRange } = req.body;

    if (!reportType || !dateRange) {
      return res.status(400).json({ 
        error: 'Missing required fields: reportType, dateRange' 
      });
    }

    const taskMQ = getCloudTaskMQ();
    const taskId = await taskMQ.addTask('report-queue', {
      reportType,
      dateRange,
    }, {
      uniquenessKey: `report_${reportType}_${dateRange.start}_${dateRange.end}`,
    });

    res.json({ 
      success: true, 
      taskId,
      message: 'Report generation task queued successfully' 
    });
  } catch (error) {
    console.error('Failed to queue report task:', error);
    res.status(500).json({ 
      error: 'Failed to queue report task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add batch processing task
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { items, operation = 'process' } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        error: 'Items must be a non-empty array' 
      });
    }

    const taskMQ = getCloudTaskMQ();
    const taskId = await taskMQ.addTask('batch-queue', {
      items,
      operation,
    });

    res.json({ 
      success: true, 
      taskId,
      itemCount: items.length,
      message: 'Batch processing task queued successfully' 
    });
  } catch (error) {
    console.error('Failed to queue batch task:', error);
    res.status(500).json({ 
      error: 'Failed to queue batch task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Add chained tasks
router.post('/chain', async (req: Request, res: Response) => {
  try {
    const { steps = 3, payload = {} } = req.body;

    if (steps < 1 || steps > 10) {
      return res.status(400).json({ 
        error: 'Steps must be between 1 and 10' 
      });
    }

    const taskMQ = getCloudTaskMQ();
    
    // Create chain of tasks - use correct format with data property
    const chainTasks = [];
    for (let i = 1; i <= steps; i++) {
      chainTasks.push({
        data: {
          step: i,
          totalSteps: steps,
          payload: { ...payload, stepData: `Step ${i} data` },
        },
        options: {
          delay: i > 1 ? 1000 : 0, // Delay subsequent steps
        },
      });
    }

    const chainResults = await taskMQ.addChain('chain-queue', chainTasks);

    res.json({ 
      success: true, 
      chainId: chainResults[0]?.taskId || 'unknown',
      totalSteps: steps,
      taskIds: chainResults.map(r => r.taskId),
      message: 'Task chain queued successfully' 
    });
  } catch (error) {
    console.error('Failed to queue task chain:', error);
    res.status(500).json({ 
      error: 'Failed to queue task chain',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get task status
router.get('/:taskId/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const taskMQ = getCloudTaskMQ();
    
    const task = await taskMQ.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({ 
        error: 'Task not found' 
      });
    }

    res.json({
      taskId: task.id,
      queueName: task.queueName,
      status: task.status,
      attempts: task.attempts,
      maxAttempts: task.maxAttempts,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      scheduledFor: task.scheduledFor, // Use correct property name
      error: task.error,
    });
  } catch (error) {
    console.error('Failed to get task status:', error);
    res.status(500).json({ 
      error: 'Failed to get task status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get queue stats
router.get('/queue/:queueName/stats', async (req: Request, res: Response) => {
  try {
    const { queueName } = req.params;
    const taskMQ = getCloudTaskMQ();
    
    const tasks = await taskMQ.getTasks({ queueName }); // Use TaskQueryOptions format
    
    const stats = {
      queueName,
      totalTasks: tasks.length,
      idle: tasks.filter(t => t.status === 'idle').length,
      active: tasks.filter(t => t.status === 'active').length,
      completed: tasks.filter(t => t.status === 'completed').length,
      failed: tasks.filter(t => t.status === 'failed').length,
    };

    res.json(stats);
  } catch (error) {
    console.error('Failed to get queue stats:', error);
    res.status(500).json({ 
      error: 'Failed to get queue stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
