import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import { uploadQueue } from './services/queueService';
import multer from 'multer';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { getSupabase, addTemplate as addSupabaseTemplate, getTemplates as getSupabaseTemplates } from './services/supabaseService';
import { uploadToCatbox } from './services/catboxService';
import { uploadToSupabase } from './services/supabaseService';
import { uploadToI111666 } from './services/i111666Service';
import { uploadToImgBB } from './services/imgbbService';
import { uploadToGifyu } from './services/gifyuService';
import { uploadToImgHippo } from './services/imghippoService';
import { repoManager } from './services/repoService';
import { freeHostService } from './services/freeHostService';
import { threadsService } from './services/threadsService';
import { traffService } from './services/traffService';
import { templrAuditor } from './services/templrAuditor';
import { uploadToPasteRs } from './services/pasteService';
import { telegramService } from './services/telegramService';

const upload = multer({ storage: multer.memoryStorage() });

async function enqueueUpload(req: any, res: any, description: string) {
    try {
        const file = req.file;
        if (!file) return res.status(400).json({ error: 'No file provided' });

        const templateId = crypto.randomUUID();
        console.log(`[Upload] Creating template record: ${templateId}`);
        
        // Create initial record in Supabase
        await addSupabaseTemplate({
            id: templateId,
            title: file.originalname,
            description: description || 'New upload',
            status: 'pending',
            created_at: new Date().toISOString()
        });

        console.log(`[Upload] Enqueuing ${description} upload`);
        await uploadQueue.add('process-upload', { 
            templateId, 
            fileBuffer: file.buffer, 
            metadata: { template_name: file.originalname, description } 
        });
        
        return res.status(200).json({ success: true, message: 'Upload queued' });
    } catch (error: any) {
        console.error(`[Upload] Error enqueuing ${description} upload:`, error);
        return res.status(500).json({ error: 'Failed to enqueue upload' });
    }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Firebase Admin is still initialized for Auth if needed, but Firestore is removed.
// In Vercel, the root is one level up from /api
const firebaseConfigPath = path.join(__dirname, '..', 'firebase-applet-config.json');
if (fs.existsSync(firebaseConfigPath)) {
  const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  try {
    let credential;
    console.log("Checking FIREBASE_SERVICE_ACCOUNT...");
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      console.log("FIREBASE_SERVICE_ACCOUNT is set.");
      credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
    } else {
      console.log("FIREBASE_SERVICE_ACCOUNT is NOT set, using applicationDefault().");
      credential = admin.credential.applicationDefault();
    }
    if (admin.apps.length === 0) {
      admin.initializeApp({
        credential: credential,
        projectId: firebaseConfig.projectId,
      });
      console.log("Firebase Admin initialized:", admin.app().name);
    }
  } catch (e) {
    console.error("Firebase Admin initialization failed:", e);
  }
}

// Environment Variables
let supabase: any = null;
try {
  supabase = getSupabase();
} catch (e) {
  console.error("Supabase initialization failed, using mock client:", e);
  supabase = {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => ({ data: null, error: 'Supabase not configured' }) }), data: [], error: 'Supabase not configured' }),
      update: () => ({ eq: () => ({ error: 'Supabase not configured' }) }),
      delete: () => ({ eq: () => ({ error: 'Supabase not configured' }) }),
      insert: () => ({ error: 'Supabase not configured' }),
    }),
    auth: {
      signInWithPassword: () => ({ data: null, error: 'Supabase not configured' }),
      signUp: () => ({ data: null, error: 'Supabase not configured' }),
      updateUser: () => ({ data: null, error: 'Supabase not configured' }),
      getSession: () => ({ data: null, error: 'Supabase not configured' }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: () => Promise.resolve(),
    },
    storage: {
      from: () => ({
        upload: () => ({ error: 'Supabase not configured' }),
        getPublicUrl: () => ({ data: { publicUrl: '' } }),
        remove: () => ({ error: 'Supabase not configured' }),
      }),
    },
  };
}

// GitHub Configuration
const GITHUB_REPO_DEFAULT = 'Templr-V9';

function getGitHubConfig() {
  let owner = process.env.GITHUB_OWNER || 'aryan123amitrajput-bit';
  let repo = process.env.GITHUB_REPO || GITHUB_REPO_DEFAULT;
  const token = process.env.GITHUB_TOKEN;

  if (repo && repo.includes('github.com')) {
    try {
      const urlParts = repo.replace('.git', '').split('github.com/')[1].split('/');
      if (urlParts.length >= 2) {
        owner = urlParts[0];
        repo = urlParts[1];
      }
    } catch (e) {
      console.error("Failed to parse GitHub URL from GITHUB_REPO variable");
    }
  }

  return { owner, repo, token };
}

