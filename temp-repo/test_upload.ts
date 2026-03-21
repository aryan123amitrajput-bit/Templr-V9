import crypto from 'crypto';
import fs from 'fs';

async function test() {
  const authToken = crypto.randomBytes(16).toString('hex');
  const formData = new FormData();
  // Create a 1x1 png
  const pngData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const blob = new Blob([pngData], { type: 'image/png' });
  formData.append('image', blob, 'test.png');

  const response = await fetch('https://i.111666.best/image', {
    method: 'POST',
    body: formData,
    headers: {
      'Auth-Token': authToken,
      'User-Agent': 'Mozilla/5.0'
    }
  });

  const text = await response.text();
  console.log('Status:', response.status);
  console.log('Response:', text);
}

test();
