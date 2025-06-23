import { Request, Response } from 'express';
import { CloudTaskMQ } from '../cloud-taskmq';

/**
 * Task controller for handling HTTP requests from Google Cloud Tasks
 */
export class TaskController {
  constructor(private readonly cloudTaskMQ: CloudTaskMQ) {}

  /**
   * Handle task processing requests from Google Cloud Tasks
   */
  async processTask(req: Request, res: Response): Promise<void> {
    try {
      // Validate request
      if (!req.body) {
        res.status(400).json({ error: 'Request body is required' });
        return;
      }

      const { taskId, queueName, data, attempts, maxAttempts, chain, uniquenessKey } = req.body;

      // Basic validation
      if (!taskId || !queueName) {
        res.status(400).json({ error: 'taskId and queueName are required' });
        return;
      }

      // Optional: Validate Cloud Tasks headers for security
      const cloudTasksTaskName = req.headers['x-cloudtasks-taskname'] as string;
      const cloudTasksQueueName = req.headers['x-cloudtasks-queuename'] as string;
      
      if (process.env.NODE_ENV === 'production') {
        if (!cloudTasksTaskName || !cloudTasksQueueName) {
          res.status(401).json({ error: 'Invalid Cloud Tasks request' });
          return;
        }
      }

      // Process the task
      const result = await this.cloudTaskMQ.processTask({
        taskId,
        queueName,
        data,
        attempts: attempts || 0,
        maxAttempts: maxAttempts || 3,
        chain,
        uniquenessKey,
      });

      res.status(200).json({
        success: true,
        taskId,
        result,
      });
    } catch (error) {
      console.error('Error processing task:', error);
      
      // Return appropriate status code
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle task progress updates
   */
  async updateProgress(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;
      const { percentage, data } = req.body;

      if (!taskId) {
        res.status(400).json({ error: 'taskId is required' });
        return;
      }

      if (percentage === undefined || percentage < 0 || percentage > 100) {
        res.status(400).json({ error: 'Valid percentage (0-100) is required' });
        return;
      }

      await this.cloudTaskMQ.updateTaskProgress(taskId, { percentage, data });

      res.status(200).json({
        success: true,
        taskId,
        progress: { percentage, data },
      });
    } catch (error) {
      console.error('Error updating task progress:', error);
      
      const statusCode = error instanceof Error && error.message.includes('not found') ? 404 : 500;
      
      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get task information
   */
  async getTask(req: Request, res: Response): Promise<void> {
    try {
      const { taskId } = req.params;

      if (!taskId) {
        res.status(400).json({ error: 'taskId is required' });
        return;
      }

      const task = await this.cloudTaskMQ.getTask(taskId);

      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }

      res.status(200).json({
        success: true,
        task,
      });
    } catch (error) {
      console.error('Error getting task:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * List tasks with filtering
   */
  async listTasks(req: Request, res: Response): Promise<void> {
    try {
      const {
        status,
        queueName,
        chainId,
        uniquenessKey,
        limit = 50,
        offset = 0,
        sortField = 'createdAt',
        sortOrder = 'desc',
      } = req.query;

      const options: import('../interfaces/storage-adapter.interface').TaskQueryOptions = {
        limit: Math.min(parseInt(limit as string) || 50, 100), // Max 100
        offset: parseInt(offset as string) || 0,
        sort: {
          field: sortField as string,
          order: sortOrder as 'asc' | 'desc',
        },
      };

      if (status) {
        options.status = Array.isArray(status) 
          ? status as import('../interfaces/storage-adapter.interface').TaskStatus[]
          : [status as import('../interfaces/storage-adapter.interface').TaskStatus];
      }

      if (queueName) {
        options.queueName = queueName as string;
      }

      if (chainId) {
        options.chainId = chainId as string;
      }

      if (uniquenessKey) {
        options.uniquenessKey = uniquenessKey as string;
      }

      const [tasks, total] = await Promise.all([
        this.cloudTaskMQ.getTasks(options),
        this.cloudTaskMQ.getTaskCount(options),
      ]);

      res.status(200).json({
        success: true,
        tasks,
        pagination: {
          total,
          limit: options.limit,
          offset: options.offset,
          hasMore: (options.offset || 0) + (options.limit || 0) < total,
        },
      });
    } catch (error) {
      console.error('Error listing tasks:', error);
      
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const isInitialized = this.cloudTaskMQ.isInitialized();
      
      res.status(isInitialized ? 200 : 503).json({
        status: isInitialized ? 'healthy' : 'unhealthy',
        initialized: isInitialized,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      res.status(503).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
    }
  }
}
