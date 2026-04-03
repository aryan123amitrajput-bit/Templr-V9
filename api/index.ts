import express from 'express';
import cors from 'cors';
import axios from 'axios';
import FormData from 'form-data';
import { templates } from '../db.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const TELEGRAM_TOKEN = '8692277039:AAHQGo1sIRfBj6rYUrLO2yxUliuzEjijJPo';
const TELEGRAM_CHAT_ID = '8187582649';

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/creators', (req, res) => {
  // Mock creators from templates
  const creators = Array.from(new Set(templates.map(t => t.author))).map(name => ({
    name,
    email: `${name.toLowerCase()}@example.com`,
    totalViews: templates.filter(t => t.author === name).reduce((sum, t) => sum + (t.views || 0), 0),
    totalLikes: templates.filter(t => t.author === name).reduce((sum, t) => sum + (t.likes || 0), 0),
    templateCount: templates.filter(t => t.author === name).length,
    avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
    role: 'Designer'
  }));
  res.json({ data: creators });
});

app.get('/api/templates', (req, res) => {
  const { page = 0, limit = 6, category = 'All', searchQuery = '', userId } = req.query;
  
  let filtered = [...templates];
  
  if (category !== 'All') {
    filtered = filtered.filter(t => t.category === category);
  }
  
  if (searchQuery) {
    const q = (searchQuery as string).toLowerCase();
    filtered = filtered.filter(t => 
      t.title.toLowerCase().includes(q) || 
      t.description.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  }
  
  if (userId) {
    // In a real app we'd filter by author_uid, for now just show all or mock
    // filtered = filtered.filter(t => t.author_uid === userId);
  }

  const start = Number(page) * Number(limit);
  const end = start + Number(limit);
  const data = filtered.slice(start, end);
  
  res.json({ 
    data, 
    hasMore: end < filtered.length 
  });
});

app.get('/api/templates/:id', (req, res) => {
  const template = templates.find(t => t.id === req.params.id);
  res.json({ template: template || null });
});

app.post('/api/templates', (req, res) => {
  const { template } = req.body;
  const newTemplate = {
    ...template,
    id: Math.random().toString(36).substring(7),
    likes: 0,
    views: 0,
    sales: 0,
    earnings: 0,
    createdAt: Date.now()
  };
  // In a real app we'd save to DB
  res.json({ template: newTemplate });
});

app.put('/api/templates/:id', (req, res) => {
  res.json({ success: true });
});

app.delete('/api/templates/:id', (req, res) => {
  res.json({ success: true });
});

app.post('/api/upload/url', async (req, res) => {
  const { url } = req.body;
  try {
    // For now, just return the URL as is, or we could proxy it
    res.json({ url, host: 'External' });
  } catch (error) {
    res.status(500).json({ error: 'URL upload failed' });
  }
});

app.post('/api/upload', async (req, res) => {
  const { file, path: filePath } = req.body;
  
  if (!file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    // 1. Try Telegram
    try {
      const base64Data = file.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      const form = new FormData();
      form.append('photo', buffer, { filename: 'upload.webp' });
      
      const tgRes = await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendPhoto?chat_id=${TELEGRAM_CHAT_ID}`, form, {
        headers: form.getHeaders()
      });
      
      if (tgRes.data.ok) {
        const fileId = tgRes.data.result.photo[tgRes.data.result.photo.length - 1].file_id;
        const fileInfoRes = await axios.get(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/getFile?file_id=${fileId}`);
        const tgUrl = `https://api.telegram.org/file/bot${TELEGRAM_TOKEN}/${fileInfoRes.data.result.file_path}`;
        return res.json({ url: tgUrl, host: 'Telegram' });
      }
    } catch (e) {
      console.error('Telegram upload failed, trying Catbox...', e);
    }

    // 2. Try Catbox
    try {
      const base64Data = file.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      const form = new FormData();
      form.append('reqtype', 'fileupload');
      form.append('fileToUpload', buffer, { filename: 'upload.webp' });
      
      const catRes = await axios.post('https://catbox.moe/user/api.php', form, {
        headers: form.getHeaders()
      });
      
      if (typeof catRes.data === 'string' && catRes.data.startsWith('http')) {
        return res.json({ url: catRes.data, host: 'Catbox' });
      }
    } catch (e) {
      console.error('Catbox upload failed...', e);
    }

    // Fallback to mock
    res.json({ url: 'https://picsum.photos/seed/upload/800/600', host: 'MockFallback' });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'All upload services failed' });
  }
});

export default app;

