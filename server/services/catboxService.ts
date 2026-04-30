
import axios from 'axios';
import FormData from 'form-data';

/**
 * Uploads a file to Catbox.moe
 */
export const uploadToCatbox = async (buffer: Buffer, filename: string): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', buffer, { filename });
    
    // User hash can be provided in env if needed, otherwise it's anonymous
    if (process.env.CATBOX_USER_HASH) {
        formData.append('userhash', process.env.CATBOX_USER_HASH);
    }

    const response = await axios.post('https://catbox.moe/user/api.php', formData, {
        headers: {
            ...formData.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 20000 // 20s timeout
    });

    if (response.data && typeof response.data === 'string' && response.data.startsWith('http')) {
        const url = response.data.trim();
        return { 
            direct_url: url,
            thumbnail_url: url,
            viewer_url: url
        };
    }
    
    throw new Error(`Catbox upload failed: ${response.data}`);
};