/**
 * Generates a clean preview URL for a template.
 */
function generatePreviewUrl(originalUrl: string): string {
  if (!originalUrl) return '';
  const hash = Math.random().toString(36).substring(2, 10);
  return `https://preview.templr.io/v/${hash}`;
}

/**
 * Saves template metadata to GitHub as a JSON file.
 */
async function deleteTemplateFromGitHub(templateId: string) {
  await repoManager.deleteTemplate(templateId);
}

async function updateTemplateOnGitHub(templateId: string, updates: any) {
  const metadataUpdates: any = {};
  if (updates.title || updates.name) metadataUpdates.title = updates.title || updates.name;
  if (updates.image_url || updates.image_preview || updates.preview_image) metadataUpdates.thumbnail = updates.preview_image || updates.image_preview || updates.image_url;
  if (updates.category) metadataUpdates.category = updates.category;
  if (updates.tags) metadataUpdates.tags = updates.tags;
  
  await repoManager.updateTemplate(templateId, metadataUpdates);
}

async function saveTemplateToGitHub(template: any) {
  const metadata = {
    id: template.id,
    title: template.name || template.title,
    author: template.creator || template.author_name,
    thumbnail: template.preview_image || template.image_preview || template.image_url,
    category: template.category,
    created_at: template.created_at,
    tags: template.tags || [],
    ...template
  };
  try {
    await repoManager.uploadTemplate(metadata);
    return true;
  } catch (e) {
    console.error('Failed to save to GitHub:', e);
    return false;
  }
}

/**
 * Maps Supabase template data to the frontend Template interface.
 */
function mapSupabaseToTemplate(t: any) {
  return {
    id: t.id,
    title: t.title,
    description: t.description || '',
    author: t.author_name || t.author || 'Anonymous',
    author_id: t.author_id,
    author_uid: t.author_id, // For compatibility
    authorAvatar: t.author_avatar || '',
    imageUrl: t.image_url || t.thumbnail || t.thumbnail_url || '',
    bannerUrl: t.banner_url || t.image_url || t.thumbnail || '',
    thumbnail: t.thumbnail_url || t.thumbnail || t.image_url || '',
    likes: t.likes || 0,
    views: t.views || 0,
    category: t.category || 'Uncategorized',
    tags: t.tags || [],
    price: t.price || 'Free',
    fileUrl: t.file_url || '',
    fileType: t.file_type || (t.file_url?.endsWith('.zip') ? 'zip' : 'html'),
    status: t.status || 'approved',
    sales: t.sales || 0,
    earnings: t.earnings || 0,
    created_at: t.created_at,
    galleryImages: t.gallery_images || [],
    videoUrl: t.video_url || ''
  };
}

function mapThreadsToTemplate(t: any) {
  return {
    id: t.id,
    title: t.title,
    description: t.description || '',
    author: t.author || 'Anonymous',
    author_id: '',
    author_uid: '',
    authorAvatar: '',
    imageUrl: t.demoLink || '', // Threads CDN URL
    bannerUrl: t.demoLink || '',
    thumbnail: t.demoLink || '',
    likes: 0,
    views: 0,
    category: t.category || 'Uncategorized',
    tags: t.tags || [],
    price: t.price || 'Free',
    fileUrl: '',
    fileType: 'html',
    status: 'approved',
    sales: 0,
    earnings: 0,
    created_at: t.timestamp,
    galleryImages: [],
    videoUrl: ''
  };
}

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Middleware to strip trailing slashes from /api/ routes
app.use((req, res, next) => {
  if (req.path.startsWith('/api/') && req.path.endsWith('/') && req.path.length > 5) {
    const query = req.url.slice(req.path.length);
    const safepath = req.path.slice(0, -1);
    res.redirect(301, safepath + query);
  } else {
    next();
  }
});

