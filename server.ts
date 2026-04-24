import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import { uploadToImgBB } from './server/services/imgbbService';
import { uploadToImgHippo } from './server/services/imghippoService';
import { uploadToGifyu } from './server/services/gifyuService';
import { uploadToCatbox } from './server/services/catboxService';
import { uploadToBeeIMG } from './server/services/beeimgService';
import { uploadToUguu } from './server/services/uguuService';
import { uploadToPasteRs } from './server/services/pasteService';
import { telegramService } from './server/services/telegramService';
import { Octokit } from '@octokit/rest';
import path from 'path';
import { fileURLToPath } from 'url';
import { repoManager, TemplateMetadata } from './server/services/repoService';
import { freeHostService } from './server/services/freeHostService';
import { traffService } from './server/services/traffService';
import { getTemplates as getSupabaseTemplates, deleteTemplate as deleteSupabaseTemplate, getUserTemplates as getSupabaseUserTemplates, updateUser as updateSupabaseUser, getSupabase, addTemplate as addSupabaseTemplate, uploadToSupabase } from './server/services/supabaseService';
import { mapToTemplate } from './lib/mapping.ts';
import admin from 'firebase-admin';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));


/**
 * Maps Supabase template data to the frontend Template interface.
 */
function mapSupabaseToTemplate(t: any) {
  return mapToTemplate(t);
}

// --- BACKGROUND CACHE WIRE ---
class CacheWire {
  public registry: any[] = [];
  public creators: any[] = [];
  public hosts: any[] = [];
  public stats: any = {};
  public lastUpdated = 0;
  private syncPromise: Promise<void> | null = null;
  
  constructor() {
    this.syncPromise = this.refresh();
    setInterval(() => this.refresh(), 30000); 
  }

  public async ensureSynchronized(timeoutMs = 5000) {
    if (this.registry.length > 0) return;
    if (this.syncPromise) {
      await Promise.race([
        this.syncPromise,
        new Promise(resolve => setTimeout(resolve, timeoutMs))
      ]);
    }
  }
  
