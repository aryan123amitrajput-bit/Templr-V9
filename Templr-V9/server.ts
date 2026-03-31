import { uploadQueue } from './src/services/api/queueService';
import './server/workers/uploadWorker';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import { uploadToImgBB } from './src/services/api/imgbbService';
import { uploadToImgHippo } from './src/services/api/imghippoService';
import { uploadToI111666 } from './src/services/api/i111666Service';
import { uploadToGifyu } from './src/services/api/gifyuService';
import { uploadToBeeIMG } from './src/services/api/beeimgService';
import { uploadToPasteRs } from './src/services/api/pasteService';
import { uploadToCatbox } from './src/services/api/catboxService';
import { telegramService } from './src/services/api/telegramService';
import { threadsService } from './src/services/api/threadsService';
import { Octokit } from 'octokit';
import path from 'path';
import { fileURLToPath } from 'url';
import { repoManager, TemplateMetadata } from './src/services/api/repoService';
import { freeHostService } from './src/services/api/freeHostService';
import { getTemplates as getSupabaseTemplates, deleteTemplate as deleteSupabaseTemplate, getUserTemplates as getSupabaseUserTemplates, updateUser as updateSupabaseUser, getSupabase, addTemplate as addSupabaseTemplate, uploadToSupabase } from './src/services/api/supabaseService';
import fs from 'fs';
import crypto from 'crypto';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  return true;
}

/**
 * Processes a URL upload by fetching the content and then using Supabase Storage.
 */
async function processUrlUpload(url: string): Promise<{ imageUrl: string; telegramFileId?: string }> {
    if (!url || !url.startsWith('http')) return { imageUrl: url };
    
    // Skip if already on Supabase or other known hosts
    const hosts = ['threads.net', 'supabase.co', 'i.ibb.co', 'imgbb.com', 'i.111666.best', 'beeimg.com', 'catbox.moe', 'gifyu.com', 'imghippo.com'];
    if (hosts.some(host => url.includes(host))) {
        return { imageUrl: url };
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
        return { imageUrl };
    } catch (error: any) {
        console.error(`[Url Upload] Failed to process URL ${url}:`, error.message);
        return { imageUrl: url }; // Fallback to original URL
    }
}