// Request Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Global Error Handler for JSON responses
const errorHandler: express.ErrorRequestHandler = (err, req, res, next) => {
  console.error('Global Error Handler:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

// Registry Endpoint for dynamic template loading
app.get('/api/registry', (req, res) => {
  res.json(freeHostService.getRegistry());
});

// Asset Proxy for CORS bypass
app.get('/api/proxy', async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    
    const fetchWithFallback = async (targetUrl: string): Promise<{ buffer: ArrayBuffer, contentType: string | null }> => {
        const urlObj = new URL(targetUrl);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        
        try {
            const response = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': `${urlObj.protocol}//${urlObj.hostname}/`
                },
                signal: controller.signal,
                redirect: 'follow'
            });
            clearTimeout(timeoutId);
            
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            return {
                buffer: await response.arrayBuffer(),
                contentType: response.headers.get('content-type')
            };
        } catch (e) {
            clearTimeout(timeoutId);
            throw e;
        }
    };

    try {
        let result;
        try {
            result = await fetchWithFallback(url);
        } catch (e: any) {
            if (e.message.includes('404')) {
                console.warn(`[Proxy] Direct fetch failed for ${url} (404 Not Found)`);
                throw e; // Don't fallback on 404
            }
            console.warn(`[Proxy] Direct fetch failed for ${url}, trying weserv.nl fallback...`);
            const fallbackUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
            result = await fetchWithFallback(fallbackUrl);
        }
        
        const { buffer, contentType } = result;
        console.log(`[Proxy] Successfully fetched ${url}, size: ${buffer.byteLength} bytes`);
        
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        
        if (contentType) res.setHeader('Content-Type', contentType);
        res.send(Buffer.from(buffer));
    } catch (error: any) {
        console.error(`[Proxy] Error fetching ${url}:`, error.message);
        res.status(500).json({ error: `Proxy failed: ${error.message}` });
    }
});

// --- Admin Engine Routes ---
app.get('/api/admin/hosts', (req, res) => {
  res.json(traffService.getHosts());
});

app.get('/api/admin/audit-reports', (req, res) => {
  res.json(templrAuditor.getReports());
});

