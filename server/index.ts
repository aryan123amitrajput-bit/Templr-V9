import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import crypto from 'crypto';

// Load environment variables
dotenv.config();

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379');
const uploadQueue = new Queue('upload-queue', { connection });

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Configure Multer for memory storage.
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

/**
 * Main Upload Endpoint for Templr Templates.
 * 
 * 1. Receives 'preview' image file, 'template_name', and 'template_link'
 * 2. Enqueues the upload to Telegram (Non-blocking)
 * 3. Returns success to the user immediately
 */
app.post('/api/templates/upload', upload.single('preview'), async (req, res) => {
  try {
    const { template_name, description } = req.body;
    const file = req.file;

    // Validation
    if (!file) {
      return res.status(400).json({ error: 'Preview image is required (field: preview)' });
    }
    if (!template_name) {
      return res.status(400).json({ error: 'Template name is required (field: template_name)' });
    }

    console.log(`[Upload] Enqueuing template: ${template_name}`);

    // Enqueue
    await uploadQueue.add('process-upload', { 
        templateId: crypto.randomUUID(), 
        fileBuffer: file.buffer, 
        metadata: { template_name, description } 
    });
    
    return res.status(200).json({ success: true, message: 'Upload queued' });
  } catch (error: any) {
    console.error('[Upload] Error enqueuing template:', error);
    return res.status(500).json({ error: 'Failed to enqueue upload' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Templr Upload Backend' });
});

app.listen(port, () => {
  console.log(`Templr Backend running on port ${port}`);
});
