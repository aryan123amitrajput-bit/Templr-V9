
import axios from 'axios';
import axiosRetry from 'axios-retry';
import FormData from 'form-data';

const client = axios.create();
axiosRetry(client, { 
    retries: 3, 
    retryDelay: axiosRetry.exponentialDelay,
    retryCondition: (error) => {
        // Retry on 5xx errors (like 522)
        return axiosRetry.isNetworkOrIdempotentRequestError(error) || (error.response?.status && error.response.status >= 500);
    }
});

export const uploadToImgHippo = async (buffer: Buffer, originalName: string, apiKey?: string): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    const key = apiKey || process.env.IMGHIPPO_API_KEY || '0bd1d234918f906d353775d006d2b771';
    if (!key) throw new Error('IMGHIPPO_API_KEY missing');

    const formData = new FormData();
    formData.append('image', buffer.toString('base64'));
    formData.append('api_key', key);

    const response = await client.post('https://api.imghippo.com/v1/upload', formData, {
        headers: formData.getHeaders()
    });

    if (!response.data || !response.data.success) {
        throw new Error(`ImgHippo upload failed: ${JSON.stringify(response.data)}`);
    }

    const data = response.data.data;
    return { 
        direct_url: data.url, 
        thumbnail_url: data.view_url || data.url, 
        viewer_url: data.view_url || data.url 
    };
};