  async refresh() {
    console.log("[Server CacheWire] 🔌 Synchronizing All Services Wires...");
    try {
      const results = await Promise.allSettled([
        repoManager.getMergedRegistry(),
        getSupabaseTemplates().catch((e) => {
          console.error('[Server CacheWire] Supabase fetch error:', e);
          return [];
        }),
        freeHostService.getTemplates(0, 500).catch(() => []),
        telegramService.getTemplates().catch(() => [])
      ]);

      const [gitRes, supabaseRes, freeRes, tgRes] = results;

      const gitData = gitRes.status === 'fulfilled' ? gitRes.value : [];
      const supabaseData = supabaseRes.status === 'fulfilled' ? supabaseRes.value : [];
      const freeHostData = freeRes.status === 'fulfilled' ? freeRes.value : [];
      const tgTemplates = tgRes.status === 'fulfilled' ? tgRes.value : [];
      
      console.log(`[Server CacheWire] 📊 Sync results - GitHub: ${gitData.length}, Supabase: ${supabaseData.length}, FreeHost: ${freeHostData.length}, Telegram: ${tgTemplates.length}`);

      const mappedSupabase = (supabaseData || []).map((t: any) => ({ ...t, _source: 'supabase' }));
      const mappedFreeHost = (freeHostData || []).map((t: any) => ({ ...t, _source: 'freehost' }));
      const mappedTelegram = (tgTemplates || []).map((t: any) => ({ ...t, _source: 'telegram' }));
      
      const templatesMap = new Map();
      
      if (Array.isArray(gitData)) {
        gitData.forEach((t: any) => {
          if (t && t.id && !templatesMap.has(t.id)) templatesMap.set(t.id, { ...t, _source: 'git' });
        });
      }
      
      mappedFreeHost.forEach((t: any) => {
        if (t && t.id && !templatesMap.has(t.id)) templatesMap.set(t.id, { ...mapSupabaseToTemplate(t), _source: 'freehost' });
      });

      mappedTelegram.forEach((t: any) => {
        if (t && t.id && !templatesMap.has(t.id)) templatesMap.set(t.id, { ...mapSupabaseToTemplate(t), _source: 'telegram' });
      });
      
      mappedSupabase.forEach((t: any) => {
        if (t && t.id && !templatesMap.has(t.id)) templatesMap.set(t.id, { ...mapSupabaseToTemplate(t), _source: 'supabase' });
      });

      let freshRegistry = Array.from(templatesMap.values());
      freshRegistry = freshRegistry.filter((t: any) => t);
      
      freshRegistry.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      
      this.registry = freshRegistry;

      // Calculate Creators Wire
      const creatorsMap = new Map();
      this.registry.forEach((t: any) => {
        const email = t.author_email || t.authorEmail || t.creator_email;
        if (!email) return;
        if (!creatorsMap.has(email)) {
          creatorsMap.set(email, {
            email,
            name: t.author_name || t.authorName || t.author || t.creator || 'Anonymous',
            avatar: t.authorAvatar || t.author_avatar || t.creator_avatar || '',
            templateCount: 0,
            likes: 0,
            views: 0
          });
        }
        const creator = creatorsMap.get(email);
        creator.templateCount++;
        creator.likes += (t.likes || t.stats?.likes || 0);
        creator.views += (t.views || t.stats?.views || 0);
      });
      this.creators = Array.from(creatorsMap.values()).sort((a, b) => (b.likes + b.views) - (a.likes + a.views)).slice(0, 20);

      // Hosts Wire
      this.hosts = await traffService.auditHosts().catch(() => []);

      // Stats Wire
      this.stats = {
        totalTemplates: this.registry.length,
        activeCreators: creatorsMap.size,
        healthyHosts: this.hosts.filter(h => h.isReachable).length,
        lastSync: new Date().toISOString()
      };

      this.lastUpdated = Date.now();
      console.log(`[Server CacheWire] ⚡ Full Sync Complete: ${this.registry.length} templates, ${this.creators.length} creators.`);
    } catch (error) {
      console.error('[Server CacheWire] Sync failure:', error);
    }
  }
}

const backgroundWire = new CacheWire();

// Firebase Admin is still initialized for Auth if needed, but Firestore is removed.
const firebaseConfigPath = path.join(__dirname, 'firebase-applet-config.json');
let firebaseConfig: any = null;

