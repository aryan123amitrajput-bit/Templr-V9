
import axios from 'axios';
import FormData from 'form-data';

export const uploadToBeeIMG = async (buffer: Buffer, originalName: string, mimetype: string, apiKey?: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', buffer, { filename: originalName, contentType: mimetype });

    const response = await axios.post('https://beeimg.com/api/upload/file/json/', formData, {
        headers: formData.getHeaders()
    });

    if (!response.data || !response.data.files || !response.data.files.url) {
        throw new Error(`BeeIMG upload failed: ${JSON.stringify(response.data)}`);
    }

    return `https://${response.data.files.url}`;
};
