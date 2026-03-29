import { uploadQueue } from '../server/services/queueService';
import '../server/workers/uploadWorker';
import axios from 'axios';
import crypto from 'crypto';

async function seed() {
    console.log('Starting test template upload...');
    const testImageUrl = 'https://picsum.photos/seed/templr-test/1200/800';
    
    try {
        const response = await axios.get(testImageUrl, { responseType: 'arraybuffer' });
        const buffer = Buffer.from(response.data, 'binary');
        
        const templateId = crypto.randomUUID();
        console.log(`Enqueuing test template: ${templateId}`);
        
        await uploadQueue.add('process-upload', {
            templateId,
            fileBuffer: buffer,
            metadata: {
                template_name: 'Test Template - Snapchat Spotlight',
                description: 'A test template to verify Snapchat and Telegram uploads.'
            }
        });
        
        console.log('Test template enqueued successfully!');
        // Wait for processing to complete (since it's in-memory and we imported the worker)
        await new Promise(resolve => setTimeout(resolve, 5000));
        console.log('Test upload process finished.');
    } catch (error) {
        console.error('Error seeding test template:', error);
    }
}

seed();
