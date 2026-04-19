import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { createServer as createViteServer } from 'vite';
import { getSupabase, getTemplates as getSupabaseTemplates } from './services/supabaseService';
import { uploadToImgBB } from './services/imgbbService';
import { uploadToImgHippo } from './services/imghippoService';
import { uploadToGifyu } from './services/gifyuService';
import { uploadToCatbox } from './services/catboxService';
import { uploadToBeeIMG } from './services/beeimgService';
import { telegramService } from './services/telegramService';
import { Octokit } from '@octokit/rest';
import path from 'path';
import { fileURLToPath } from 'url';
import { repoManager } from './services/repoService';
import { uploadToPasteRs } from './services/pasteService';
import { freeHostService } from './services/freeHostService';
import { traffService } from './services/traffService';
import { templrAuditor } from './services/templrAuditor';
import admin from 'firebase-admin';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --- BACKGROUND CACHE WIRE ---
// Constantly caches standard template requests to return INSTANTLY on trigger
class CacheWire {
  public registry: any[] = [];
  public creators: any[] = [];
  public hosts: any[] = [];
  public stats: any = {};
  public lastUpdated = 0;
  private syncPromise: Promise<void> | null = null;
  
  constructor() {
    this.syncPromise = this.refresh();
    setInterval(() => this.refresh(), 30000); // Re-wire every 30 seconds
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
    console.log("[CacheWire] 🔌 Synchronizing All Services Wires...");
    try {
      // Small delay on Vercel to ensure env populates
      if (process.env.VERCEL) {
        await new Promise(r => setTimeout(r, 500));
      }
      
      const [gitRegistry, supabaseData, deletedTemplatesData, freeHostData, tgTemplates] = await Promise.all([
        repoManager.getMergedRegistry().catch((e) => {
          console.error('[CacheWire] Repo error:', e);
          return [];
        }),
        supabase 
          ? supabase.from('templates').select('*').order('created_at', { ascending: false }).then(res => res.data || []).catch(() => [])
          : Promise.resolve([]),
        supabase
          ? supabase.from('deleted_templates').select('id').then(res => res.data || []).catch(() => [])
          : Promise.resolve([]),
        freeHostService.getTemplates(0, 500).catch(() => []),
        telegramService.getTemplates().catch(() => [])
      ]);

      const mappedSupabase = (supabaseData || []).map((t: any) => ({ ...t, _source: 'supabase' }));
      const mappedFreeHost = (freeHostData || []).map((t: any) => ({ ...t, _source: 'freehost' }));
      const mappedTelegram = (tgTemplates || []).map((t: any) => ({ ...t, _source: 'telegram' }));
      
      const templatesMap = new Map();
      
      if (Array.isArray(gitRegistry)) {
        gitRegistry.forEach((t: any) => {
          if (t && t.id && !templatesMap.has(t.id)) templatesMap.set(t.id, { ...t, _source: 'git' });
        });
      }
      
      mappedFreeHost.forEach((t: any) => {
        if (t && t.id && !templatesMap.has(t.id)) templatesMap.set(t.id, t);
      });

      mappedTelegram.forEach((t: any) => {
        if (t && t.id && !templatesMap.has(t.id)) templatesMap.set(t.id, t);
      });
      
      mappedSupabase.forEach((t: any) => {
        if (t && t.id && !templatesMap.has(t.id)) templatesMap.set(t.id, t);
      });

      let freshRegistry = Array.from(templatesMap.values());
      const deletedIds = new Set((deletedTemplatesData || []).map((t: any) => t.id));
      freshRegistry = freshRegistry.filter((t: any) => !deletedIds.has(t.id));
      
      freshRegistry.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
      
      this.registry = freshRegistry;

      // Calculate Creators Wire
      const creatorsMap = new Map();
      this.registry.forEach((t: any) => {
        if (!t.author_email) return;
        if (!creatorsMap.has(t.author_email)) {
          creatorsMap.set(t.author_email, {
            email: t.author_email,
            name: t.author_name || 'Anonymous',
            avatar: t.author_avatar || '',
            templateCount: 0,
            likes: 0,
            views: 0
          });
        }
        const creator = creatorsMap.get(t.author_email);
        creator.templateCount++;
        creator.likes += (t.likes || 0);
        creator.views += (t.views || 0);
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
      console.log(`[CacheWire] ⚡ Full Sync Complete: ${this.registry.length} templates, ${this.creators.length} creators, ${this.hosts.length} hosts.`);
    } catch (error) {
      console.error('[CacheWire] Sync total failure:', error);
    }
  }
}

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
      select: () => ({ 
        order: () => ({
          then: (cb: any) => Promise.resolve(cb({ data: [], error: 'Supabase not configured' })),
          catch: (cb: any) => Promise.resolve(cb(new Error('Supabase not configured'))),
          data: [],
          error: 'Supabase not configured'
        }),
        eq: () => ({ single: () => ({ data: null, error: 'Supabase not configured' }) }), 
        data: [], 
        error: 'Supabase not configured' 
      }),
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

const backgroundWire = new CacheWire();

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


const mapSupabaseToTemplate = (t: any): any => ({
  id: t.id,
  title: t.title || t.name,
  description: t.description || '',
  author: t.author || t.author_name || t.creator || 'Anonymous',
  author_id: t.author_id || t.creator_id,
  author_email: t.author_email || t.creator_email,
  author_avatar: t.author_avatar || t.creator_avatar,
  authorAvatar: t.author_avatar || t.creator_avatar || '',
  imageUrl: t.image_url || t.thumbnail || t.thumbnail_url || t.image_preview || '',
  banner_url: t.banner_url,
  bannerUrl: t.banner_url || t.image_url || '',
  thumbnail: t.thumbnail || t.thumbnail_url || t.image_preview || '',
  preview_url: t.preview_url,
  file_url: t.file_url,
  fileUrl: t.file_url || '',
  likes: t.likes || t.stats?.likes || 0,
  views: t.views || t.stats?.views || 0,
  category: t.category || 'Uncategorized',
  tags: t.tags || [],
  price: t.price || 0,
  status: t.status || 'approved',
  created_at: t.created_at || t.updated_at,
  _source: t._source || 'supabase',
  galleryImages: t.gallery_images || [],
  videoUrl: t.video_url || ''
});

const app = express();
// Firebase Error Handler Helper

// Remove Public Templates old route (it is defined below using CacheWire)

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
app.get('/api/registry', async (req, res) => {
  res.json(await freeHostService.getRegistry());
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

// Paste.rs Upload Proxy (Backup Text Hosting)
app.post('/api/upload/pastesrs', async (req, res) => {
  try {
    const { content, title, name, link } = req.body;
    let finalContent = content;
    
    const templateName = title || name;
    if (templateName || link) {
        // Embed the template name and link securely without invalidating formatting
        finalContent = `/*\n * Template Name: ${templateName || 'Unknown'}\n * Template Link: ${link || 'N/A'}\n */\n\n${content}`;
    }

    if (!finalContent) return res.status(400).json({ error: 'Content is required' });
    const url = await uploadToPasteRs(finalContent);
    res.json({ success: true, url });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Upload File Proxy (New Workflow: External only)
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
            const apiKey = process.env.BEEIMG_API_KEY || '';
            const url = await uploadToBeeIMG(buffer, originalname, mimetype, apiKey);
            return { imageUrl: url, hostUsed: 'BeeIMG' };
        }
    });

    // Catbox (supports anonymous, valid userhash optional)
    providers.push({
        name: 'Catbox',
        upload: async () => {
            let userhash = process.env.CATBOX_USERHASH;
            if (userhash && userhash.length < 5) userhash = undefined; // Ignore dummy/empty values
            const result = await uploadToCatbox(buffer, originalname, mimetype, userhash);
            return { imageUrl: result.direct_url, hostUsed: 'Catbox' };
        }
    });

    // ImgHippo (requires API key)
    if (process.env.IMGHIPPO_API_KEY) {
        providers.push({
            name: 'ImgHippo',
            upload: async () => {
                const result = await uploadToImgHippo(buffer, originalname);
                return { imageUrl: result.direct_url, hostUsed: 'ImgHippo' };
            }
        });
    }

    // ImgBB
    providers.push({
        name: 'ImgBB',
        upload: async () => {
            const result = await uploadToImgBB(buffer, originalname, mimetype);
            return { imageUrl: result.direct_url, hostUsed: 'ImgBB' };
        }
    });

    // Gifyu (requires API key)
    if (process.env.GIFYU_API_KEY) {
        providers.push({
            name: 'Gifyu',
            upload: async () => {
                const result = await uploadToGifyu(buffer, originalname, mimetype);
                return { imageUrl: result.direct_url, hostUsed: 'Gifyu' };
            }
        });
    }

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

    // Shuffle ALL providers randomly (including Telegram)
    const shuffledProviders = providers.sort(() => 0.5 - Math.random());

    for (let i = 0; i < shuffledProviders.length; i++) {
        const provider = shuffledProviders[i];
        try {
            console.log(`[Upload] Attempting upload with random host ${provider.name}...`);
            return await provider.upload();
        } catch (e: any) {
            console.warn(`[Upload] ${provider.name} failed:`, e.message);
            if (i === shuffledProviders.length - 1) {
                console.error('[Upload] All external hosts failed.', e);
                throw new Error('Upload failed on all available external hosts.');
            }
        }
    }
    
    throw new Error('Upload failed on all available external hosts.');
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

    const { imageUrl, hostUsed } = await processFileUpload(file.buffer, file.originalname, file.mimetype);

    console.log('[Upload] Final URL extracted:', imageUrl);
    console.log('[Upload] Host used:', hostUsed);

    if (title) {
        console.log('[Upload] Saving to database...');
        const { data: dbData, error: dbError } = await supabase.from('templates').insert({
            title,
            description,
            image_url: imageUrl,
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
    console.log(`[URL Upload Request] Received POST /api/upload/url`);
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        console.log(`[URL Upload Request] Fetching from URL: ${url}`);
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        const mimetype = response.headers['content-type'] || 'image/jpeg';
        
        // Extract filename from URL or use a default
        const urlObj = new URL(url);
        let originalname = urlObj.pathname.split('/').pop() || 'image.jpg';
        if (!originalname.includes('.')) {
            const ext = mimetype.split('/')[1] || 'jpg';
            originalname = `${originalname}.${ext}`;
        }

        const { imageUrl, hostUsed } = await processFileUpload(buffer, originalname, mimetype);

        console.log('[URL Upload] Final URL extracted:', imageUrl);
        console.log('[URL Upload] Host used:', hostUsed);

        res.json({ success: true, url: imageUrl, host: hostUsed });
    } catch (error: any) {
        console.error('URL Upload Error:', error);
        res.status(500).json({ error: error.message || 'Internal Server Error during URL upload' });
    }
});

// Upload File Proxy (Catbox)
app.post('/api/upload/catbox', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file provided' });

    console.log(`[Catbox Upload] Received POST /api/upload/catbox`);
    const userhash = process.env.CATBOX_USERHASH || '';
    const result = await uploadToCatbox(file.buffer, file.originalname, file.mimetype, userhash);
    
    res.json({
      url: result.direct_url,
      direct_url: result.direct_url,
      thumbnail_url: result.thumbnail_url,
      viewer_url: result.viewer_url,
      provider: 'catbox'
    });
  } catch (error: any) {
    console.error('Catbox proxy error:', error);
    res.status(500).json({ error: error.message || 'Catbox proxy failed' });
  }
});

// Catbox URL Upload Proxy
app.post('/api/catbox/urlupload', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });
    