app.post('/api/admin/run-audit', async (req, res) => {
  try {
    const [hosts, reports] = await Promise.all([
      traffService.auditHosts(),
      templrAuditor.runFullAudit()
    ]);
    res.json({ hosts, reports });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// --- SEO Routes ---
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Sitemap: https://templr-v9.vercel.app/sitemap.xml`);
});

app.get('/sitemap.xml', async (req, res) => {
  try {
    const { data: templates, error } = await supabase.from('templates').select('id, title, updated_at');
    if (error) throw error;

    const baseUrl = 'https://templr-v9.vercel.app';
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    const categories = ['saas', 'startup', 'portfolio', 'ai-landing-page', 'dark-ui'];
    categories.forEach(cat => {
      xml += `  <url>\n    <loc>${baseUrl}/${cat}-templates</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    if (templates) {
      templates.forEach((t: any) => {
        const slug = t.title ? t.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') : t.id;
        xml += `  <url>\n    <loc>${baseUrl}/templates/${slug}-${t.id}</loc>\n    <lastmod>${new Date(t.updated_at || Date.now()).toISOString()}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>\n`;
      });
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    console.error('Sitemap generation error:', error);
    res.status(500).end();
  }
});

// --- API Routes ---

// Unified Text Upload Proxy
app.post('/api/upload/text', async (req, res) => {
  try {
    const { content, filename = 'template.json' } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });
    
    console.log('[Text Upload] Received request');
    
    // 1. Try Telegram (User Preferred)
    if (telegramService.isConfigured()) {
      try {
        const buffer = Buffer.from(content, 'utf-8');
        const tgUri = await telegramService.uploadDocument(buffer, filename, 'application/json');
        const match = tgUri.match(/^tg:\/\/(\d+)\/(.+)$/);
        if (match) {
          const botIndex = match[1];
          const fileId = match[2];
          const url = `/api/tg-file/${botIndex}/${fileId}`;
          return res.json({ success: true, url, host: 'Telegram' });
        }
      } catch (e: any) {
        console.warn('[Text Upload] Telegram failed, trying Paste.rs...', e.message);
      }
    }

    // 2. Fallback to Paste.rs
    const url = await uploadToPasteRs(content);
    res.json({ success: true, url, host: 'Paste.rs' });
  } catch (error: any) {
    console.error('Text Upload Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Paste.rs Upload Proxy (Backup Text Hosting)
app.post('/api/upload/pastesrs', async (req, res) => {
  try {
    const { content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });
    const url = await uploadToPasteRs(content);
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload File Proxy (New Workflow: External only)
async function processFileUpload(buffer: Buffer, originalname: string, mimetype: string) {
    const isVideo = mimetype.startsWith('video/');
    
    console.log(`[Upload] Processing ${isVideo ? 'video' : 'image'} upload: ${originalname}`);

    // 1. Try Telegram (User Preferred)
    if (telegramService.isConfigured()) {
        try {
            const tgUri = await telegramService.uploadImage(buffer, originalname, mimetype);
            const match = tgUri.match(/^tg:\/\/(\d+)\/(.+)$/);
            if (match) {
                const botIndex = match[1];
                const fileId = match[2];
                const imageUrl = `/api/tg-file/${botIndex}/${fileId}`;
                return { imageUrl, hostUsed: 'Telegram' };
            }
        } catch (e: any) {
            console.warn('[Upload] Telegram failed, trying Catbox...', e.message);
        }
    }

    // 2. Try Catbox
    try {
        const result = await uploadToCatbox(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, catboxUrl: result.direct_url, hostUsed: 'Catbox' };
    } catch (e: any) {
        console.warn('[Upload] Catbox failed, trying Supabase...', e.message);
    }

    // 2. Try Supabase
    try {
        const url = await uploadToSupabase(buffer, originalname, mimetype);
        return { imageUrl: url, hostUsed: 'Supabase' };
    } catch (e: any) {
        console.warn('[Upload] Supabase failed, trying i111666...', e.message);
    }

    // 3. Try i111666
    try {
        const result = await uploadToI111666(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'i111666' };
    } catch (e: any) {
        console.warn('[Upload] i111666 failed, trying ImgBB...', e.message);
    }

    // 3. Try ImgBB
    try {
        const result = await uploadToImgBB(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'ImgBB' };
    } catch (e: any) {
        console.warn('[Upload] ImgBB failed, trying Gifyu...', e.message);
    }

    // 4. Try Gifyu
    try {
        const result = await uploadToGifyu(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'Gifyu' };
    } catch (e: any) {
        console.warn('[Upload] Gifyu failed, trying ImgHippo...', e.message);
    }

    // 5. Try ImgHippo
    try {
        const result = await uploadToImgHippo(buffer, originalname);
        return { imageUrl: result.direct_url, hostUsed: 'ImgHippo' };
    } catch (e: any) {
        console.error('[Upload] All external hosts failed:', e.message);
        throw new Error('Upload failed on all available external hosts. Please check your internet connection or API keys.');
    }
}

// Upload File Proxy (New Workflow: ImgLink API for images, Supabase for videos)
app.post('/api/upload', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[Upload] Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  console.log(`[General Upload Request] Received POST /api/upload`);
  try {
    const file = req.file;
    const { title, description } = req.body;
    if (!file) {
      console.warn(`[General Upload Request] No file provided`);
      return res.status(400).json({ error: "file is required" });
    }
    console.log(`[General Upload Request] File: ${file.originalname}, Size: ${file.size}, Mime: ${file.mimetype}`);

    const { imageUrl, catboxUrl, hostUsed } = await processFileUpload(file.buffer, file.originalname, file.mimetype);

    console.log('[Upload] Final URL extracted:', imageUrl);
    console.log('[Upload] Host used:', hostUsed);

    if (title) {
        console.log('[Upload] Saving to database...');
        const { data: dbData, error: dbError } = await supabase.from('templates').insert({
            title,
            description,
            image_url: imageUrl,
            catbox_url: catboxUrl,
            created_at: new Date().toISOString()
        });

        if (dbError) {
            console.error('[Upload] Database save failed:', dbError);
            throw new Error(`Database save failed: ${dbError.message}`);
        }
        console.log('[Upload] Saved to database successfully');
    }

    console.log('[Upload] Sending JSON response...');
    res.json({ success: true, url: imageUrl, host: hostUsed });
  } catch (error: any) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during upload' });
  }
});

// Upload from URL Proxy
app.post('/api/upload/url', async (req, res) => {
    try {
        const { url, description } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        console.log(`[Upload] Enqueuing URL upload: ${url}`);
        
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');

        await uploadQueue.add('process-upload', { 
            templateId: crypto.randomUUID(), 
            fileBuffer: buffer, 
            metadata: { template_name: url.split('/').pop() || 'url-upload', description: description || 'URL upload' } 
        });
        
        return res.status(200).json({ success: true, message: 'Upload queued' });
    } catch (error: any) {
        console.error('URL Upload Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error during URL upload' });
    }
});

// Catbox Upload Proxy
app.post('/api/upload/catbox', upload.single('file'), async (req, res) => {
    await enqueueUpload(req, res, 'catbox');
});

// Upload File Proxy (GitHub Fallback)
app.post('/api/upload/gifyu', upload.single('file'), async (req, res) => {
    await enqueueUpload(req, res, 'gifyu');
});

app.post('/api/upload/imgbb', upload.single('file'), async (req, res) => {
    await enqueueUpload(req, res, 'imgbb');
});

app.post('/api/upload/github', upload.single('file'), async (req, res) => {
    await enqueueUpload(req, res, 'github');
});

// i.111666.best Upload Proxy
app.post('/api/upload/i111666', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[i111666 Upload] Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  console.log(`[i111666 Upload] Received POST /api/upload/i111666`);
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "file is required" });
    }

    // Generate a random token for deletion as requested
    const authToken = crypto.randomBytes(16).toString('hex');

    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('image', blob, file.originalname);

    const response = await fetch('https://i.111666.best/image', {
      method: 'POST',
      body: formData,
      headers: {
        'Auth-Token': authToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`i111666 API failed: ${response.status} ${errorText}`);
    }

    const responseText = (await response.text()).trim();
    let directUrl = responseText;
    
    try {
        const parsed = JSON.parse(responseText);
        if (parsed.src) {
            directUrl = parsed.src;
        } else if (parsed.direct_url) {
            directUrl = parsed.direct_url;
        }
    } catch (e) {
        // Not JSON, treat as plain text
    }
    
    // Ensure absolute URL
    if (directUrl.startsWith('/')) {
        directUrl = `https://i.111666.best${directUrl}`;
    }
    
    res.json({
      success: true,
      provider: 'i111666',
      direct_url: directUrl,
      auth_token: authToken // Return token so it can be used for deletion if needed
    });
  } catch (error: any) {
    console.error('i111666 Upload Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during i111666 upload' });
  }
});

// i.111666.best Delete Proxy
app.delete('/api/upload/i111666/:imagePath', async (req, res) => {
  const { imagePath } = req.params;
  const authToken = req.headers['auth-token'] as string;

  if (!authToken) {
    return res.status(400).json({ error: 'Auth-Token header is required' });
  }

  try {
    const response = await fetch(`https://i.111666.best/image/${imagePath}`, {
      method: 'DELETE',
      headers: {
        'Auth-Token': authToken,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`i111666 Delete failed: ${response.status} ${errorText}`);
    }

    res.json({ success: true, message: 'Image deleted successfully' });
  } catch (error: any) {
    console.error('i111666 Delete Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during i111666 delete' });
  }
});

// BeeIMG Upload Proxy
app.post('/api/upload/beeimg', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[BeeIMG Upload] Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  console.log(`[BeeIMG Upload] Received POST /api/upload/beeimg`);
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "file is required" });
    }

    const { uploadToBeeIMG } = await import('./services/beeimgService');
    const apiKey = process.env.BEEIMG_API_KEY || '098dccd10fb840e72711cdf846b50222';
    const directUrl = await uploadToBeeIMG(file.buffer, file.originalname, file.mimetype, apiKey);
    
    res.json({
      success: true,
      provider: 'beeimg',
      direct_url: directUrl
    });
  } catch (error: any) {
    console.error('BeeIMG Upload Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during BeeIMG upload' });
  }
});

