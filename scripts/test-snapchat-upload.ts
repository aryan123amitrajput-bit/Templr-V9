
import axios from 'axios';

async function triggerUpload() {
    const API_URL = 'http://localhost:3000/api/upload/url';
    const TEST_IMAGE_URL = 'https://picsum.photos/seed/snapchat_test/1080/1920';
    
    console.log(`[Test] Triggering Snapchat upload for: ${TEST_IMAGE_URL}`);
    
    try {
        const response = await axios.post(API_URL, {
            url: TEST_IMAGE_URL,
            description: 'Snapchat Spotlight Test Template'
        });
        
        console.log('[Test] API Response:', response.data);
        
        if (response.data.success) {
            console.log(`[Test] Upload enqueued successfully. Template ID: ${response.data.id}`);
            console.log('[Test] The worker should now process this and upload to Snapchat Spotlight and Account.');
        }
    } catch (error: any) {
        console.error('[Test] Error triggering upload:', error.response?.data || error.message);
    }
}

triggerUpload();
