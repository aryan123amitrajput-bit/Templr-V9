import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/creators', (req, res) => {
  res.json({ data: [] });
});

app.get('/api/templates', (req, res) => {
  res.json({ data: [], hasMore: false });
});

app.get('/api/templates/:id', (req, res) => {
  res.json({ template: null });
});

export default app;

