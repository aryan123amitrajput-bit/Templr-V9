import { uploadToBeeIMG } from './server/services/beeimgService';
import fs from 'fs';

async function test() {
    try {
        // Create a 1x1 transparent PNG
        const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
        const url = await uploadToBeeIMG(buffer, 'test.png', 'image/png', '098dccd10fb840e72711cdf846b50222');
        console.log('Success URL:', url);
    } catch (e) {
        console.error('Error:', e);
    }
}
test();
