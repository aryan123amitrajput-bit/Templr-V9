import axios from 'axios';

async function trigger() {
    console.log('Triggering test template upload via API...');
    const apiUrl = 'http://localhost:3000/api/upload/url';
    const testImageUrl = 'https://picsum.photos/seed/templr-test/1200/800';
    
    try {
        const response = await axios.post(apiUrl, {
            url: testImageUrl,
            description: 'Test Template - Snapchat Spotlight'
        });
        
        console.log('API Response:', response.data);
        if (response.data.templateId) {
            console.log(`Template ID: ${response.data.templateId}`);
        }
    } catch (error: any) {
        console.error('Error triggering upload:', error.response?.data || error.message);
    }
}

trigger();
