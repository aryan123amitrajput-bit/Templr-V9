import axios from 'axios';
import FormData from 'form-data';

export const uploadToUguu = async (buffer: Buffer, originalName: string, mimetype: string): Promise<{ direct_url: string }> => {
    const formData = new FormData();
    formData.append('files[]', buffer, { filename: originalName, contentType: mimetype });

    const response = await axios.post('https://uguu.se/upload.php', formData, {
        headers: {
            ...formData.getHeaders(),
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.data || !response.data.success || !response.data.files || response.data.files.length === 0) {
        throw new Error(`Uguu upload failed: ${JSON.stringify(response.data)}`);
    }

    return { direct_url: response.data.files[0].url };
};
