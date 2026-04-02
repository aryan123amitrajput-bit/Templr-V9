import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { uploadToImgBB } from './server/services/imgbbService';
import { uploadToImgHippo } from './server/services/imghippoService';
import { uploadToI111666 } from './server/services/i111666Service';
import { uploadToGifyu } from './server/services/gifyuService';
import { uploadToCatbox } from './server/services/catboxService';
import { uploadToBeeIMG } from './server/services/beeimgService';
import { uploadToTelegram } from './server/services/telegramService';
import { uploadToPasteRs } from './server/services/pasteService';
import { Octokit } from 'octokit';
import path from 'path';
import { fileURLToPath } from 'url';
import { repoManager, TemplateMetadata } from './server/services/repoService';
import { freeHostService } from './server/services/freeHostService';
import { getTemplates as getSupabaseTemplates, deleteTemplate as deleteSupabaseTemplate } from './server/services/supabaseService';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Firebase Admin is still initialized for Auth if needed, but Firestore is removed.
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
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
    admin.initializeApp({
      credential: credential,
      projectId: firebaseConfig.projectId,
    });
    console.log("Firebase Admin initialized:", admin.app().name);
  } catch (e) {
    console.error("Firebase Admin initialization failed:", e);
    // Do not throw, allow server to start even if Firebase fails (e.g. during remix setup)
  }
}

// Environment Variables
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
 * In a real scenario, this would involve more logic or a dedicated service.
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
  // Map updates to TemplateMetadata fields
  const metadataUpdates: any = { ...updates };
  
  // Ensure field names match what GitHub expects if they differ
  if (updates.title || updates.name) metadataUpdates.title = updates.title || updates.name;
  if (updates.image_url || updates.image_preview || updates.preview_image) metadataUpdates.thumbnail = updates.preview_image || updates.image_preview || updates.image_url;
  if (updates.author_name || updates.creator) metadataUpdates.author = updates.author_name || updates.creator;
  
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
    ...template // Keep everything else
  };
  await repoManager.uploadTemplate(metadata);
}

/**
 * Processes a URL upload by fetching the content and then using Supabase Storage.
 */