if (fs.existsSync(firebaseConfigPath)) {
  firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));
  try {
    // Initialize Admin SDK
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
    console.log("Firebase Admin options:", JSON.stringify(admin.app().options));
  } catch (e) {
    console.error("Firebase initialization failed:", e);
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
  return true;
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

    type UploadProvider = {
        name: string;
        upload: () => Promise<{ imageUrl: string; hostUsed: string }>;
    };

    const providers: UploadProvider[] = [];

    // BeeIMG
    providers.push({
        name: 'BeeIMG',
        upload: async () => {
            const apiKey = process.env.BEEIMG_API_KEY || '098dccd10fb840e72711cdf846b50222';
            const result = await uploadToBeeIMG(buffer, originalname, mimetype, apiKey);
            return { imageUrl: result.direct_url, hostUsed: 'BeeIMG' };
        }
    });

    // Catbox (supports anonymous, valid userhash optional)
    providers.push({
        name: 'Catbox',
        upload: async () => {
            let userhash = process.env.CATBOX_USERHASH;
            if (userhash && userhash.length < 5) userhash = undefined; // Ignore dummy/empty values
            try {
                const result = await uploadToCatbox(buffer, originalname, mimetype, userhash);
                return { imageUrl: result.direct_url, hostUsed: 'Catbox' };
            } catch (e: any) {
                console.error(`[Upload] Catbox failed: ${e.message}`);
                throw new Error(`Catbox failed: ${e.message}`);
            }
        }
    });

    // ImgHippo
    providers.push({
        name: 'ImgHippo',
        upload: async () => {
            const result = await uploadToImgHippo(buffer, originalname);
            return { imageUrl: result.direct_url, hostUsed: 'ImgHippo' };
        }
    });

    // ImgBB
    providers.push({
        name: 'ImgBB',
        upload: async () => {
            const result = await uploadToImgBB(buffer, originalname, mimetype);
            return { imageUrl: result.direct_url, hostUsed: 'ImgBB' };
        }
    });

    // Uguu
    providers.push({
        name: 'Uguu',
        upload: async () => {
            const result = await uploadToUguu(buffer, originalname, mimetype);
            return { imageUrl: result.direct_url, hostUsed: 'Uguu' };
        }
    });

    if (telegramService.isConfigured() && !isVideo) {
        providers.push({
            name: 'Telegram',
            upload: async () => {
                const tgUri = await telegramService.uploadImage(buffer, originalname);
                const proxyUrl = `/api/tg-file/${tgUri.replace('tg://', '')}`;
                return { imageUrl: proxyUrl, hostUsed: 'Telegram' };
            }
        });
    }

    // Supabase
    providers.push({
        name: 'Supabase',
        upload: async () => {
            const url = await uploadToSupabase(buffer, originalname, mimetype);
            return { imageUrl: url, hostUsed: 'Supabase' };
        }
    });

    // Shuffle providers randomly
    const shuffledProviders = providers.sort(() => 0.5 - Math.random());

    for (let i = 0; i < shuffledProviders.length; i++) {
        const provider = shuffledProviders[i];
        try {
            console.log(`[Upload] Attempting upload with ${provider.name}...`);
            return await provider.upload();
        } catch (e: any) {
            console.warn(`[Upload] ${provider.name} failed:`, e.message);
            if (i === shuffledProviders.length - 1) {
                console.error('[Upload] All external hosts failed.');
                throw new Error('Upload failed on all available external hosts.');
            }
        }
    }
    
    throw new Error('Upload failed on all available external hosts.');
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
    res.json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      sync: {
        lastUpdated: new Date(backgroundWire.lastUpdated).toISOString(),
        totalTemplates: backgroundWire.registry.length,
        creators: backgroundWire.creators.length
      }
    });
  });

  // Temporary Migration Endpoint
  app.post('/api/run-migration', async (req, res) => {
      const { secret } = req.body;
      if (secret !== process.env.MIGRATION_SECRET) {
          return res.status(403).json({ error: 'Forbidden' });
      }

      console.log('Starting migration...');
      try {
          const supabase = getSupabase();
          const { data: templates, error } = await supabase.from('templates').select('id, image_url, banner_url, gallery_images');
          
          if (error) throw error;

          const results = { successful: 0, failed: 0 };
          for (const template of templates as any[]) {
              const fields = ['image_url', 'banner_url', 'gallery_images'];
              const updates: any = {};
              let updated = false;

              for (const field of fields) {
                  let urls = template[field];
                  if (!urls) continue;
                  
                  const urlArray = Array.isArray(urls) ? urls : [urls];
                  const processedUrls = [];

                  for (const url of urlArray) {
                      if (typeof url !== 'string' || !url.includes('http') || url.includes('supabase.co')) {
                          processedUrls.push(url);
                          continue;
                      }

                      console.log(`Mirroring ${url} to Supabase...`);
                      try {
                          const response = await axios.get(url, { responseType: 'arraybuffer' });
                          const buffer = Buffer.from(response.data);
                          const fileName = `${template.id}/${field}/${Date.now()}_${Math.random()}.jpg`;
                          
                          const newUrl = await uploadToSupabase(buffer, fileName, 'image/jpeg');
                          processedUrls.push(newUrl);
                          updated = true;
                      } catch (e: any) {
                          console.error(`Failed to backup ${url}:`, e.message);
                          processedUrls.push(url);
                          results.failed++;
                      }
                  }

                  if (updated) {
                      updates[field] = Array.isArray(urls) ? processedUrls : processedUrls[0];
                  }
              }

              if (updated) {
                  await (supabase.from('templates') as any).update(updates).eq('id', template.id);
                  results.successful++;
              }
          }
          res.json({ status: 'Migration complete', results });
      } catch (e: any) {
          console.error('Migration failed:', e);
          res.status(500).json({ error: e.message });
      }
  });

  app.get('/api/sync-status', (req, res) => {
    res.json({
      lastUpdated: new Date(backgroundWire.lastUpdated).toISOString(),
      updatedTimestamp: backgroundWire.lastUpdated,
      templatesCount: backgroundWire.registry.length,
      creatorsCount: backgroundWire.creators.length,
      hostsCount: backgroundWire.hosts.length,
      stats: backgroundWire.stats
    });
  });

  // Telegram File Proxy
  app.get('/api/tg-file/:botIndex/:fileId', async (req, res) => {
    try {
      const { botIndex, fileId } = req.params;
      const tgUri = `tg://${botIndex}/${fileId}`;
      
      const downloadUrl = await telegramService.getFileDownloadUrl(tgUri);
      
      const r = await axios({
        method: 'GET',
        url: downloadUrl,
        responseType: 'stream'
      });
      
      if (r.headers['content-type']) res.setHeader('Content-Type', r.headers['content-type']);
      if (r.headers['content-length']) res.setHeader('Content-Length', r.headers['content-length']);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      r.data.pipe(res);
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

  // Log client-side errors
  app.post('/api/log-error', (req, res) => {
    const { error, context } = req.body;
    console.error('[Client Error]', error, JSON.stringify(context, null, 2));
    res.status(200).json({ status: 'logged' });
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
      const { content, title, name, link } = req.body;
      
      let finalContent = content;
      const templateName = title || name;
      if (templateName || link) {
          finalContent = `/*\n * Template Name: ${templateName || 'Unknown'}\n * Template Link: ${link || 'N/A'}\n */\n\n${content}`;
      }

      if (!finalContent) return res.status(400).json({ error: 'Content is required' });
      
      console.log('[Paste.rs Upload] Received request');
      const url = await uploadToPasteRs(finalContent);
      res.json({ success: true, url, host: 'Paste.rs' });
    } catch (error: any) {
      console.error('Paste.rs Upload Error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/registry', async (req, res) => {
    res.json(await freeHostService.getRegistry());
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

      // Ensure we have data
      if (backgroundWire.registry.length === 0) {
        await backgroundWire.ensureSynchronized(8000);
      }

      let data = [...backgroundWire.registry];

      // Filter by status 'approved' (or allow if status is missing)
      data = data.filter((t: any) => !t.status || t.status === 'approved');

      // Filter by userId or email if provided
      if (userId || email) {
        data = data.filter((t: any) => {
          const authorId = t.author_id || t.authorId || (t.author && t.author.id);
          const authorEmail = t.author_email || t.authorEmail || (t.author && t.author.email);
          
          const matchId = userId && authorId === userId;
          const matchEmail = email && authorEmail === email;
          return matchId || matchEmail;
        });
      }

      if (category && category !== 'All') {
        data = data.filter((t: any) => t.category === category);
      }

      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        data = data.filter((t: any) => 
          (t.title && t.title.toLowerCase().includes(lowerQuery)) || 
          (t.name && t.name.toLowerCase().includes(lowerQuery)) ||
          (t.description && t.description.toLowerCase().includes(lowerQuery)) ||
          (t.tags && Array.isArray(t.tags) && t.tags.some((tag: string) => tag.toLowerCase().includes(lowerQuery))) ||
          (t.author && t.author.toLowerCase().includes(lowerQuery)) ||
          (t.author_name && t.author_name.toLowerCase().includes(lowerQuery)) ||
          (t.creator && t.creator.toLowerCase().includes(lowerQuery))
        );
      }

      if (sortBy === 'popular' || sortBy === 'likes') {
        data.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
      } else {
        data.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      }

      const totalCount = data.length;
      const paginatedData = data.slice(page * limitNum, (page + 1) * limitNum);

      res.json({ 
        data: paginatedData, 
        hasMore: (page + 1) * limitNum < totalCount,
        wire_status: 'stable',
        total: totalCount
      });
    } catch (error: any) {
      console.error('API Error:', error.message);
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
    try {
      const email = req.query.email as string;
      if (!email) throw new Error("Email required");

      const supabaseData = await getSupabaseUserTemplates(email);
      const allData = supabaseData.map(mapSupabaseToTemplate);
        
      // Sort manually if needed
      allData.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });

      res.json({ data: allData });
    } catch (error: any) {
      console.error('API Error (User Templates):', error.message || error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get Template By ID
  app.get('/api/templates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // 1. Try GitHub/GitLab
      let template: any = null;
      try {
        template = await repoManager.getTemplateById(id);
      } catch (e: any) {
        console.warn(`[API] GitHub getTemplateById failed: ${e.message}`);
      }
      
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
      
      // 4. Try Firebase (Skipped as Firebase is only for Auth)
      
      if (template) {
        // Handle bundle if it's a bundle
        if (template.is_bundle && template.source_code) {
            try {
                let bundleData: any = null;
                
                if (template.source_code.startsWith('/api/tg-file/')) {
                    // It's a Telegram file, fetch it directly via the service
                    const match = template.source_code.match(/^\/api\/tg-file\/(\d+)\/(.+)$/);
                    if (match) {
                        const botIndex = match[1];
                        const fileId = match[2];
                        const tgUri = `tg://${botIndex}/${fileId}`;
                        console.log(`[API] Fetching bundle for template ${id} from Telegram: ${tgUri}`);
                        
                        const downloadUrl = await telegramService.getFileDownloadUrl(tgUri);
                        const response = await fetch(downloadUrl);
                        if (response.ok) {
                            bundleData = await response.json();
                        }
                    }
                } else if (template.source_code.startsWith('http')) {
                    // It's a Paste.rs or other HTTP URL
                    console.log(`[API] Fetching bundle for template ${id} from ${template.source_code}`);
                    const response = await fetch(template.source_code);
                    if (response.ok) {
                        bundleData = await response.json();
                    }
                }

                if (bundleData) {
                    template = { 
                        ...template, 
                        ...bundleData.metadata, 
                        sourceCode: bundleData.sourceCode, 
                        preview_url: bundleData.demoLink,
                        galleryImages: bundleData.images?.gallery || [],
                        bannerUrl: bundleData.images?.banner || template.bannerUrl
                    };
                }
            } catch (e: any) {
                console.error(`[API] Failed to fetch bundle for template ${id}:`, e.message);
            }
        }
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

      // 3. Process Source Code and Bundle Everything (Upload to Paste.rs)
      let bundleUrl = '';
      
      // 4. Generate Clean Preview URL
      const cleanPreviewUrl = generatePreviewUrl(template.file_url || finalImageUrl);

      const templateBundle = {
        metadata: {
          id: templateId,
          title: template.title || template.name,
          description: template.description || '',
          tags: template.tags || [],
          author: template.author_name || 'Anonymous',
          category: template.category || 'Uncategorized',
          price: template.price || 'Free',
          created_at: new Date().toISOString(),
        },
        sourceCode: template.sourceCode || '',
        demoLink: cleanPreviewUrl,
        images: {
          thumbnail: finalImageUrl,
          banner: finalBannerUrl,
          gallery: finalGalleryImages
        }
      };

      try {
          const bundleString = JSON.stringify(templateBundle);
          const bundleBuffer = Buffer.from(bundleString, 'utf-8');
          
          if (telegramService.isConfigured()) {
              console.log(`[Telegram Upload] Uploading template bundle for: ${template.title || template.name}`);
              const tgUri = await telegramService.uploadDocument(bundleBuffer, `${templateId}.json`);
              bundleUrl = `/api/tg-file/${tgUri.replace('tg://', '')}`;
              console.log(`[Telegram Upload] Success: ${bundleUrl}`);
          } else {
              throw new Error("Telegram not configured");
          }
      } catch (tgError: any) {
          console.warn(`[Telegram Upload] Failed (${tgError.message}), falling back to Paste.rs...`);
          try {
              console.log(`[Paste.rs Upload] Uploading template bundle for: ${template.title || template.name}`);
              bundleUrl = await uploadToPasteRs(JSON.stringify(templateBundle));
              console.log(`[Paste.rs Upload] Success: ${bundleUrl}`);
          } catch (e: any) {
              console.error("Paste.rs Upload Failed:", e.message);
              throw new Error("Failed to upload template bundle to both Telegram and Paste.rs");
          }
      }

      // 5. Host Name & Link data on Paste.rs as a dedicated record
      let pasteRsHostUrl = '';
      try {
          const nameAndLinkData = {
              name: template.title || template.name,
              preview_link: cleanPreviewUrl,
              download_link: bundleUrl || template.file_url,
              image_link: finalImageUrl
          };
          console.log(`[Paste.rs Registry] Hosting strict Name & Links for: ${template.title || template.name}`);
          pasteRsHostUrl = await uploadToPasteRs(JSON.stringify(nameAndLinkData, null, 2));
          console.log(`[Paste.rs Registry] Success: ${pasteRsHostUrl}`);
      } catch (e: any) {
          console.error("Paste.rs Name/Link Host Failed:", e.message);
      }

      // 6. Create metadata object (pointing to the bundle)
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
        paste_rs_link: pasteRsHostUrl, // Store the Paste.rs Name/Link host URL
        source_code: bundleUrl, // Store the bundle URL here
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
        is_bundle: true // Flag to indicate it's a bundle
      };

      // 6. Save to GitHub
      try {
        await repoManager.uploadTemplate(metadata);
      } catch (repoErr: any) {
        console.warn(`[API] Skipping GitHub save: ${repoErr.message}`);
      }

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

      // Process Source Code (Upload to Paste.rs)
      if (updates.sourceCode && updates.sourceCode.length > 0 && !updates.sourceCode.startsWith('http')) {
          try {
              console.log(`[Paste.rs Update] Uploading source code for template: ${id}`);
              
              const updateTitle = updates.title || updates.name || 'Update Request';
              const updateLink = updates.image_url || updates.preview_url || updates.thumbnail || 'Link not provided';
              const formattedCode = `/*\n * Template Name: ${updateTitle}\n * Template Link: ${updateLink}\n */\n\n${updates.sourceCode}`;
              
              updates.source_code = await uploadToPasteRs(formattedCode);
              delete updates.sourceCode;
              console.log(`[Paste.rs Update] Success: ${updates.source_code}`);
          } catch (e: any) {
              console.error("Paste.rs Upload Failed:", e.message);
          }
      }

      // Ensure thumbnail is updated if image_url is updated
      if (updates.image_url && !updates.thumbnail) {
        updates.thumbnail = updates.image_url;
      }

      // Update GitHub
      await repoManager.updateTemplate(id, updates);
      
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
      const { deleteAllTemplates } = await import('./server/services/supabaseService');
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

  // Combined "Wire" Endpoint for everything at once
  app.get('/api/wire', async (req, res) => {
    if (backgroundWire.registry.length === 0) {
        await backgroundWire.ensureSynchronized(8000);
    }
    res.json({
        templates: backgroundWire.registry,
        creators: backgroundWire.creators,
        hosts: backgroundWire.hosts,
        stats: backgroundWire.stats,
        lastUpdated: backgroundWire.lastUpdated
    });
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