    const userhash = process.env.CATBOX_USERHASH || '';
    const { urlUploadToCatbox } = await import('./services/catboxService');
    const result = await urlUploadToCatbox(url, userhash);
    res.json(result);
  } catch (error: any) {
    console.error('Catbox urlupload error:', error);
    res.status(500).json({ error: error.message || 'Catbox urlupload failed' });
  }
});

// Catbox Delete Files Proxy
app.post('/api/catbox/deletefiles', async (req, res) => {
  try {
    const { files } = req.body;
    if (!files || !Array.isArray(files)) return res.status(400).json({ error: 'files array is required' });
    
    const userhash = process.env.CATBOX_USERHASH;
    if (!userhash) return res.status(400).json({ error: 'CATBOX_USERHASH is not configured on the server' });
    
    const { deleteFromCatbox } = await import('./services/catboxService');
    const result = await deleteFromCatbox(files, userhash);
    res.json({ success: true, result });
  } catch (error: any) {
    console.error('Catbox deletefiles error:', error);
    res.status(500).json({ error: error.message || 'Catbox deletefiles failed' });
  }
});

// Catbox Album Operations
app.post('/api/catbox/album/:action', async (req, res) => {
  try {
    const { action } = req.params;
    const { title, desc, files, short } = req.body;
    const userhash = process.env.CATBOX_USERHASH || '';
    
    const { 
      createCatboxAlbum, 
      editCatboxAlbum, 
      addToCatboxAlbum, 
      removeFromCatboxAlbum, 
      deleteCatboxAlbum 
    } = await import('./services/catboxService');

    let result;
    switch (action) {
      case 'create':
        result = await createCatboxAlbum(title || '', desc || '', files || [], userhash);
        break;
      case 'edit':
        if (!userhash) return res.status(400).json({ error: 'CATBOX_USERHASH is required for this action' });
        result = await editCatboxAlbum(short, title || '', desc || '', files || [], userhash);
        break;
      case 'add':
        if (!userhash) return res.status(400).json({ error: 'CATBOX_USERHASH is required for this action' });
        result = await addToCatboxAlbum(short, files || [], userhash);
        break;
      case 'remove':
        if (!userhash) return res.status(400).json({ error: 'CATBOX_USERHASH is required for this action' });
        result = await removeFromCatboxAlbum(short, files || [], userhash);
        break;
      case 'delete':
        if (!userhash) return res.status(400).json({ error: 'CATBOX_USERHASH is required for this action' });
        result = await deleteCatboxAlbum(short, userhash);
        break;
      default:
        return res.status(400).json({ error: 'Invalid album action' });
    }
    
    res.json({ success: true, result });
  } catch (error: any) {
    console.error(`Catbox album action error:`, error);
    res.status(500).json({ error: error.message || 'Catbox album action failed' });
  }
});