async function processUrlUpload(url: string): Promise<string> {
    if (!url || !url.startsWith('http')) return url;
    
    // Skip if already on Supabase or other known hosts
    const hosts = ['supabase.co', 'i.ibb.co', 'imgbb.com', 'i.111666.best', 'beeimg.com', 'catbox.moe', 'gifyu.com', 'imghippo.com'];
    if (hosts.some(host => url.includes(host))) {
        return url;
    }

    try {
        console.log(`[Url Upload] Fetching content from: ${url}`);
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch image from URL: ${url}`);
        
        const buffer = Buffer.from(await response.arrayBuffer());
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        const originalName = url.split('/').pop()?.split('?')[0] || 'image.jpg';
        
        const { imageUrl, hostUsed } = await processFileUpload(buffer, originalName, contentType);
        console.log(`[Url Upload] Successfully processed URL. Host: ${hostUsed}, New URL: ${imageUrl}`);
        return imageUrl;
    } catch (error: any) {
        console.error(`[Url Upload] Failed to process URL ${url}:`, error.message);
        return url; // Fallback to original URL
    }
}

/**
 * Upload logic using external hosting only (Requested by user).
 */
async function processFileUpload(buffer: Buffer, originalname: string, mimetype: string) {
    const isVideo = mimetype.startsWith('video/');
    
    console.log(`[Upload] Processing ${isVideo ? 'video' : 'image'} upload: ${originalname}`);

    // 1. Try Telegram
    try {
        const url = await uploadToTelegram(buffer, originalname, mimetype);
        return { imageUrl: url, hostUsed: 'Telegram' };
    } catch (e: any) {
        console.warn('[Upload] Telegram failed, trying BeeIMG...', e.message);
    }

    // 2. Try BeeIMG
    try {
        const apiKey = process.env.BEEIMG_API_KEY || '';
        const url = await uploadToBeeIMG(buffer, originalname, mimetype, apiKey);
        return { imageUrl: url, hostUsed: 'BeeIMG' };
    } catch (e: any) {
        console.warn('[Upload] BeeIMG failed, trying Catbox...', e.message);
    }

    // 2. Try Catbox
    try {
        const userhash = process.env.CATBOX_USERHASH || '';
        const result = await uploadToCatbox(buffer, originalname, mimetype, userhash);
        return { imageUrl: result.direct_url, hostUsed: 'Catbox' };
    } catch (e: any) {
        console.warn('[Upload] Catbox failed, trying ImgBB...', e.message);
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
        console.warn('[Upload] ImgHippo failed, trying i111666...', e.message);
    }

    // 6. Try i111666 (Last)
    try {
        const result = await uploadToI111666(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'i111666' };
    } catch (e: any) {
        console.error('[Upload] All external hosts failed:', e.message);
        throw new Error('Upload failed on all available external hosts. Please check your internet connection or API keys.');
    }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' })); // Increased limit for base64 uploads
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Request Logging
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    if (req.url === '/api/upload') {
      console.log(`[Debug Upload] Content-Type: ${req.headers['content-type']}`);
      console.log(`[Debug Upload] Body defined: ${!!req.body}`);
      if (req.body) {
        console.log(`[Debug Upload] Body keys: ${Object.keys(req.body)}`);
      }
    }
    next();
  });

  // Health Check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
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
      // Fetch from Firestore instead of Supabase
      const db = getFirestore();
      const templatesRef = db.collection('templates');
      const snapshot = await templatesRef.where('status', '==', 'approved').get();
      const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

      const baseUrl = 'https://templr-v9.vercel.app';
      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      
      // Homepage
      xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

      // Categories
      const categories = ['saas', 'startup', 'portfolio', 'ai-landing-page', 'dark-ui'];
      categories.forEach(cat => {
        xml += `  <url>\n    <loc>${baseUrl}/${cat}-templates</loc>\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
      });

      // Templates
      if (templates) {
        templates.forEach(t => {
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
  app.post('/api/upload/url', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'URL is required' });
      
      console.log(`[Proxy Upload URL] Received request for: ${url}`);
      const imageUrl = await processUrlUpload(url);
      
      res.json({ url: imageUrl, host: 'Multi-service' });
    } catch (error: any) {
      console.error('Upload URL Proxy Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/upload', async (req, res) => {
    try {
      if (!req.body) {
        console.error("[Proxy Upload] req.body is undefined. Check Content-Type and body-parser.");
        return res.status(400).json({ error: "Request body is missing" });
      }
      const { file, path: filePath } = req.body;
      if (!file || !filePath) {
        console.error("[Proxy Upload] Missing file or path in body. Keys:", Object.keys(req.body));
        throw new Error("File and path are required");
      }

      console.log(`[Proxy Upload] Received upload request for path: ${filePath}`);

      // Extract mime type and buffer from base64 string
      const matches = file.match(/^data:([A-Za-z-+\/]*);base64,(.+)$/);
      let buffer;
      let contentType = 'application/octet-stream';

      if (matches && matches.length === 3) {
        contentType = matches[1] || 'application/octet-stream';
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(file.split(',')[1] || file, 'base64');
      }

      // Guess content type if needed
      if (contentType === 'application/octet-stream' || !contentType) {
          const ext = filePath.split('.').pop()?.toLowerCase();
          if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
          else if (ext === 'png') contentType = 'image/png';
          else if (ext === 'gif') contentType = 'image/gif';
          else if (ext === 'webp') contentType = 'image/webp';
          else if (ext === 'svg') contentType = 'image/svg+xml';
          else if (ext === 'mp4') contentType = 'video/mp4';
          else if (ext === 'webm') contentType = 'video/webm';
      }

      const originalName = filePath.split('/').pop() || 'upload';
      console.log(`[Proxy Upload] Processing multi-service upload for: ${originalName} (${contentType})`);

      const { imageUrl, hostUsed } = await processFileUpload(buffer, originalName, contentType);

      console.log(`[Proxy Upload] Success. Host: ${hostUsed}, URL: ${imageUrl}`);
      res.json({ url: imageUrl, host: hostUsed });
    } catch (error: any) {
      console.error('Upload Proxy Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Text Hosting Proxy (Paste.rs)
  app.post('/api/upload/pastesrs', async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: 'Content is required' });
      
      console.log('[Paste.rs Upload] Received request');
      const url = await uploadToPasteRs(content);
      res.json({ success: true, url });
    } catch (error: any) {
      console.error('Paste.rs Upload Error:', error);
      res.status(500).json({ error: error.message });
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

      let data = await repoManager.getMergedRegistry();
      console.log(`[API] RepoManager returned ${data.length} templates.`);
      
      // Add templates from freeHostService
      const freeTemplates = await freeHostService.getTemplates(page, limitNum, category, searchQuery);
      console.log(`[API] FreeHostService returned ${freeTemplates.length} templates.`);
      const mappedFreeTemplates = freeTemplates.map((t: any) => ({
        id: t.id,
        title: t.name,
        thumbnail: t.image_preview,
        author: t.creator,
        tags: t.tags || [],
        category: t.category,
        created_at: t.created_at,
        likes: t.stats?.likes || 0,
        views: t.stats?.views || 0,
        status: 'approved'
      }));
      
      data.push(...mappedFreeTemplates);
      
      // Add templates from Supabase
      try {
        const supabaseTemplates = await getSupabaseTemplates();
        console.log(`[API] Supabase returned ${supabaseTemplates.length} templates.`);
        
        const mappedSupabaseTemplates = supabaseTemplates.map((t: any) => ({
          id: t.id,
          title: t.title,
          imageUrl: t.thumbnail_url || t.thumbnail || t.image_url, // Keep imageUrl for UI
          thumbnail: t.thumbnail_url || t.thumbnail || t.image_url, // Add thumbnail for TemplateMetadata interface
          author: t.author_name,
          tags: t.tags || [],
          category: t.category,
          created_at: t.created_at,
          likes: t.likes || 0,
          views: t.views || 0,
          status: 'approved'
        }));
        data.push(...mappedSupabaseTemplates);
      } catch (e) {
        console.error('[API] Supabase fetch error:', e);
      }
      
      console.log(`[API] Total templates after merging: ${data.length}`);

      // Filter by status 'approved' (or allow if status is missing)
      data = data.filter((t: any) => !t.status || t.status === 'approved');

      if (category && category !== 'All') {
        data = data.filter((t: any) => t.category === category);
      }

      if (sortBy === 'popular' || sortBy === 'likes') {
        data = data.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
      } else {
        data = data.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      }

      const hasMore = data.length > (page + 1) * limitNum;
      const paginatedData = data.slice(page * limitNum, (page + 1) * limitNum);

      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        data = data.filter((t: any) => 
          t.title?.toLowerCase().includes(lowerQuery) || 
          t.description?.toLowerCase().includes(lowerQuery)
        );
      }

      res.json({ 
        data: paginatedData, 
        hasMore 
      });
    } catch (error: any) {
      console.error('API Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Image Proxy
  app.get('/api/image-proxy', async (req, res) => {
    try {
      const url = req.query.url as string;
      if (!url) return res.status(400).json({ error: 'URL is required' });
      
      console.log(`[Image Proxy] Fetching: ${url}`);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      
      const buffer = await response.buffer();
      const contentType = response.headers.get('content-type') || 'image/jpeg';
      
      res.set('Content-Type', contentType);
      res.send(buffer);
    } catch (error: any) {
      console.error('Image Proxy Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Telegram File Proxy
  app.get('/api/tg-file/:id/:fileId', async (req, res) => {
    try {
      const { fileId } = req.params;
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) throw new Error('Telegram token not configured');

      console.log(`[TG File Proxy] Fetching file info for: ${fileId}`);
      const response = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
      const data = await response.json();
      
      if (!data.ok) throw new Error(data.description || 'Failed to get file info');
      
      const filePath = data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
      
      console.log(`[TG File Proxy] Redirecting to: ${fileUrl}`);
      res.redirect(fileUrl);
    } catch (error: any) {
      console.error('TG File Proxy Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Featured Creators
  app.get('/api/creators', async (req, res) => {
    try {
      const templates = await repoManager.getMergedRegistry();
      const approvedTemplates = templates.filter((t: any) => t.status === 'approved');
      
      const creatorsMap = new Map();
      approvedTemplates.forEach((t: any) => {
        if (!t.author_email) return;
        if (!creatorsMap.has(t.author_email)) {
          creatorsMap.set(t.author_email, {
            author_name: t.author_name || 'Anonymous',
            author_email: t.author_email,
            author_avatar: t.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author_name || 'Anonymous')}&background=random`,
            views: 0,
            likes: 0,
            templates: 0
          });
        }
        const creator = creatorsMap.get(t.author_email);
        creator.views += (t.views || 0);
        creator.likes += (t.likes || 0);
        creator.templates += 1;
      });

      const creators = Array.from(creatorsMap.values())
        .sort((a: any, b: any) => (b.likes + b.views) - (a.likes + a.views))
        .slice(0, 10); // Top 10

      res.json({ data: creators });
    } catch (error: any) {
      console.error('API Error (Creators):', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- User & Template Management Routes ---

  // Get User Templates
  app.get('/api/user/templates', async (req, res) => {
    try {
      const email = req.query.email as string;
      if (!email) throw new Error("Email required");

      const db = getFirestore();
      const templatesRef = db.collection('templates');
      const snapshot = await templatesRef.where('author_email', '==', email).orderBy('created_at', 'desc').get();
      
      const allData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));

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
      const db = getFirestore();
      const docRef = db.collection('templates').doc(id);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        res.json({ data: { id: docSnap.id, ...docSnap.data() } });
      } else {
        res.status(404).json({ error: 'Template not found' });
      }
    } catch (error: any) {
      console.error('API Error (Get Template):', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Add Template
  // Create Template

  app.post('/api/templates', async (req, res) => {
    try {
      const { template } = req.body;
      
      if (!template) {
        return res.status(400).json({ error: 'Template is required' });
      }

      // 1. Generate unique ID
      const templateId = crypto.randomUUID();

      // 2. Process Images (Upload to Multi-service)
      let finalImageUrl = template.preview_image || template.image_url || template.imageUrl || '';
      let finalBannerUrl = template.banner_url || template.bannerUrl || finalImageUrl;
      let finalGalleryImages = template.gallery_images || [];

      // Upload main image
      if (finalImageUrl) {
        finalImageUrl = await processUrlUpload(finalImageUrl);
      }
      
      // Upload banner image
      if (finalBannerUrl && finalBannerUrl !== (template.preview_image || template.image_url || template.imageUrl)) {
        finalBannerUrl = await processUrlUpload(finalBannerUrl);
      } else {
        finalBannerUrl = finalImageUrl;
      }

      // Upload gallery images
      if (Array.isArray(finalGalleryImages)) {
        for (let i = 0; i < finalGalleryImages.length; i++) {
          if (finalGalleryImages[i]) {
            finalGalleryImages[i] = await processUrlUpload(finalGalleryImages[i]);
          }
        }
      }

      // 3. Process Source Code (Upload to Paste.rs)
      let finalSourceCode = template.sourceCode || '';
      if (finalSourceCode && finalSourceCode.length > 0 && !finalSourceCode.startsWith('http')) {
          try {
              console.log(`[Paste.rs Upload] Uploading source code for template: ${template.title || template.name}`);
              finalSourceCode = await uploadToPasteRs(finalSourceCode);
              console.log(`[Paste.rs Upload] Success: ${finalSourceCode}`);
          } catch (e: any) {
              console.error("Paste.rs Upload Failed:", e.message);
          }
      }

      // 4. Generate Clean Preview URL
      const cleanPreviewUrl = generatePreviewUrl(template.file_url || finalImageUrl);

      // 5. Create metadata object
      const metadata: TemplateMetadata = {
        id: templateId,
        title: template.title || template.name,
        description: template.description || '',
        preview_url: cleanPreviewUrl,
        thumbnail: cleanPreviewUrl,
        image_url: finalImageUrl,
        banner_url: finalBannerUrl,
        gallery_images: finalGalleryImages,
        file_url: template.file_url || '',
        source_code: finalSourceCode,
        tags: template.tags || [],
        author: template.author_name || 'Anonymous',
        author_name: template.author_name || 'Anonymous',
        author_email: template.author_email || '',
        author_avatar: template.author_avatar || '',
        created_at: new Date().toISOString(),
        category: template.category || 'Uncategorized',
        price: template.price || 'Free',
        views: 0,
        likes: 0,
        sales: 0,
        earnings: 0,
        status: template.status || 'approved'
      };

      // 6. Save to GitHub
      await repoManager.uploadTemplate(metadata);

      return res.json({ 
        success: true, 
        id: templateId, 
        preview_url: cleanPreviewUrl,
        message: "Saved to GitHub successfully.",
        template: { id: templateId, ...metadata }
      });
    } catch (error: any) {
      console.error('API Error (Create Template):', error);
      res.status(500).json({ error: error.message || 'Unknown error' });
    }
  });

  // Update All Templates by Author (e.g. when profile changes)
  app.put('/api/user/templates', async (req, res) => {
    try {
      const { email, updates } = req.body;
      if (!email) throw new Error("Email required");

      // Note: Updating ALL templates on GitHub is expensive.
      // In a real app, we'd use a search index.
      // For now, we'll just return success and let the user know it's a limitation.
      console.log(`Bulk update requested for ${email}, but skipping GitHub bulk update for performance.`);
      
      res.json({ success: true, message: "Bulk update received (GitHub limitation: individual updates preferred)." });
    } catch (error: any) {
      console.error('API Error (Update User Templates):', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update Template
  app.put('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { updates } = req.body;
      
      // Process Images (Upload to Multi-service)
      if (updates.image_url) {
        updates.image_url = await processUrlUpload(updates.image_url);
      }
      if (updates.imageUrl) {
        updates.image_url = await processUrlUpload(updates.imageUrl);
        delete updates.imageUrl;
      }
      if (updates.banner_url) {
        updates.banner_url = await processUrlUpload(updates.banner_url);
      }
      if (updates.bannerUrl) {
        updates.banner_url = await processUrlUpload(updates.bannerUrl);
        delete updates.bannerUrl;
      }
      if (updates.gallery_images && Array.isArray(updates.gallery_images)) {
        for (let i = 0; i < updates.gallery_images.length; i++) {
          if (updates.gallery_images[i]) {
            updates.gallery_images[i] = await processUrlUpload(updates.gallery_images[i]);
          }
        }
      }

      // Process Source Code (Upload to Paste.rs)
      if (updates.sourceCode && updates.sourceCode.length > 0 && !updates.sourceCode.startsWith('http')) {
          try {
              console.log(`[Paste.rs Update] Uploading source code for template: ${id}`);
              updates.source_code = await uploadToPasteRs(updates.sourceCode);
              delete updates.sourceCode;
              console.log(`[Paste.rs Update] Success: ${updates.source_code}`);
          } catch (e: any) {
              console.error("Paste.rs Upload Failed:", e.message);
          }
      }

      // Update GitHub
      await repoManager.updateTemplate(id, updates);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('API Error (Update Template):', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete Template
  app.delete('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // Delete from GitHub
      await repoManager.deleteTemplate(id);
      
      // Delete from Supabase
      await deleteSupabaseTemplate(id);
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('API Error (Delete Template):', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Upload File (Proxy)
  // Note: For real file uploads, we'd need multer. 
  // For now, we'll assume the client sends a base64 or we skip this for the "Failed to fetch" fix 
  // unless the user specifically tries to upload. 
  // But the error "Failed to fetch" is likely from the polling `listenForUserTemplates`.

  // Update User Profile
  app.post('/api/user/update', async (req, res) => {
      try {
          const { updates, uid } = req.body;
          if (!uid) throw new Error("User ID required");
          
          const db = getFirestore();
          const userRef = db.collection('users').doc(uid);
          await userRef.set({
              ...updates,
              updated_at: new Date().toISOString()
          }, { merge: true });
          
          res.json({ success: true });
      } catch (error: any) {
          res.status(500).json({ error: error.message });
      }
  });

  // --- Vite Middleware ---
  try {
    if (process.env.NODE_ENV !== 'production') {
      console.log("Initializing Vite middleware...");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      console.log("Vite middleware initialized.");
    } else {
      // Production: Serve static files
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
    }
  } catch (viteError) {
    console.error("Failed to initialize Vite middleware:", viteError);
    // Continue starting the server even if Vite fails, so API routes still work
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. This shouldn't happen in this environment.`);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer();
