
import axios from 'axios';
import FormData from 'form-data';

export const uploadToImgBB = async (buffer: Buffer, filename: string, mimetype: string, apiKey?: string): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    const key = apiKey || process.env.IMGBB_API_KEY || '6d207e02198a847aa98d0a2a901485a5';
    const formData = new FormData();
    formData.append('image', buffer.toString('base64'));

    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${key}`, formData, {
        headers: formData.getHeaders()
    });

    if (response.data && response.data.data) {
        const url = response.data.data.url;
        return { 
            direct_url: url, 
            thumbnail_url: response.data.data.thumb?.url || url,
            viewer_url: response.data.data.display_url || url
        };
    }
    throw new Error('ImgBB upload failed');
};
