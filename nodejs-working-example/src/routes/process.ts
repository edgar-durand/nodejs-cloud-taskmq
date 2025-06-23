import { Router, Request, Response } from 'express';
import { getCloudTaskMQ } from '../config/cloudtaskmq';

const router = Router();

/**
 * GCP Cloud Tasks processor endpoint for email queue
 * This endpoint will be called by GCP Cloud Tasks when processing email tasks
 */
router.post('/email', async (req: Request, res: Response) => {
  try {
    console.log('📧 Processing email task from GCP Cloud Tasks:', req.body);
    
    // The request body contains the task data sent by GCP Cloud Tasks
    const { taskId, data } = req.body;
    
    if (!taskId || !data) {
      return res.status(400).json({ 
        error: 'Missing taskId or data in request body' 
      });
    }

    // Here you would implement the actual email processing logic
    // For now, we'll just log and acknowledge
    console.log(`Processing email task ${taskId}:`, data);
    
    // Simulate email processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`✅ Email task ${taskId} completed successfully`);
    
    // Return success response to GCP Cloud Tasks
    res.status(200).json({ 
      success: true,
      message: 'Email task processed successfully',
      taskId,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing email task:', error);
    
    // Return error response - GCP will retry based on queue configuration
    res.status(500).json({ 
      error: 'Failed to process email task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GCP Cloud Tasks processor endpoint for welcome email queue
 */
router.post('/welcome-email', async (req: Request, res: Response) => {
  try {
    console.log('👋 Processing welcome email task from GCP Cloud Tasks:', req.body);
    
    const { taskId, data } = req.body;
    
    if (!taskId || !data) {
      return res.status(400).json({ 
        error: 'Missing taskId or data in request body' 
      });
    }

    console.log(`Processing welcome email task ${taskId}:`, data);
    
    // Simulate welcome email processing
    await new Promise(resolve => setTimeout(resolve, 800));
    
    console.log(`✅ Welcome email task ${taskId} completed successfully`);
    
    res.status(200).json({ 
      success: true,
      message: 'Welcome email task processed successfully',
      taskId,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing welcome email task:', error);
    res.status(500).json({ 
      error: 'Failed to process welcome email task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GCP Cloud Tasks processor endpoint for image processing queue
 */
router.post('/image-processing', async (req: Request, res: Response) => {
  try {
    console.log('🖼️ Processing image processing task from GCP Cloud Tasks:', req.body);
    
    const { taskId, data } = req.body;
    
    if (!taskId || !data) {
      return res.status(400).json({ 
        error: 'Missing taskId or data in request body' 
      });
    }

    console.log(`Processing image processing task ${taskId}:`, data);
    
    // Simulate image processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`✅ Image processing task ${taskId} completed successfully`);
    
    res.status(200).json({ 
      success: true,
      message: 'Image processing task processed successfully',
      taskId,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing image processing task:', error);
    res.status(500).json({ 
      error: 'Failed to process image processing task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GCP Cloud Tasks processor endpoint for thumbnail queue
 */
router.post('/thumbnail', async (req: Request, res: Response) => {
  try {
    console.log('🖼️ Processing thumbnail task from GCP Cloud Tasks:', req.body);
    
    const { taskId, data } = req.body;
    
    if (!taskId || !data) {
      return res.status(400).json({ 
        error: 'Missing taskId or data in request body' 
      });
    }

    console.log(`Processing thumbnail task ${taskId}:`, data);
    
    // Simulate thumbnail generation
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(`✅ Thumbnail task ${taskId} completed successfully`);
    
    res.status(200).json({ 
      success: true,
      message: 'Thumbnail task processed successfully',
      taskId,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing thumbnail task:', error);
    res.status(500).json({ 
      error: 'Failed to process thumbnail task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GCP Cloud Tasks processor endpoint for data export queue
 */
router.post('/data-export', async (req: Request, res: Response) => {
  try {
    console.log('📊 Processing data export task from GCP Cloud Tasks:', req.body);
    
    const { taskId, data } = req.body;
    
    if (!taskId || !data) {
      return res.status(400).json({ 
        error: 'Missing taskId or data in request body' 
      });
    }

    console.log(`Processing data export task ${taskId}:`, data);
    
    // Simulate data export processing
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log(`✅ Data export task ${taskId} completed successfully`);
    
    res.status(200).json({ 
      success: true,
      message: 'Data export task processed successfully',
      taskId,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing data export task:', error);
    res.status(500).json({ 
      error: 'Failed to process data export task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GCP Cloud Tasks processor endpoint for report queue
 */
router.post('/report', async (req: Request, res: Response) => {
  try {
    console.log('📈 Processing report task from GCP Cloud Tasks:', req.body);
    
    const { taskId, data } = req.body;
    
    if (!taskId || !data) {
      return res.status(400).json({ 
        error: 'Missing taskId or data in request body' 
      });
    }

    console.log(`Processing report task ${taskId}:`, data);
    
    // Simulate report generation
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    console.log(`✅ Report task ${taskId} completed successfully`);
    
    res.status(200).json({ 
      success: true,
      message: 'Report task processed successfully',
      taskId,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing report task:', error);
    res.status(500).json({ 
      error: 'Failed to process report task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GCP Cloud Tasks processor endpoint for batch queue
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    console.log('⚡ Processing batch task from GCP Cloud Tasks:', req.body);
    
    const { taskId, data } = req.body;
    
    if (!taskId || !data) {
      return res.status(400).json({ 
        error: 'Missing taskId or data in request body' 
      });
    }

    console.log(`Processing batch task ${taskId}:`, data);
    
    // Simulate batch processing
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`✅ Batch task ${taskId} completed successfully`);
    
    res.status(200).json({ 
      success: true,
      message: 'Batch task processed successfully',
      taskId,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing batch task:', error);
    res.status(500).json({ 
      error: 'Failed to process batch task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GCP Cloud Tasks processor endpoint for chain queue
 */
router.post('/chain', async (req: Request, res: Response) => {
  try {
    console.log('🔗 Processing chain task from GCP Cloud Tasks:', req.body);
    
    const { taskId, data } = req.body;
    
    if (!taskId || !data) {
      return res.status(400).json({ 
        error: 'Missing taskId or data in request body' 
      });
    }

    console.log(`Processing chain task ${taskId}:`, data);
    
    // Simulate chain processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`✅ Chain task ${taskId} completed successfully`);
    
    res.status(200).json({ 
      success: true,
      message: 'Chain task processed successfully',
      taskId,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing chain task:', error);
    res.status(500).json({ 
      error: 'Failed to process chain task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Default processor endpoint - fallback for tasks without specific processor URLs
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Processing task from GCP Cloud Tasks (default processor):', req.body);
    
    const { taskId, data, queueName } = req.body;
    
    if (!taskId || !data) {
      return res.status(400).json({ 
        error: 'Missing taskId or data in request body' 
      });
    }

    console.log(`Processing task ${taskId} from queue ${queueName}:`, data);
    
    // Simulate generic task processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log(`✅ Task ${taskId} completed successfully`);
    
    res.status(200).json({ 
      success: true,
      message: 'Task processed successfully',
      taskId,
      queueName,
      processedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Error processing task:', error);
    res.status(500).json({ 
      error: 'Failed to process task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
