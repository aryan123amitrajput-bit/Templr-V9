
import axios from 'axios';
import FormData from 'form-data';

export const uploadToBeeIMG = async (buffer: Buffer, filename: string, mimetype: string, apiKey: string = ''): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    const formData = new FormData();
    formData.append('file', buffer, { filename });
    if (apiKey) formData.append('api_key', apiKey);

    const response = await axios.post('https://beeimg.com/api/upload/file/json/', formData, {
        headers: {
            ...formData.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (response.data && response.data.files && response.data.files.url) {
        const url = response.data.files.url;
        return { 
            direct_url: url,
            thumbnail_url: url,
            viewer_url: url
        };
    }
    throw new Error(`BeeIMG upload failed: ${JSON.stringify(response.data)}`);
};