// ImgHippo Upload Proxy (Reliable Fallback)
app.post('/api/upload/imghippo', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[ImgHippo Upload] Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  console.log(`[ImgHippo Upload] Received POST /api/upload/imghippo`);
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "file is required" });
    }

    const result = await uploadToImgHippo(file.buffer, file.originalname);
    
    res.json({
      success: true,
      provider: 'imghippo',
      ...result
    });
  } catch (error: any) {
    console.error('ImgHippo Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during ImgHippo upload' });
  }
});

// Pixhost Upload Proxy (Primary)
app.post('/api/upload/pixhost', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[Pixhost Upload] Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  console.log(`[Pixhost Upload] Received POST /api/upload/pixhost`);
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "file is required" });
    }

    const formData = new FormData();
    const blob = new Blob([file.buffer], { type: file.mimetype });
    formData.append('img', blob, file.originalname);
    formData.append('content_type', '0'); // 0 for family safe
    formData.append('max_file_size', '10485760'); // 10MB

    const response = await fetch('https://pixhost.to/api/v1/upload', {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Pixhost API failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // Pixhost returns image_url, th_url, etc. in their JSON response
    res.json({
      success: true,
      provider: 'pixhost',
      direct_url: data.image_url,
      thumbnail_url: data.th_url,
      viewer_url: data.show_url
    });
  } catch (error: any) {
    console.error('Pixhost Upload Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during Pixhost upload' });
  }
});

