
import axios from 'axios';
import FormData from 'form-data';

export const uploadToBeeIMG = async (buffer: Buffer, filename: string, mimetype: string, apiKey: string = ''): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    const formData = new FormData();
    formData.append('file', buffer, { filename });
    if (apiKey) formData.append('api_key', apiKey);

    const response = await axios.post('https://beeimg.com/api/upload/file/png/', formData, {
        headers: formData.getHeaders()
    });

    if (response.data && response.data.files && response.data.files.url) {
        const url = response.data.files.url;
        return { 
            direct_url: url,
            thumbnail_url: url,
            viewer_url: url
        };
    }
    throw new Error('BeeIMG upload failed');
};