// Upload File Proxy (GitHub Fallback)
app.post('/api/upload/gifyu', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    console.log(`[Gifyu Upload] Received POST /api/upload/gifyu`);
    const result = await uploadToGifyu(file.buffer, file.originalname, file.mimetype);
    
    res.json({
      url: result.direct_url,
      direct_url: result.direct_url,
      thumbnail_url: result.thumbnail_url,
      viewer_url: result.viewer_url,
      host: 'Gifyu'
    });
  } catch (error: any) {
    console.error('[Gifyu Upload Error]:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during Gifyu upload' });
  }
});

app.post('/api/upload/imgbb', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
}, async (req, res) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    console.log(`[ImgBB Upload] Received POST /api/upload/imgbb`);
    const result = await uploadToImgBB(file.buffer, file.originalname, file.mimetype);
    
    res.json({
      url: result.direct_url,
      direct_url: result.direct_url,
      thumbnail_url: result.thumbnail_url,
      viewer_url: result.viewer_url,
      host: 'ImgBB'
    });
  } catch (error: any) {
    console.error('[ImgBB Upload Error]:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during ImgBB upload' });
  }
});

app.post('/api/upload/github', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      console.error('[GitHub Upload] Multer error:', err);
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  console.log(`[GitHub Upload] Received POST /api/upload/github`);
  try {
    const file = req.file;
    if (!file) {
      console.warn(`[GitHub Upload] No file provided`);
      return res.status(400).json({ error: "file is required" });
    }
    
    // Generate a unique filename
    const filename = `${Date.now()}-${file.originalname}`;
    const path = `assets/${filename}`;
    
    console.log(`[GitHub Upload] Uploading ${file.originalname} to ${path}...`);
    
    const imageUrl = await repoManager.uploadAsset(file.buffer, path, file.mimetype);
    
    console.log('[GitHub Upload] Final URL extracted:', imageUrl);
    
    res.json({ success: true, url: imageUrl });
  } catch (error: any) {
    console.error('GitHub Upload Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during GitHub upload' });
  }
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
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limitNum = parseInt(req.query.limit as string) || 6;
    const category = req.query.category as string;
    const searchQuery = req.query.searchQuery as string;
    const sortBy = req.query.sortBy as string || 'newest';
    const userId = req.query.userId as string;
    const email = req.query.email as string;

    // FORCE SYNC WAIT for Vercel Cold Starts
    if (backgroundWire.registry.length === 0) {
      console.log("[API] Wire Cache is cold, waiting for synchronization...");
      await backgroundWire.ensureSynchronized(8000); 
    }

    // Intercept with Live Cache Wire immediately
    let registry = [...backgroundWire.registry];

    // Fallback if cache is STILL empty/cold after wait
    if (registry.length === 0) {
      console.log("[API] Cache still cold after wait, performing direct fetch...");
      const [gitRegistry, supabaseData, freeTemplates, tgTemplates] = await Promise.all([
        repoManager.getMergedRegistry().catch(() => []),
        supabase ? supabase.from('templates').select('*').then(res => res.data).catch(() => []) : Promise.resolve([]),
        freeHostService.getTemplates(0, 500).catch(() => []),
        telegramService.getTemplates().catch(() => [])
      ]);

      const templatesMap = new Map();
      [...(gitRegistry || []), ...(supabaseData || []), ...(freeTemplates || []), ...(tgTemplates || [])].forEach((t: any) => {
        if (t && t.id && !templatesMap.has(t.id)) templatesMap.set(t.id, t);
      });
      registry = Array.from(templatesMap.values());
    }
    
    clearTimeout(timeoutId);

    // Comprehensive Filtering
    if (userId || email) {
      registry = registry.filter((t: any) => {
        const matchId = userId && (t.author_id === userId || (t.id && t.id.includes(userId)));
        const matchEmail = email && (t.author_email === email || t.creator_email === email);
        return matchId || matchEmail;
      });
    }

    if (category && category !== 'All') {
      registry = registry.filter((t: any) => t.category === category);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      registry = registry.filter((t: any) => 
        (t.title && t.title.toLowerCase().includes(q)) || 
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
      );
    }
    
    // Sort
    if (sortBy === 'popular' || sortBy === 'likes') {
      registry.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
    } else {
      registry.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    const hasMore = registry.length > (page + 1) * limitNum;
    const paginatedData = registry.slice(page * limitNum, (page + 1) * limitNum);
    
    res.json({
      data: paginatedData,
      hasMore,
      wire_status: 'stable',
      sync_origin: 'CacheWire'
    });
  } catch (error: any) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    clearTimeout(timeoutId);
  }
});