// Get Public Templates
app.get('/api/templates', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limitNum = parseInt(req.query.limit as string) || 6;
    const category = req.query.category as string;
    const searchQuery = req.query.searchQuery as string;
    const sortBy = req.query.sortBy as string || 'newest';
    const userId = req.query.userId as string;
    const email = req.query.email as string;

    // 1. Get templates from Threads (Primary Database)
    let data: any[] = [];
    const errors: string[] = [];
    console.log('[API] Starting template fetch...');
    if (threadsService.isConfigured()) {
        try {
            const threadsTemplates = await threadsService.fetchTemplates();
            console.log(`[API] Threads returned ${threadsTemplates.length} templates.`);
            data = threadsTemplates.map(mapThreadsToTemplate);
        } catch (e: any) {
            const msg = `Threads fetch error: ${e.message}`;
            console.error(`[API] ${msg}`, e);
            errors.push(msg);
        }
    } else {
        console.log('[API] Threads service not configured.');
    }

    // 2. Get templates from Supabase (Secondary/Backup source)
    try {
      const supabaseTemplates = await getSupabaseTemplates();
      console.log(`[API] Supabase returned ${supabaseTemplates.length} templates.`);
      data.push(...supabaseTemplates.map(mapSupabaseToTemplate));
    } catch (e: any) {
      const msg = `Supabase fetch error: ${e.message}`;
      console.error(`[API] ${msg}`, e);
      errors.push(msg);
    }

    // 3. Get templates from repositories (GitHub/GitLab)
    try {
      const repoTemplates = await repoManager.getMergedRegistry();
      console.log(`[API] RepoManager returned ${repoTemplates.length} templates.`);
      data.push(...repoTemplates);
    } catch (e: any) {
      const msg = `Repo fetch error: ${e.message}`;
      console.error(`[API] ${msg}`, e);
      errors.push(msg);
    }

    // 4. Get templates from freeHostService
    try {
      // Fetch a large number to get all for merging and filtering
      console.log('[API] Fetching from FreeHostService...');
      const freeTemplates = await freeHostService.getTemplates(0, 1000, category, searchQuery);
      console.log(`[API] FreeHostService returned ${freeTemplates.length} templates.`);
      const mappedFreeTemplates = freeTemplates.map((t: any) => ({
        id: t.id,
        title: t.name,
        thumbnail: t.image_preview,
        author: t.creator,
        author_id: t.creator_id || t.author_id,
        tags: t.tags || [],
        category: t.category,
        created_at: t.created_at,
        likes: t.stats?.likes || 0,
        views: t.stats?.views || 0,
        status: 'approved'
      }));
      data.push(...mappedFreeTemplates);
    } catch (e: any) {
      const msg = `FreeHost fetch error: ${e.message}`;
      console.error(`[API] ${msg}`, e);
      errors.push(msg);
    }

    console.log(`[API] Total templates after merging: ${data.length}`);
    
    if (data.length === 0 && errors.length > 0) {
        const combinedError = `No templates found. Errors encountered: ${errors.join('; ')}`;
        console.error(`[API] ${combinedError}`);
        throw new Error(combinedError);
    }
    
    // Remove duplicates by ID
    const uniqueTemplates: any[] = [];
    const seenIds = new Set();
    for (const t of data) {
      if (t && t.id && !seenIds.has(t.id)) {
        uniqueTemplates.push(t);
        seenIds.add(t.id);
      }
    }
    data = uniqueTemplates;
    console.log(`[API] Unique templates: ${data.length}`);

    // Filter by status 'approved' (or allow if status is missing)
    const beforeFilter = data.length;
    data = data.filter((t: any) => !t.status || t.status === 'approved');
    console.log(`[API] Templates after 'approved' filter: ${data.length} (Filtered out ${beforeFilter - data.length})`);

    // Filter by userId or email if provided
    if (userId || email) {
      data = data.filter((t: any) => {
        const matchId = userId && (t.author_id === userId || (t.author && t.author.id === userId));
        const matchEmail = email && (t.author_email === email || (t.author && t.author.email === email));
        return matchId || matchEmail;
      });
      console.log(`[API] Templates after user/email filter: ${data.length}`);
    }

    if (category && category !== 'All') {
      data = data.filter((t: any) => t.category === category);
      console.log(`[API] Templates after category filter (${category}): ${data.length}`);
    }

    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      data = data.filter((t: any) => 
        t.title?.toLowerCase().includes(lowerQuery) || 
        t.description?.toLowerCase().includes(lowerQuery)
      );
      console.log(`[API] Templates after search filter (${searchQuery}): ${data.length}`);
    }

    if (sortBy === 'popular' || sortBy === 'likes') {
      data = data.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
    } else {
      data = data.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    const hasMore = data.length > (page + 1) * limitNum;
    const paginatedData = data.slice(page * limitNum, (page + 1) * limitNum);

    res.json({ 
      data: paginatedData, 
      hasMore 
    });
  } catch (error: any) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Featured Creators
