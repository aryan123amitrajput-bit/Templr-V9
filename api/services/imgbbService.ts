
import axios from 'axios';
import FormData from 'form-data';

export const uploadToImgBB = async (buffer: Buffer, originalName: string, mimetype: string): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    // using a valid free api key as fallback
    const apiKey = process.env.IMGBB_API_KEY || '2e6f4b6791d08eac69f939e605d3b64c';
    if (!apiKey) throw new Error('IMGBB_API_KEY missing');

    const formData = new FormData();
    formData.append('image', buffer.toString('base64'));

    const response = await axios.post(`https://api.imgbb.com/1/upload?key=${apiKey}`, formData, {
        headers: formData.getHeaders()
    });

    if (!response.data || !response.data.success) {
        throw new Error(`ImgBB upload failed: ${JSON.stringify(response.data)}`);
    }

    const data = response.data.data;
    return { 
        direct_url: data.url, 
        thumbnail_url: data.thumb?.url || data.url, 
        viewer_url: data.display_url || data.url 
    };
};
