import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer as createViteServer } from 'vite';
import { getSupabase } from '../server/services/supabaseService';
import { Octokit } from 'octokit';
import path from 'path';
import { fileURLToPath } from 'url';
import { repoManager } from '../server/services/repoService';
import { freeHostService } from '../server/services/freeHostService';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';
import crypto from 'crypto';

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

// Request Logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Registry Endpoint for dynamic template loading
app.get('/api/registry', (req, res) => {
  res.json(freeHostService.getRegistry());
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

// Upload File Proxy
app.post('/api/upload', async (req, res) => {
  try {
    const { file, path } = req.body;
    if (!file || !path) throw new Error("File and path are required");

    const matches = file.match(/^data:([A-Za-z-+\/]*);base64,(.+)$/);
    let buffer;
    let contentType = 'application/octet-stream';

    if (matches && matches.length === 3) {
      contentType = matches[1] || 'application/octet-stream';
      buffer = Buffer.from(matches[2], 'base64');
    } else {
      buffer = Buffer.from(file.split(',')[1] || file, 'base64');
    }

    if (contentType === 'application/octet-stream' || !contentType) {
        const ext = path.split('.').pop()?.toLowerCase();
        if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
        else if (ext === 'png') contentType = 'image/png';
        else if (ext === 'gif') contentType = 'image/gif';
        else if (ext === 'webp') contentType = 'image/webp';
        else if (ext === 'svg') contentType = 'image/svg+xml';
        else if (ext === 'mp4') contentType = 'video/mp4';
        else if (ext === 'webm') contentType = 'video/webm';
    }

    const { data, error } = await supabase.storage
      .from('assets')
      .upload(path, buffer, {
        contentType: contentType,
        upsert: true
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage.from('assets').getPublicUrl(path);
    res.json({ url: publicUrlData.publicUrl });
  } catch (error: any) {
    console.error('Upload Proxy Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Public Templates
app.get('/api/templates', async (req, res) => {
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

// Helper: Upload image URL to ImgBB
async function uploadToImgBB(imageUrl: string): Promise<string> {
  if (!imageUrl || !imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.includes('i.ibb.co') || imageUrl.includes('imgbb.com')) return imageUrl;
  const apiKey = process.env.IMGBB_API_KEY || 'a7324da8420f04b2e6bae6035cf7e25d';
  try {
    const formData = new URLSearchParams();
    formData.append('key', apiKey);
    formData.append('image', imageUrl);
    const response = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: formData });
    const data = await response.json();
    if (data.success && data.data && data.data.url) return data.data.url;
    return imageUrl;
  } catch (error) {
    return imageUrl;
  }
}

// Helper: Delete temporary file from Supabase Storage
async function deleteFromSupabaseStorage(url: string) {
  if (!url || !url.includes('supabase.co/storage/v1/object/public/')) return;
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/storage/v1/object/public/')[1].split('/');
    const bucket = pathParts[0];
    const filePath = pathParts.slice(1).join('/');
    if (bucket && filePath) {
      await supabase.storage.from(bucket).remove([filePath]);
    }
  } catch (error) {}
}

app.post('/api/templates', async (req, res) => {
  try {
    const { template } = req.body;
    if (!template) return res.status(400).json({ error: 'Template is required' });
    const templateId = crypto.randomUUID();
    let finalImageUrl = template.image_url || template.imageUrl || '';
    let finalBannerUrl = template.banner_url || template.bannerUrl || finalImageUrl;
    let finalGalleryImages = template.gallery_images || [];
    const originalImageUrl = finalImageUrl;
    const originalBannerUrl = finalBannerUrl;
    const originalGalleryImages = [...finalGalleryImages];

    if (finalImageUrl) finalImageUrl = await uploadToImgBB(finalImageUrl);
    if (finalBannerUrl && finalBannerUrl !== originalImageUrl) {
      finalBannerUrl = await uploadToImgBB(finalBannerUrl);
    } else if (finalBannerUrl === originalImageUrl) {
      finalBannerUrl = finalImageUrl;
    }
    if (Array.isArray(finalGalleryImages)) {
      for (let i = 0; i < finalGalleryImages.length; i++) {
        if (finalGalleryImages[i]) finalGalleryImages[i] = await uploadToImgBB(finalGalleryImages[i]);
      }
    }

    setTimeout(async () => {
      if (finalImageUrl !== originalImageUrl) await deleteFromSupabaseStorage(originalImageUrl);
      if (finalBannerUrl !== originalBannerUrl && originalBannerUrl !== originalImageUrl) await deleteFromSupabaseStorage(originalBannerUrl);
      for (let i = 0; i < originalGalleryImages.length; i++) {
        if (finalGalleryImages[i] !== originalGalleryImages[i]) await deleteFromSupabaseStorage(originalGalleryImages[i]);
      }
    }, 1000);

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
    const originalImageUrl = updates.image_url || updates.imageUrl;
    const originalBannerUrl = updates.banner_url || updates.bannerUrl;
    const originalGalleryImages = updates.gallery_images ? [...updates.gallery_images] : null;

    if (updates.image_url) updates.image_url = await uploadToImgBB(updates.image_url);
    if (updates.imageUrl) updates.imageUrl = await uploadToImgBB(updates.imageUrl);
    if (updates.banner_url) updates.banner_url = await uploadToImgBB(updates.banner_url);
    if (updates.bannerUrl) updates.bannerUrl = await uploadToImgBB(updates.bannerUrl);
    if (updates.gallery_images && Array.isArray(updates.gallery_images)) {
      for (let i = 0; i < updates.gallery_images.length; i++) {
        if (updates.gallery_images[i]) updates.gallery_images[i] = await uploadToImgBB(updates.gallery_images[i]);
      }
    }

    setTimeout(async () => {
      if (updates.image_url && updates.image_url !== originalImageUrl) await deleteFromSupabaseStorage(originalImageUrl);
      if (updates.imageUrl && updates.imageUrl !== originalImageUrl) await deleteFromSupabaseStorage(originalImageUrl);
      if (updates.banner_url && updates.banner_url !== originalBannerUrl) await deleteFromSupabaseStorage(originalBannerUrl);
      if (updates.bannerUrl && updates.bannerUrl !== originalBannerUrl) await deleteFromSupabaseStorage(originalBannerUrl);
      if (updates.gallery_images && originalGalleryImages) {
        for (let i = 0; i < originalGalleryImages.length; i++) {
          if (updates.gallery_images[i] !== originalGalleryImages[i]) await deleteFromSupabaseStorage(originalGalleryImages[i]);
        }
      }
    }, 1000);

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
  app.listen(PORT, '0.0.0.0');
}

export default app;
