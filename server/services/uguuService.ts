
import axios from 'axios';
import FormData from 'form-data';

export const uploadToUguu = async (buffer: Buffer, filename: string, mimetype: string): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    const formData = new FormData();
    formData.append('files[]', buffer, { filename });

    const response = await axios.post('https://uguu.se/upload.php', formData, {
        headers: {
            ...formData.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 10000 // 10s timeout
    });

    if (response.data && response.data.files && response.data.files[0]) {
        const url = response.data.files[0].url;
        return { 
            direct_url: url,
            thumbnail_url: url,
            viewer_url: url
        };
    }
    throw new Error('Uguu upload failed');
};
