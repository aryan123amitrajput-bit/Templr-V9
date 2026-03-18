import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { getSupabase, uploadPreviewImage } from '../server/services/supabaseService';
import { Octokit } from 'octokit';
import path from 'path';
import { fileURLToPath } from 'url';
import { repoManager } from '../server/services/repoService';
import { freeHostService } from '../server/services/freeHostService';
import { traffService } from '../server/services/traffService';
import { templrAuditor } from '../server/services/templrAuditor';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import crypto from 'crypto';
import multer from 'multer';

const upload = multer({ storage: multer.memoryStorage() });

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
  if (updates.image_url || updates.image_preview) metadataUpdates.thumbnail = updates.image_url || updates.image_preview;
  if (updates.category) metadataUpdates.category = updates.category;
  if (updates.tags) metadataUpdates.tags = updates.tags;
  
  await repoManager.updateTemplate(templateId, metadataUpdates);
}

async function saveTemplateToGitHub(template: any) {
  const metadata = {
    id: template.id,
    title: template.name || template.title,
    author: template.creator || template.author_name,
    thumbnail: template.image_preview || template.image_url,
    category: template.category,
    created_at: template.created_at,
    tags: template.tags || [],
    ...template
  };
  return await repoManager.uploadTemplate(metadata);
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
        } catch (e) {
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

// Facebook Image Hosting Proxy
app.get('/api/fb-image', async (req, res) => {
  const url = req.query.url as string;
  if (!url) {
    return res.status(400).json({ error: 'URL parameter is required' });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image from Facebook CDN: ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Type', contentType);
    
    res.send(Buffer.from(buffer));
  } catch (error: any) {
    console.error('[FB Proxy] Error fetching image:', error.message);
    res.status(500).json({ error: `Proxy failed: ${error.message}` });
  }
});

app.post('/api/fb-upload', upload.single('file'), async (req, res) => {
  console.log(`[FB Upload Request] Received POST /api/fb-upload`);
  try {
    const file = req.file;
    if (!file) {
      console.warn(`[FB Upload Request] No file provided`);
      return res.status(400).json({ error: "file is required" });
    }
    console.log(`[FB Upload Request] File: ${file.originalname}, Size: ${file.size}`);

    const pageIdEnv = process.env.FB_PAGE_ID;
    const accessTokenEnv = process.env.FB_ACCESS_TOKEN || 'EAANkafEnFlUBQ1rKMcKFn8xZCLwFML1nSnmkuTtGwp5sCrvmcyRg6CfB7v8L4mFrBMX6KYciZCIDzrZAJSHEUSOZCVSaFd18l4f5lbo3ZAJrBu9JlsZAyv77A0CLvB6pDyEcZC8kbkWwROBS0LONb8MeINbhnOP0rnmsZAZAZBSHVkLwPgl5uO78xb8DCzxgZCZCNWBIPY8bIHfyQega6vwIzXZAqG6seZCSACMB31EJgGZBgZDZD';

    console.log(`[FB Upload] Starting Facebook upload process...`);
    
    // Step 1: Discover the "Proper" Page ID and Page Token
    let targetPageId = pageIdEnv || 'me';
    let targetAccessToken = accessTokenEnv;

    try {
      console.log(`[FB Upload] Attempting to discover pages for the provided token...`);
      const accountsResponse = await fetch(`https://graph.facebook.com/v19.0/me/accounts?access_token=${accessTokenEnv}`, { signal: AbortSignal.timeout(5000) });
      const accountsData = await accountsResponse.json() as any;

      if (accountsData.data && accountsData.data.length > 0) {
        // Use the first page found
        const firstPage = accountsData.data[0];
        targetPageId = firstPage.id;
        targetAccessToken = firstPage.access_token;
        console.log(`[FB Upload] Discovered Page: ${firstPage.name} (${targetPageId})`);
      } else {
        console.log(`[FB Upload] No pages found for this token. Checking if token is already a Page Token...`);
        const debugResponse = await fetch(`https://graph.facebook.com/v19.0/debug_token?input_token=${accessTokenEnv}&access_token=${accessTokenEnv}`, { signal: AbortSignal.timeout(5000) });
        const debugData = await debugResponse.json() as any;
        if (debugData.data?.type === 'PAGE') {
            console.log(`[FB Upload] Token is already a Page Token for ID: ${debugData.data.profile_id}`);
            targetPageId = debugData.data.profile_id;
        }
      }
    } catch (discoveryError) {
      console.warn(`[FB Upload] Page discovery failed, falling back to original credentials:`, discoveryError);
    }

    const formData = new FormData();
    formData.append('source', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
    formData.append('published', 'false'); // Don't publish to timeline, just host
    formData.append('access_token', targetAccessToken);

    let uploadResponse;
    let retries = 2;
    
    while (retries >= 0) {
      // Try different endpoints/parameters for Facebook
      const endpoints = [
        { url: `https://graph.facebook.com/v19.0/${targetPageId}/photos`, params: { temporary: 'true' } },
        { url: `https://graph.facebook.com/v19.0/${targetPageId}/photos`, params: { published: 'false' } },
        { url: `https://graph.facebook.com/v19.0/me/photos`, params: { temporary: 'true' } },
        { url: `https://graph.facebook.com/v19.0/me/photos`, params: { published: 'false' } }
      ];

      for (const endpoint of endpoints) {
        try {
            const fbFormData = new FormData();
            fbFormData.append('source', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
            fbFormData.append('access_token', targetAccessToken);
            Object.entries(endpoint.params).forEach(([key, val]) => fbFormData.append(key, val));

            console.log(`[FB Upload] Trying endpoint: ${endpoint.url} with params: ${JSON.stringify(endpoint.params)}`);
            uploadResponse = await fetch(endpoint.url, {
              method: 'POST',
              body: fbFormData,
              signal: AbortSignal.timeout(15000)
            });

            if (uploadResponse.ok) {
                console.log(`[FB Upload] Success with endpoint: ${endpoint.url}`);
                break;
            } else {
                const errData = await uploadResponse.json().catch(() => null);
                console.warn(`[FB Upload] Endpoint ${endpoint.url} failed:`, errData?.error?.message || uploadResponse.statusText);
                
                // If it's a deprecation error, skip this endpoint and try next
                if (errData?.error?.code === 200 || errData?.error?.message?.includes('deprecated')) {
                    continue;
                }
            }
        } catch (e) {
            console.warn(`[FB Upload] Fetch error for ${endpoint.url}:`, e);
        }
      }
      
      if (uploadResponse?.ok) break;
      
      if (retries === 0) {
        throw new Error(`Facebook upload failed after all attempts. This is likely due to deprecated permissions (publish_actions) or invalid token. Please use a different hosting provider.`);
      }
      
      retries--;
      await new Promise(r => setTimeout(r, 1000)); // Wait 1s before retry
    }

    const uploadData = await uploadResponse!.json();
    const photoId = uploadData.id;

    if (!photoId) {
      throw new Error('Failed to get photo ID from Facebook');
    }

    console.log(`[FB Upload] Photo uploaded. ID: ${photoId}. Fetching CDN URL...`);

    const photoResponse = await fetch(`https://graph.facebook.com/v19.0/${photoId}?fields=images&access_token=${targetAccessToken}`);
    if (!photoResponse.ok) {
      const errData = await photoResponse.json().catch(() => null);
      throw new Error(`Failed to fetch photo details: ${errData?.error?.message || photoResponse.statusText}`);
    }

    const photoData = await photoResponse.json();
    const images = photoData.images;

    if (!images || images.length === 0) {
      throw new Error('No images returned from Facebook');
    }

    // Get highest resolution image (usually first in the array)
    const cdnUrl = images[0].source;
    
    console.log(`[FB Upload] Success! CDN URL: ${cdnUrl}`);

    res.json({ success: true, url: cdnUrl, host: 'Facebook CDN' });
  } catch (error: any) {
    console.error('[FB Upload] Error:', error);
    
    // Server-side fallback if Facebook is deprecated or fails
    if (error.message.includes('deprecated') || error.message.includes('permission')) {
      console.log('[FB Upload] Facebook is deprecated. Falling back to General uploader internally...');
      try {
        // We can't easily "call" the other route, but we can call a shared function or just duplicate the logic
        // For simplicity and reliability, let's use the Supabase fallback directly here as a last resort
        const file = req.file!;
        const imageUrl = await uploadPreviewImage(file.buffer, file.originalname, file.mimetype);
        return res.json({ 
          success: true, 
          url: imageUrl, 
          host: 'Supabase Storage (FB Fallback)',
          notice: 'Facebook hosting is deprecated, used Supabase instead.'
        });
      } catch (fallbackErr: any) {
        console.error('[FB Upload] Internal fallback also failed:', fallbackErr);
      }
    }
    
    res.status(500).json({ error: error.message || 'Internal Server Error during FB upload' });
  }
});

// Upload File Proxy (New Workflow: ImgLink API for images, Supabase for videos)
app.post('/api/upload', upload.single('file'), async (req, res) => {
  console.log(`[General Upload Request] Received POST /api/upload`);
  try {
    const file = req.file;
    const { title, description } = req.body;
    if (!file) {
      console.warn(`[General Upload Request] No file provided`);
      return res.status(400).json({ error: "file is required" });
    }
    console.log(`[General Upload Request] File: ${file.originalname}, Size: ${file.size}`);

    console.log(`[Upload] Processing file: ${file.originalname}, Mime: ${file.mimetype}`);

    const isVideo = file.mimetype.startsWith('video/');
    let imageUrl = '';
    let hostUsed = 'Supabase Storage';

    if (isVideo) {
        // 1. For videos, always use Supabase Storage
        console.log('[Upload] Video detected, using Supabase Storage');
        imageUrl = await uploadPreviewImage(file.buffer, file.originalname, file.mimetype);
        hostUsed = 'Supabase Storage';
    } else {
        // 2. For images, try ImgHippo
        const requestedHost = req.query.host as string;
        let hosts = [
            { 
                name: 'ImgHippo', 
                url: 'https://api.imghippo.com/v1/upload', 
                key: process.env.IMGHIPPO_API_KEY || '0bd1d234918f906d353775d006d2b771',
                paramName: 'file'
            },
            {
                name: 'ImgBB',
                url: 'https://api.imgbb.com/1/upload',
                key: process.env.IMGBB_API_KEY || '3b9d0d0e0e0e0e0e0e0e0e0e0e0e0e0e', // Placeholder, will use env if set
                paramName: 'image'
            },
            {
                name: 'iimg.live',
                url: 'https://iimg.live/api/v1/upload',
                key: process.env.IIMG_LIVE_API_KEY || 'pk_7b0d0efe2149cace9421be28c007011d',
                paramName: 'file'
            }
        ];

        // If a specific host is requested, ONLY try that host
        if (requestedHost) {
            const host = hosts.find(h => h.name.toLowerCase() === requestedHost.toLowerCase());
            if (host) {
                hosts = [host];
            }
        }

        for (const host of hosts) {
            if (!host.key) {
                console.warn(`[Upload] Skipping ${host.name} because API key is not set.`);
                continue;
            }

            console.log(`[Upload] Attempting upload to ${host.name}...`);
            const maxRetries = 2;
            let lastError;

            for (let i = 0; i < maxRetries; i++) {
                try {
                    const formData = new FormData();
                    formData.append(host.paramName, new Blob([file.buffer], { type: file.mimetype }), file.originalname);
                    
                    // ImgHippo specifically uses 'api_key'
                    if (host.name === 'ImgHippo') {
                        formData.append('api_key', host.key!);
                    } else {
                        formData.append('key', host.key!);
                    }

                    const response = await fetch(host.url, { 
                        method: 'POST', 
                        body: formData
                    });
                    
                    if (response.ok) {
                        let data;
                        const text = await response.text();
                        try {
                            data = JSON.parse(text);
                        } catch (e) {
                            console.warn(`[Upload] ${host.name} API returned non-JSON:`, text.substring(0, 100));
                            throw new Error(`Invalid response from ${host.name}`);
                        }
                        
                        // ImgHippo response structure: { success: true, data: { url: '...' } }
                        
                        if (host.name === 'ImgHippo' && data.success && data.data?.url) {
                            imageUrl = data.data.url;
                            hostUsed = 'ImgHippo';
                            break;
                        } else if (data.error) {
                            throw new Error(data.error.message || JSON.stringify(data.error));
                        }
                    } else {
                        const errorText = await response.text();
                        console.warn(`[Upload] ${host.name} API error (attempt ${i + 1}):`, response.status, errorText);
                        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 100)}`);
                    }
                } catch (e: any) {
                    lastError = e;
                    console.warn(`[Upload] ${host.name} attempt ${i + 1} failed: ${e.message}`);
                    if (i < maxRetries - 1) {
                        await new Promise(r => setTimeout(r, 1000 * (i + 1)));
                    }
                }
            }

            if (imageUrl) {
                console.log(`[Upload] Successfully uploaded to ${host.name}: ${imageUrl}`);
                break;
            }
        }

        // 3. Fallback to Supabase if all external hosts failed for images
        if (!imageUrl) {
            console.log('[Upload] All external hosts failed, falling back to Supabase Storage');
            try {
                imageUrl = await uploadPreviewImage(file.buffer, file.originalname, file.mimetype);
                hostUsed = 'Supabase Storage';
            } catch (fallbackError: any) {
                console.error('[Upload] Supabase fallback also failed:', fallbackError);
                throw new Error('All upload methods failed');
            }
        }
    }

    console.log('[Upload] Final URL extracted:', imageUrl);
    console.log('[Upload] Host used:', hostUsed);

    // 4. Save template metadata to Supabase if title is provided
    if (title) {
        const { data: dbData, error: dbError } = await supabase.from('templates').insert({
            title,
            description,
            image_url: imageUrl,
            created_at: new Date().toISOString()
        });

        if (dbError) throw new Error(`Database save failed: ${dbError.message}`);
    }

    res.json({ success: true, url: imageUrl, host: hostUsed });
  } catch (error: any) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error during upload' });
  }
});

// Get Public Templates
app.get('/api/templates', async (req, res) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  
  try {
    const page = parseInt(req.query.page as string) || 0;
    const limit = parseInt(req.query.limit as string) || 6;
    const category = req.query.category as string;
    const searchQuery = req.query.searchQuery as string;
    const sortBy = req.query.sortBy as string || 'newest';

    const [gitRegistry, { data: supabaseData }] = await Promise.all([
      repoManager.getMergedRegistry(),
      supabase.from('templates').select('*').order('created_at', { ascending: false })
    ]);

    clearTimeout(timeoutId);

    const mappedSupabase = (supabaseData || []).map((t: any) => ({ ...t, _source: 'supabase' }));
    
    const templatesMap = new Map();
    gitRegistry.forEach((t: any) => {
      if (!templatesMap.has(t.id)) {
        templatesMap.set(t.id, { ...t, _source: 'git' });
      }
    });
    mappedSupabase.forEach((t: any) => {
      if (!templatesMap.has(t.id)) {
        templatesMap.set(t.id, t);
      }
    });

    let registry = Array.from(templatesMap.values());

    const { data: deletedTemplates } = await supabase.from('deleted_templates').select('id');
    const deletedIds = new Set((deletedTemplates || []).map((t: any) => t.id));
    registry = registry.filter((t: any) => !deletedIds.has(t.id));

    if (category && category !== 'All') {
      registry = registry.filter((t: any) => t.category === category);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      registry = registry.filter((t: any) => t.title?.toLowerCase().includes(q));
    }
    
    if (sortBy === 'popular') {
      registry.sort((a: any, b: any) => (b.views || 0) - (a.views || 0));
    } else if (sortBy === 'likes') {
      registry.sort((a: any, b: any) => (b.likes || 0) - (a.likes || 0));
    } else {
      registry.sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    const start = page * limit;
    const gitSupabaseCount = registry.length;
    
    let paginatedData = [];
    if (start < gitSupabaseCount) {
      paginatedData = registry.slice(start, start + limit);
      if (paginatedData.length < limit) {
        const needed = limit - paginatedData.length;
        const extra = await freeHostService.getTemplates(0, needed, category, searchQuery);
        paginatedData.push(...extra);
      }
    } else {
      const freeHostOffset = start - gitSupabaseCount;
      const freeHostPage = Math.floor(freeHostOffset / limit);
      const freeHostLimit = limit;
      paginatedData = await freeHostService.getTemplates(freeHostPage, freeHostLimit, category, searchQuery);
    }

    const totalCount = gitSupabaseCount + freeHostService.getRegistry().totalTemplates;

    res.json({ 
      data: paginatedData, 
      hasMore: start + limit < totalCount 
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
    let finalImageUrl = template.image_url || template.imageUrl || '';
    let finalBannerUrl = template.banner_url || template.bannerUrl || finalImageUrl;
    let finalGalleryImages = template.gallery_images || [];

    const cleanPreviewUrl = generatePreviewUrl(template.file_url || finalImageUrl);
    const metadata = {
      id: templateId,
      name: template.title || template.name,
      description: template.description,
      preview_url: cleanPreviewUrl,
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
          image_url: finalImageUrl,
          banner_url: finalBannerUrl,
          gallery_images: finalGalleryImages,
          created_at: metadata.created_at
        };
        await supabase.from('templates').insert(supabasePayload);
      } catch (e) {}
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