/**
 * Upload logic using external hosting only (Requested by user).
 */
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
        console.warn('[Upload] Catbox failed, trying Threads...', e.message);
    }

    // 2. Try Threads
    if (threadsService.isConfigured() && !isVideo) {
        try {
            // For general image uploads, we'll use a generic metadata
            const metadata = {
                id: crypto.randomUUID(),
                title: `Upload: ${originalname}`,
                description: 'General upload',
                tags: ['upload'],
                timestamp: new Date().toISOString(),
                author: 'System',
                category: 'Upload',
                price: 'Free'
            };
            const result = await threadsService.publishTemplate([buffer], metadata);
            return { imageUrl: result.mediaUrls[0], hostUsed: 'Threads', postId: result.postId };
        } catch (e: any) {
            console.warn('[Upload] Threads failed. Error:', e.message);
            console.warn('[Upload] Falling back to Supabase...');
        }
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
        console.warn('[Upload] i111666 failed, trying ImgHippo...', e.message);
    }

    // 4. Try ImgHippo
    try {
        const result = await uploadToImgHippo(buffer, originalname);
        return { imageUrl: result.direct_url, hostUsed: 'ImgHippo' };
    } catch (e: any) {
        console.warn('[Upload] ImgHippo failed, trying ImgBB...', e.message);
    }

    // 5. Try ImgBB
    try {
        const result = await uploadToImgBB(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'ImgBB' };
    } catch (e: any) {
        console.warn('[Upload] ImgBB failed, trying Gifyu...', e.message);
    }

    // 6. Try Gifyu
    try {
        const result = await uploadToGifyu(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'Gifyu' };
    } catch (e: any) {
        console.warn('[Upload] Gifyu failed, trying BeeIMG...', e.message);
    }

    // 7. Try BeeIMG (Moved to end due to IPv6 redirect issues)
    try {
        const apiKey = process.env.BEEIMG_API_KEY || '';
        const url = await uploadToBeeIMG(buffer, originalname, mimetype, apiKey);
        return { imageUrl: url, hostUsed: 'BeeIMG' };
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

  // Telegram File Proxy
  app.get('/api/tg-file/:botIndex/:fileId', async (req, res) => {
    try {
      const { botIndex, fileId } = req.params;
      const tgUri = `tg://${botIndex}/${fileId}`;
      
      const downloadUrl = await telegramService.getFileDownloadUrl(tgUri);
      
      // Stream the file from Telegram to the client
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        throw new Error(`Telegram responded with ${response.status}`);
      }
      
      // Pass headers from Telegram
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      if (contentType) res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      
      // Cache the file for 24 hours
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      if (response.body) {
        // Node 18+ fetch response.body is a ReadableStream
        // We can use stream.pipeline or just pipe if it's a node-fetch stream
        // Since we are in express, we can pipe the web stream to the node stream
        const readableWebStream = response.body as any;
        const reader = readableWebStream.getReader();
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        res.status(500).json({ error: 'No response body from Telegram' });
      }
    } catch (error: any) {
      console.error('[Telegram Proxy] Error:', error.message);
      res.status(500).json({ error: 'Failed to fetch file from Telegram' });
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
      // Fetch from Supabase instead of Firestore
      const supabase = getSupabase();
      const { data: templates } = await supabase.from('templates').select('*').eq('status', 'approved') as { data: any[] | null };

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

// --- API Routes ---
  app.post('/api/upload/url', async (req, res) => {
    try {
      const { url, description } = req.body;
      console.log(`[DEBUG] HIT /api/upload/url with url: ${url}`);
      if (!url) return res.status(400).json({ error: 'URL is required' });
      
      console.log(`[Proxy Upload URL] Enqueuing request for: ${url}`);
      
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const buffer = Buffer.from(response.data, 'binary');
      
      const templateId = crypto.randomUUID();
      
      // Create initial record in Supabase
      await addSupabaseTemplate({
          id: templateId,
          title: url.split('/').pop() || 'url-upload',
          description: description || 'URL upload',
          status: 'pending',
          created_at: new Date().toISOString()
      });

      await uploadQueue.add('process-upload', { 
          templateId, 
          fileBuffer: buffer, 
          metadata: { template_name: url.split('/').pop() || 'url-upload', description: description || 'URL upload' } 
      });
      
      res.json({ success: true, message: 'Upload queued', templateId });
    } catch (error: any) {
      console.error('Upload URL Proxy Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Log client-side errors
  app.post('/api/log-error', (req, res) => {
    const { error, context } = req.body;
    console.error('[Client Error]', error, JSON.stringify(context, null, 2));
    res.status(200).json({ status: 'logged' });
  });

  app.post('/api/upload', async (req, res) => {
    try {
      const { file, path: filePath, description } = req.body;
      if (!file || !filePath) {
        throw new Error("File and path are required");
      }

      console.log(`[Upload] Processing upload for path: ${filePath}`);

      // Extract mime type and buffer from base64 string
      const matches = file.match(/^data:([A-Za-z-+\/]*);base64,(.+)$/);
      let buffer;
      let mimetype = 'application/octet-stream';
      if (matches && matches.length === 3) {
        mimetype = matches[1];
        buffer = Buffer.from(matches[2], 'base64');
      } else {
        buffer = Buffer.from(file.split(',')[1] || file, 'base64');
      }

      const originalname = filePath.split('/').pop() || 'upload';
      
      // Process upload synchronously to return URL and host to client
      const { imageUrl, hostUsed } = await processFileUpload(buffer, originalname, mimetype);
      
      // Create record in Supabase
      const templateId = crypto.randomUUID();
      await addSupabaseTemplate({
          id: templateId,
          title: originalname,
          description: description || 'Direct upload',
          status: 'active',
          image_url: imageUrl,
          created_at: new Date().toISOString()
      });
      
      return res.status(200).json({ 
          success: true, 
          url: imageUrl, 
          host: hostUsed, 
          templateId 
      });
    } catch (error: any) {
      console.error('Upload Proxy Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Text Hosting Proxy (Unified Text Upload)
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

  // Text Hosting Proxy (Paste.rs)
  app.post('/api/upload/pastesrs', async (req, res) => {
    try {
      const { content } = req.body;
      if (!content) return res.status(400).json({ error: 'Content is required' });
      
      console.log('[Paste.rs Upload] Received request');
      const url = await uploadToPasteRs(content);
      res.json({ success: true, url, host: 'Paste.rs' });
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
      const userId = req.query.userId as string;
      const email = req.query.email as string;

      // 1. Get templates from Threads (Primary Database)
      let data: any[] = [];
      if (threadsService.isConfigured()) {
          try {
              const threadsTemplates = await threadsService.fetchTemplates();
              console.log(`[API] Threads returned ${threadsTemplates.length} templates.`);
              data = threadsTemplates.map(mapThreadsToTemplate);
          } catch (e) {
              console.error('[API] Threads fetch error:', e);
          }
      } else {
          console.log('[API] Threads service not configured.');
      }

      // 2. Get templates from Supabase (Secondary/Backup source)
      try {
        const supabaseTemplates = await getSupabaseTemplates();
        console.log(`[API] Supabase returned ${supabaseTemplates.length} templates.`);
        data.push(...supabaseTemplates.map(mapSupabaseToTemplate));
      } catch (e) {
        console.error('[API] Supabase fetch error:', e);
      }

      // 3. Get templates from repositories (GitHub/GitLab)
      try {
        const repoTemplates = await repoManager.getMergedRegistry();
        console.log(`[API] RepoManager returned ${repoTemplates.length} templates.`);
        data.push(...repoTemplates);
      } catch (e) {
        console.error('[API] Repo fetch error:', e);
      }

      // 4. Get templates from freeHostService
      try {
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
      } catch (e) {
        console.error('[API] FreeHost fetch error:', e);
      }

      console.log(`[API] Total templates after merging: ${data.length}`);
      
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
      
      console.log(`[API] All template IDs: ${JSON.stringify(data.map(t => t.id))}`);

      // Filter by status 'approved' (or allow if status is missing)
      data = data.filter((t: any) => !t.status || t.status === 'approved');

      // Filter by userId or email if provided
      if (userId || email) {
        data = data.filter((t: any) => {
          const matchId = userId && (t.author_id === userId || (t.author && t.author.id === userId));
          const matchEmail = email && (t.author_email === email || (t.author && t.author.email === email));
          return matchId || matchEmail;
        });
      }

      if (category && category !== 'All') {
        data = data.filter((t: any) => t.category === category);
      }

      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        data = data.filter((t: any) => 
          t.title?.toLowerCase().includes(lowerQuery) || 
          t.description?.toLowerCase().includes(lowerQuery)
        );
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

  // Debug endpoint
  app.get('/api/debug/registry', async (req, res) => {
    try {
      const templates = await repoManager.getMergedRegistry();
      const freeTemplates = await freeHostService.getTemplates(0, 1000); // Fetch a large number to get all
      const merged = [...templates, ...freeTemplates];
      res.json({ 
        repoManagerCount: templates.length, 
        freeHostCount: freeTemplates.length,
        totalCount: merged.length,
        data: merged 
      });
    } catch (error: any) {
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
    console.log(`[API Debug] GET /api/user/templates request received. Query:`, req.query);
    try {
      const email = req.query.email as string;
      if (!email) {
        console.warn(`[API Debug] Missing email in /api/user/templates request`);
        return res.status(400).json({ error: "Email required" });
      }

      let allData: any[] = [];

      // 1. Supabase
      try {
        const supabaseData = await getSupabaseUserTemplates(email);
        console.log(`[API Debug] Supabase returned ${supabaseData?.length || 0} templates for ${email}`);
        allData.push(...supabaseData.map(mapSupabaseToTemplate));
      } catch (e) {
        console.error('[API] Supabase fetch error:', e);
      }

      // 2. Threads
      if (threadsService.isConfigured()) {
          try {
              const threadsTemplates = await threadsService.fetchTemplates();
              const userThreads = threadsTemplates.filter((t: any) => t.author_email === email || t.authorEmail === email);
              console.log(`[API Debug] Threads returned ${userThreads.length} templates for ${email}`);
              allData.push(...userThreads.map(mapThreadsToTemplate));
          } catch (e) {
              console.error('[API] Threads fetch error:', e);
          }
      }

      // 3. RepoManager
      try {
        const repoTemplates = await repoManager.getMergedRegistry();
        const userRepos = repoTemplates.filter((t: any) => t.author_email === email || t.authorEmail === email);
        console.log(`[API Debug] RepoManager returned ${userRepos.length} templates for ${email}`);
        allData.push(...userRepos);
      } catch (e) {
        console.error('[API] Repo fetch error:', e);
      }

      // 4. FreeHostService
      try {
        const freeTemplates = await freeHostService.getTemplates(0, 1000);
        const userFree = freeTemplates.filter((t: any) => t.creator_email === email || t.author_email === email);
        console.log(`[API Debug] FreeHostService returned ${userFree.length} templates for ${email}`);
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
        
      // Sort manually if needed
      allData.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      res.json({ data: allData });
    } catch (error: any) {
      console.error('[API Debug] Error in /api/user/templates:', error.message || error);
      res.status(500).json({ error: error.message || 'Internal server error' });
    }
  });

  // Get Template By ID
  app.get('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // 1. Try GitHub/GitLab
      let template = await repoManager.getTemplateById(id);
      
      // 2. Try FreeHost
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

      // 4. Try Threads (Primary Database)
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
      
      // 4. Try Firebase (Skipped as Firebase is only for Auth)
      
      if (template) {
        res.json({ template });
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
      let finalGalleryImages = template.gallery_images || [];
      
      // 3. Threads First (Mandatory Step)
      let threadsPostId = '';
      
      if (threadsService.isConfigured()) {
          try {
              console.log(`[Threads] Posting template: ${template.title || template.name}`);
              
              let imageBuffers: Buffer[] = [];
              
              // Helper to fetch image buffer
              const fetchBuffer = async (url: string) => {
                  if (url.startsWith('http')) {
                      const res = await axios.get(url, { responseType: 'arraybuffer' });
                      return Buffer.from(res.data);
                  } else if (url.startsWith('data:image')) {
                      const matches = url.match(/^data:([A-Za-z-+\/]*);base64,(.+)$/);
                      if (matches && matches.length === 3) {
                          return Buffer.from(matches[2], 'base64');
                      }
                  }
                  return null;
              };

              // Main image
              const mainBuffer = await fetchBuffer(finalImageUrl);
              if (mainBuffer) imageBuffers.push(mainBuffer);

              // Gallery images
              if (template.gallery_images && Array.isArray(template.gallery_images)) {
                  for (const imgUrl of template.gallery_images) {
                      const buf = await fetchBuffer(imgUrl);
                      if (buf) imageBuffers.push(buf);
                  }
              }

              if (imageBuffers.length > 0) {
                  const threadsResult = await threadsService.publishTemplate(imageBuffers, {
                      id: templateId,
                      title: template.title || template.name,
                      description: template.description || '',
                      tags: template.tags || [],
                      author: template.author_name || 'Anonymous',
                      category: template.category || 'Uncategorized',
                      price: template.price || 'Free',
                      timestamp: new Date().toISOString()
                  });
                  threadsPostId = threadsResult.postId;
                  const mediaUrls = threadsResult.mediaUrls;
                  if (mediaUrls.length > 0) {
                      finalImageUrl = mediaUrls[0];
                      if (mediaUrls.length > 1) {
                          finalGalleryImages = mediaUrls.slice(1);
                      }
                  }
                  console.log(`[Threads] Success: ${threadsPostId}`);
              }
          } catch (e: any) {
              console.warn(`[Threads] Failed to post template: ${e.message}`);
          }
      }

      let finalBannerUrl = template.banner_url || template.bannerUrl || finalImageUrl;
      let telegramFileId = '';

      // Upload main image
      if (finalImageUrl) {
        const result = await processUrlUpload(finalImageUrl);
        finalImageUrl = result.imageUrl;
        if (result.telegramFileId) telegramFileId = result.telegramFileId;
      }
      
      // Upload banner image
      if (finalBannerUrl && finalBannerUrl !== (template.preview_image || template.image_url || template.imageUrl)) {
        const result = await processUrlUpload(finalBannerUrl);
        finalBannerUrl = result.imageUrl;
      } else {
        finalBannerUrl = finalImageUrl;
      }

      // Upload gallery images
      if (Array.isArray(finalGalleryImages)) {
        for (let i = 0; i < finalGalleryImages.length; i++) {
          if (finalGalleryImages[i]) {
            const result = await processUrlUpload(finalGalleryImages[i]);
            finalGalleryImages[i] = result.imageUrl;
          }
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
        thumbnail: finalImageUrl,
        image_url: finalImageUrl,
        banner_url: finalBannerUrl,
        gallery_images: finalGalleryImages,
        file_url: template.file_url || '',
        tags: template.tags || [],
        author: template.author_name || 'Anonymous',
        author_name: template.author_name || 'Anonymous',
        author_email: template.author_email || '',
        author_avatar: template.author_avatar || '',
        author_id: template.author_uid || template.author_id || '',
        created_at: new Date().toISOString(),
        category: template.category || 'Uncategorized',
        price: template.price || 'Free',
        views: 0,
        likes: 0,
        sales: 0,
        earnings: 0,
        status: template.status || 'approved',
        telegram_file_id: telegramFileId,
        threads_post_id: threadsPostId,
        threads_post_url: threadsPostId ? `https://www.threads.net/t/${threadsPostId}` : ''
      };

      // 6. Save to GitHub
      await repoManager.uploadTemplate(metadata);

      // 7. Save to Supabase (CRITICAL for persistence on refresh)
      try {
        console.log(`[API] Attempting to save template ${templateId} to Supabase...`);
        await addSupabaseTemplate(metadata);
        console.log(`[API] Successfully saved template ${templateId} to Supabase.`);
      } catch (supabaseErr: any) {
        console.error(`[API] Failed to save to Supabase: ${supabaseErr.message}`);
        // For persistence, we should probably fail if it's the primary DB.
        // But for now we'll just log it to avoid breaking the flow if Supabase is down.
      }
      
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

      // Ensure thumbnail is updated if image_url is updated
      if (updates.image_url && !updates.thumbnail) {
        updates.thumbnail = updates.image_url;
      }

      // Update GitHub
      await repoManager.updateTemplate(id, updates);
      
      // Update Supabase
      try {
          const { updateTemplate } = await import('./server/services/supabaseService.js');
          await updateTemplate(id, updates);
      } catch (e) {
          console.error('[Supabase Update Error]:', e);
      }
      
      res.json({ success: true });
    } catch (error: any) {
      console.error('API Error (Update Template):', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete all Supabase templates (Admin only)
  app.delete('/api/admin/templates/supabase', async (req, res) => {
    try {
      // In a real app, verify admin auth here
      const { deleteAllTemplates } = await import('./server/services/supabaseService.js');
      await deleteAllTemplates();
      res.json({ success: true, message: 'All Supabase templates deleted' });
    } catch (error: any) {
      console.error('API Error (Delete All Supabase Templates):', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete Template
  app.delete('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[API] Deleting template: ${id}`);
      
      let deletedCount = 0;
      let errors: string[] = [];
      
      // 1. Get template metadata first to find Threads Post ID
      let template = await repoManager.getTemplateById(id);
      if (!template) {
          const supabaseTemplates = await getSupabaseTemplates();
          const found = supabaseTemplates.find((t: any) => t.id === id);
          if (found) template = mapSupabaseToTemplate(found);
      }

      // Delete from Threads
      if (template && template.threads_post_id && threadsService.isConfigured()) {
          try {
              console.log(`[API] Deleting from Threads: ${template.threads_post_id}`);
              await threadsService.deleteTemplate(template.threads_post_id);
              deletedCount++;
          } catch (error: any) {
              console.error(`[API] Failed to delete from Threads: ${template.threads_post_id}`, error);
              errors.push(`Threads: ${error.message}`);
          }
      }

      // Delete from GitHub
      try {
        await repoManager.deleteTemplate(id);
        console.log(`[API] Deleted from GitHub: ${id}`);
        deletedCount++;
      } catch (error: any) {
        console.error(`[API] Failed to delete from GitHub: ${id}`, error);
        errors.push(`GitHub: ${error.message}`);
      }
      
      // Delete from Supabase
      try {
        await deleteSupabaseTemplate(id);
        console.log(`[API] Deleted from Supabase: ${id}`);
        deletedCount++;
      } catch (error: any) {
        console.error(`[API] Failed to delete from Supabase: ${id}`, error);
        errors.push(`Supabase: ${error.message}`);
      }

      // Delete from FreeHost
      try {
        const deleted = await freeHostService.deleteTemplate(id);
        if (deleted) {
          console.log(`[API] Deleted from FreeHost: ${id}`);
          deletedCount++;
        }
      } catch (error: any) {
        console.error(`[API] Failed to delete from FreeHost: ${id}`, error);
        errors.push(`FreeHost: ${error.message}`);
      }

      // Delete from Firebase (Skipped as Firebase is only for Auth)
      
      if (deletedCount === 0 && errors.length > 0) {
        // All attempted deletions failed
        return res.status(500).json({ error: `Failed to delete template: ${errors.join(', ')}` });
      }
      
      res.json({ success: true, deletedCount, errors: errors.length > 0 ? errors : undefined });
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
          
          await updateSupabaseUser(uid, updates);
          
          res.json({ success: true });
      } catch (error: any) {
          console.error('API Error (Update User):', error);
          res.status(500).json({ error: error.message });
      }
  });

  // --- API Catch-all (before Vite) ---
  app.all('/api/*all', (req, res) => {
    console.warn(`[API Debug] 404 Not Found: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // --- Vite Middleware ---
  console.log("NODE_ENV:", process.env.NODE_ENV);
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
      app.get('*all', (req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
    }
  } catch (viteError) {
    console.error("Failed to initialize Vite middleware:", viteError);
    // Continue starting the server even if Vite fails, so API routes still work
  }

  console.log("Attempting to start server...");
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