// Get Featured Creators
app.get('/api/creators', async (req, res) => {
  try {
    let registry = await repoManager.getMergedRegistry();

    const creatorsMap = new Map();
    registry.forEach((t: any) => {
      if (!t.author_email) return;
      if (!creatorsMap.has(t.author_email)) {
        creatorsMap.set(t.author_email, {
          author_name: t.author,
          author_email: t.author_email,
          author_avatar: t.author_avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(t.author)}&background=random`,
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

    const [gitRegistry, { data: supabaseData }, { data: deletedTemplates }] = await Promise.all([
      repoManager.getMergedRegistry(),
      supabase.from('templates').select('*').eq('author_email', email),
      supabase.from('deleted_templates').select('id')
    ]);
    
    const deletedIds = new Set((deletedTemplates || []).map((t: any) => t.id));
    const filteredGit = gitRegistry.filter((t: any) => !deletedIds.has(t.id));

    const userGitTemplates = filteredGit.filter((t: any) => 
      t.author_email === email || t.creator_email === email || t.email === email
    );

    const mappedSupabase = (supabaseData || []).map((t: any) => ({ ...t, _source: 'supabase' }));
    
    const templatesMap = new Map();
    userGitTemplates.forEach((t: any) => {
      if (!templatesMap.has(t.id)) {
        templatesMap.set(t.id, { ...t, _source: 'git' });
      }
    });
    mappedSupabase.forEach((t: any) => {
      if (!templatesMap.has(t.id)) {
        templatesMap.set(t.id, t);
      }
    });

    const allData = Array.from(templatesMap.values()).sort((a: any, b: any) => {
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
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
    let content = await repoManager.getTemplateById(id);
    if (!content) {
      content = await freeHostService.getTemplateById(id);
    }

    if (content) {
      res.json({ data: content });
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
          template_url: template.template_url || '',
          banner_url: finalBannerUrl,
          gallery_images: finalGalleryImages,
          created_at: metadata.created_at
        };
        // Remove old fields if they exist in the spread
        delete supabasePayload.image_url;
        delete supabasePayload.image_preview;
        delete supabasePayload.source_code;
        delete supabasePayload.imageUrl;
        delete supabasePayload.sourceCode;
        
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

// Telegram File Proxy Wire
app.get('/api/tg-file/:botIndex/:fileId', async (req, res) => {
    try {
      const { botIndex, fileId } = req.params;
      const tgUri = `tg://${botIndex}/${fileId}`;
      
      const downloadUrl = await telegramService.getFileDownloadUrl(tgUri);
      
      const response = await fetch(downloadUrl);
      if (!response.ok) throw new Error(`Telegram responds with ${response.status}`);
      
      const contentType = response.headers.get('content-type');
      const contentLength = response.headers.get('content-length');
      
      if (contentType) res.setHeader('Content-Type', contentType);
      if (contentLength) res.setHeader('Content-Length', contentLength);
      
      res.setHeader('Cache-Control', 'public, max-age=86400');
      
      if (response.body) {
        const readable = (response.body as any);
        if (readable.pipe) {
            readable.pipe(res);
        } else {
            const reader = readable.getReader();
            const pump = async () => {
                const { done, value } = await reader.read();
                if (done) {
                    res.end();
                    return;
                }
                res.write(value);
                await pump();
            };
            await pump();
        }
      } else {
        res.status(404).end();
      }
    } catch (error: any) {
      console.error('[API] Telegram proxy error:', error);
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
