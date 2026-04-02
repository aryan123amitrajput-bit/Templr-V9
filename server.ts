import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import apiApp from './api/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = 3000;

app.use(apiApp);
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*all', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
