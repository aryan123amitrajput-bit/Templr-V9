import axios from 'axios';
import FormData from 'form-data';

async function run() {
  const fileBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  
  try {
    const formData = new FormData();
    formData.append('files[]', fileBuffer, { filename: 'test.png' });

    const response = await axios.post('https://uguu.se/upload.php', formData, {
        headers: {
            ...formData.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    console.log('Uguu success:', response.data);
  } catch (e: any) {
    console.error('Uguu error:', e.message, e.response?.data);
  }
}
run();