app.get('/api/creators', async (req, res) => {
  try {
    const [gitRegistry, supabaseTemplates] = await Promise.all([
      repoManager.getMergedRegistry(),
      getSupabaseTemplates()
    ]);

    const allTemplates = [...gitRegistry, ...supabaseTemplates.map(mapSupabaseToTemplate)];
    const approvedTemplates = allTemplates.filter((t: any) => !t.status || t.status === 'approved');

    const creatorsMap = new Map();
    approvedTemplates.forEach((t: any) => {
      const email = t.author_email || t.creator_email || t.email;
      if (!email) return;
      if (!creatorsMap.has(email)) {
        creatorsMap.set(email, {
          author_name: t.author || t.author_name || 'Anonymous',
          author_email: email,
          author_avatar: t.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author || 'Anonymous')}&background=random`,
          views: 0,
          likes: 0,
          templates: 0
        });
      }
      const creator = creatorsMap.get(email);
      creator.views += (t.views || 0);
      creator.likes += (t.likes || 0);
      creator.templates += 1;
    });

    const creators = Array.from(creatorsMap.values())
      .sort((a: any, b: any) => (b.likes + b.views) - (a.likes + a.views))
      .slice(0, 10);

    res.json({ data: creators });
  } catch (error: any) {
    console.error('API Error (Creators):', error);
    res.status(500).json({ error: error.message });
  }
});

// Auth Proxy
app.post('/api/auth/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name, usage_count: 0, is_pro: false } }
    });
    if (error) throw error;
    res.json(data);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Get User Templates
app.get('/api/user/templates', async (req, res) => {
  try {
    const email = req.query.email as string;
    if (!email) throw new Error("Email required");

    let allData: any[] = [];

    // 1. Threads
    if (threadsService.isConfigured()) {
      try {
        const threadsTemplates = await threadsService.fetchTemplates();
        const userThreads = threadsTemplates.filter((t: any) => t.author_email === email || t.author === email);
        allData.push(...userThreads.map(mapThreadsToTemplate));
      } catch (e) {
        console.error('[API] Threads fetch error:', e);
      }
    }

    // 2. Supabase
    try {
      const supabaseTemplates = await getSupabaseTemplates();
      const userSupabase = supabaseTemplates.filter((t: any) => t.author_email === email || t.author_id === email);
      allData.push(...userSupabase.map(mapSupabaseToTemplate));
    } catch (e) {
      console.error('[API] Supabase fetch error:', e);
    }

    // 3. Repositories
    try {
      const repoTemplates = await repoManager.getMergedRegistry();
      const userRepos = repoTemplates.filter((t: any) => t.author_email === email || t.authorEmail === email);
      allData.push(...userRepos);
    } catch (e) {
      console.error('[API] Repo fetch error:', e);
    }

    // 4. FreeHostService
    try {
      const freeTemplates = await freeHostService.getTemplates(0, 1000);
      const userFree = freeTemplates.filter((t: any) => t.creator_email === email || t.author_email === email);
      const mappedFree = userFree.map((t: any) => ({
        id: t.id,
        title: t.name,
        thumbnail: t.image_preview,
        author: t.creator,
        author_id: t.creator_id || t.author_id,
        tags: t.tags || [],
        category: t.category,
        created_at: t.created_at,
        likes: t.stats?.likes || 0,
        views: t.stats?.views || 0,
        status: 'approved'
      }));
      allData.push(...mappedFree);
    } catch (e) {
      console.error('[API] FreeHost fetch error:', e);
    }

    // Remove duplicates by ID
    const uniqueTemplates: any[] = [];
    const seenIds = new Set();
    for (const t of allData) {
      if (t && t.id && !seenIds.has(t.id)) {
        uniqueTemplates.push(t);
        seenIds.add(t.id);
      }
    }
    allData = uniqueTemplates;
      
    // Sort manually
    allData.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    res.json({ data: allData });
  } catch (error: any) {
    console.error('API Error (User Templates):', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Template By ID
app.get('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let template: any = null;

    // 1. Try Repository Manager
    template = await repoManager.getTemplateById(id);

    // 2. Try FreeHostService
    if (!template) {
      template = await freeHostService.getTemplateById(id);
    }

    // 3. Try Supabase
    if (!template) {
      const supabaseTemplates = await getSupabaseTemplates();
      const found = supabaseTemplates.find((t: any) => t.id === id);
      if (found) {
        template = mapSupabaseToTemplate(found);
      }
    }

    // 4. Try Threads
    if (!template && threadsService.isConfigured()) {
      try {
        const threadsTemplate = await threadsService.getTemplateById(id);
        if (threadsTemplate) {
          template = mapThreadsToTemplate(threadsTemplate);
        }
      } catch (e) {
        console.warn(`[API] Threads lookup failed for ${id}:`, e);
      }
    }

    if (template) {
      res.json({ data: template });
    } else {
      res.status(404).json({ error: 'Template not found' });
    }
  } catch (error: any) {
    console.error('API Error (Get Template):', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/templates', async (req, res) => {
  try {
    const { template } = req.body;
    if (!template) return res.status(400).json({ error: 'Template is required' });
    const templateId = crypto.randomUUID();
    let finalImageUrl = template.preview_image || template.image_url || template.imageUrl || '';
    let finalBannerUrl = template.banner_url || template.bannerUrl || finalImageUrl;
    let finalGalleryImages = template.gallery_images || [];

    const cleanPreviewUrl = generatePreviewUrl(template.file_url || finalImageUrl);
    const metadata = {
      id: templateId,
      name: template.title || template.name,
      description: template.description,
      preview_url: cleanPreviewUrl,
      thumbnail: finalImageUrl,
      image_preview: finalImageUrl,
      banner_url: finalBannerUrl,
      gallery_images: finalGalleryImages,
      file_url: template.file_url,
      tags: template.tags || [],
      creator: template.author_name || 'Anonymous',
      creator_email: template.author_email,
      creator_avatar: template.author_avatar || '',
      created_at: new Date().toISOString(),
      category: template.category,
      price: template.price,
      stats: { likes: 0, views: 0 }
    };

    try {
      const savedToRepo = await saveTemplateToGitHub(metadata);
      if (!savedToRepo) await freeHostService.addTemplate(metadata);
      try {
        const supabasePayload = {
          ...template,
          id: templateId,
          preview_image: finalImageUrl,
          banner_url: finalBannerUrl,
          gallery_images: finalGalleryImages,
          created_at: metadata.created_at
        };
        // Remove old fields if they exist in the spread
        delete supabasePayload.image_url;
        delete supabasePayload.image_preview;
        delete supabasePayload.imageUrl;
        
        console.log(`[API] Inserting template into Supabase: ${templateId}`);
        const { data, error } = await supabase.from('templates').insert(supabasePayload);
        if (error) {
          console.error('[API] Supabase insert error:', error);
        } else {
          console.log('[API] Supabase insert successful');
        }
      } catch (e) {
        console.error('[API] Supabase insert exception:', e);
      }
      return res.json({ success: true, id: templateId, preview_url: cleanPreviewUrl, template: metadata });
    } catch (saveError: any) {
      return res.status(500).json({ success: false, error: saveError.message });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/user/templates', async (req, res) => {
  res.json({ success: true, message: "Bulk update received." });
});

app.put('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { updates } = req.body;

    // Ensure thumbnail is updated if image_url is updated
    if (updates.image_url && !updates.thumbnail) {
      updates.thumbnail = updates.image_url;
    }

    try { await updateTemplateOnGitHub(id, updates); } catch (e) {}
    try { await freeHostService.updateTemplate(id, updates); } catch (e) {}
    await supabase.from('templates').update(updates).eq('id', id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/templates/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await supabase.from('deleted_templates').insert({ id });
    try { await deleteTemplateFromGitHub(id); } catch (e) {}
    try { await freeHostService.deleteTemplate(id); } catch (e) {}
    await supabase.from('templates').delete().eq('id', id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/user/update', async (req, res) => {
    try {
        const { updates } = req.body;
        res.json({ user: { user_metadata: updates } });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// For local development
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  const PORT = 3000;
  const startServer = async () => {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use(errorHandler);
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  };
  startServer();
} else if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
  // Production standalone (not Vercel)
  const PORT = 3000;
  const distPath = path.resolve(__dirname, '..', 'dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      if (req.url.startsWith('/api/')) return res.status(404).json({ error: 'API route not found' });
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }
  app.use(errorHandler);
  app.listen(PORT, '0.0.0.0');
}

export default app;
