import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { getCloudTaskMQ } from '../config/cloudtaskmq';
import { config } from '../config';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      await fs.access(config.files.uploadDir);
    } catch {
      await fs.mkdir(config.files.uploadDir, { recursive: true });
    }
    cb(null, config.files.uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Accept images only
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'));
  }
};

const upload = multer({ 
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Upload and process single image
router.post('/image', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No image file uploaded' 
      });
    }

    const { 
      resize_width, 
      resize_height, 
      quality = 80, 
      format = 'jpeg',
      watermark_text,
      watermark_position = 'bottom-right'
    } = req.body;

    const taskMQ = getCloudTaskMQ();
    
    // Queue image processing task
    const processingResult = await taskMQ.addTask('image-processing-queue', {
      inputPath: req.file.path,
      filename: req.file.originalname,
      operations: {
        resize: resize_width && resize_height ? {
          width: parseInt(resize_width),
          height: parseInt(resize_height),
        } : undefined,
        quality: parseInt(quality),
        format: format as 'jpeg' | 'png' | 'webp',
        watermark: watermark_text ? {
          text: watermark_text,
          position: watermark_position,
        } : undefined,
      },
    });

    res.json({
      success: true,
      taskId: processingResult.taskId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      message: 'Image uploaded and processing queued',
    });
  } catch (error) {
    console.error('Failed to upload and queue image processing:', error);
    res.status(500).json({ 
      error: 'Failed to process image upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload and generate thumbnails
router.post('/thumbnails', upload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        error: 'No image file uploaded' 
      });
    }

    const taskMQ = getCloudTaskMQ();
    
    // Queue thumbnail generation task
    const thumbnailResult = await taskMQ.addTask('thumbnail-queue', {
      inputPath: req.file.path,
      filename: req.file.originalname,
    });

    res.json({
      success: true,
      taskId: thumbnailResult.taskId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      message: 'Image uploaded and thumbnail generation queued',
    });
  } catch (error) {
    console.error('Failed to upload and queue thumbnail generation:', error);
    res.status(500).json({ 
      error: 'Failed to process thumbnail request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Upload multiple images for batch processing
router.post('/batch', upload.array('images', 10), async (req: Request, res: Response) => {
  try {
    if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
      return res.status(400).json({ 
        error: 'No image files uploaded' 
      });
    }

    const { 
      quality = 80, 
      format = 'jpeg',
      generate_thumbnails = false
    } = req.body;

    const taskMQ = getCloudTaskMQ();
    const queuedTasks: string[] = [];

    // Queue processing task for each image
    for (const file of req.files) {
      const processingResult = await taskMQ.addTask('image-processing-queue', {
        inputPath: file.path,
        filename: file.originalname,
        operations: {
          quality: parseInt(quality),
          format: format as 'jpeg' | 'png' | 'webp',
        },
      });
      queuedTasks.push(processingResult.taskId);

      // Optionally generate thumbnails
      if (generate_thumbnails === 'true') {
        const thumbnailResult = await taskMQ.addTask('thumbnail-queue', {
          inputPath: file.path,
          filename: file.originalname,
        }, {
          delay: 2000, // Process after main image processing
        });
        queuedTasks.push(thumbnailResult.taskId);
      }
    }

    res.json({
      success: true,
      uploadedFiles: req.files.length,
      queuedTasks: queuedTasks.length,
      taskIds: queuedTasks,
      message: 'Images uploaded and batch processing queued',
      files: req.files.map(file => ({
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
      })),
    });
  } catch (error) {
    console.error('Failed to upload and queue batch processing:', error);
    res.status(500).json({ 
      error: 'Failed to process batch upload',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get processed files list
router.get('/processed', async (req: Request, res: Response) => {
  try {
    const files = await fs.readdir(config.files.processedDir);
    const fileDetails = await Promise.all(
      files.map(async (filename) => {
        const filePath = path.join(config.files.processedDir, filename);
        const stats = await fs.stat(filePath);
        return {
          filename,
          size: stats.size,
          createdAt: stats.birthtime,
          modifiedAt: stats.mtime,
        };
      })
    );

    res.json({
      success: true,
      totalFiles: files.length,
      files: fileDetails.sort((a, b) => b.modifiedAt.getTime() - a.modifiedAt.getTime()),
    });
  } catch (error) {
    console.error('Failed to list processed files:', error);
    res.status(500).json({ 
      error: 'Failed to list processed files',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Download processed file
router.get('/processed/:filename', async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(config.files.processedDir, filename);
    
    try {
      await fs.access(filePath);
      res.download(filePath);
    } catch {
      res.status(404).json({ 
        error: 'File not found' 
      });
    }
  } catch (error) {
    console.error('Failed to download file:', error);
    res.status(500).json({ 
      error: 'Failed to download file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
