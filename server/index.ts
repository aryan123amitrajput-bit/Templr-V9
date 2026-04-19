import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { uploadToImgBB } from '../api/services/imgbbService';
import { uploadToGifyu } from '../api/services/gifyuService';
import { uploadToImgHippo } from '../api/services/imghippoService';
import { uploadToCatbox } from '../api/services/catboxService';

// Load environment variables
dotenv.config();

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
 * 2. Uploads the image to multi-service chain (Blocking)
 * 3. Enqueues the metadata to Firestore (Non-blocking)
 * 4. Returns success to the user immediately
 */
app.post('/api/templates/upload', upload.single('preview'), async (req, res) => {
  try {
    const { template_name, template_link } = req.body;
    const file = req.file;

    // Validation
    if (!file) {
      return res.status(400).json({ error: 'Preview image is required (field: preview)' });
    }
    if (!template_name) {
      return res.status(400).json({ error: 'Template name is required (field: template_name)' });
    }

    console.log(`[Upload] Processing template: ${template_name}`);

    let publicUrl = '';
    let hostUsed = '';

    // 1. Try ImgBB
    if (!publicUrl) {
        try {
            const result = await uploadToImgBB(file.buffer, file.originalname, file.mimetype);
            publicUrl = result.direct_url;
            hostUsed = 'ImgBB';
        } catch (e: any) {
            console.warn('[Upload] ImgBB failed, trying Gifyu...', e.message);
        }
    }

    // 3. Try Gifyu
    if (!publicUrl) {
        try {
            const result = await uploadToGifyu(file.buffer, file.originalname, file.mimetype);
            publicUrl = result.direct_url;
            hostUsed = 'Gifyu';
        } catch (e: any) {
            console.warn('[Upload] Gifyu failed, trying ImgHippo...', e.message);
        }
    }

    // 4. Try ImgHippo
    if (!publicUrl) {
        try {
            const result = await uploadToImgHippo(file.buffer, file.originalname);
            publicUrl = result.direct_url;
            hostUsed = 'ImgHippo';
        } catch (e: any) {
            console.warn('[Upload] ImgHippo failed, trying Catbox...', e.message);
        }
    }

    // 5. Try Catbox
    if (!publicUrl) {
        try {
            const userhash = process.env.CATBOX_USERHASH || '';
            const result = await uploadToCatbox(file.buffer, file.originalname, file.mimetype, userhash);
            publicUrl = result.direct_url;
            hostUsed = 'Catbox';
        } catch (e: any) {
            console.error('[Upload Error] All external hosts failed:', e.message);
            throw new Error('Upload failed on all available external hosts. Please check your internet connection or API keys.');
        }
    }

    // 2. Queue Firestore metadata sync (Skipped as Firestore is removed)
    
    // 3. Return success immediately
    return res.status(200).json({
      success: true,
      message: 'Template uploaded successfully',
      data: {
        template_name,
        preview_url: publicUrl,
        template_link: template_link || null,
        host: hostUsed
      }
    });

  } catch (error: any) {
    console.error('[Upload Error]', error);
    return res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'Templr Upload Backend' });
});

app.listen(port, () => {
  console.log(`Templr Backend running on port ${port}`);
});
