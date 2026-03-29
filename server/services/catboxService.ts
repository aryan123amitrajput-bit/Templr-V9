import axios from 'axios';
import FormData from 'form-data';

/**
 * Uploads a file to Catbox.moe
 * @param buffer The file buffer
 * @param filename The name of the file
 * @param mimetype The MIME type of the file
 * @returns The direct URL to the uploaded file
 */
export async function uploadToCatbox(buffer: Buffer, filename: string, mimetype: string): Promise<{ direct_url: string }> {
    try {
        const formData = new FormData();
        formData.append('reqtype', 'fileupload');
        formData.append('fileToUpload', buffer, { filename, contentType: mimetype });

        const response = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        if (typeof response.data === 'string' && response.data.startsWith('https://')) {
            return { direct_url: response.data.trim() };
        } else {
            throw new Error(`Catbox upload failed: ${response.data}`);
        }
    } catch (error: any) {
        console.error('[Catbox] Upload error:', error.message);
        throw error;
    }
}

/**
 * Uploads a file from a URL to Catbox.moe
 * @param url The URL of the file to upload
 * @returns The direct URL to the uploaded file
 */
export async function uploadUrlToCatbox(url: string): Promise<{ direct_url: string }> {
    try {
        const formData = new FormData();
        formData.append('reqtype', 'urlupload');
        formData.append('url', url);

        const response = await axios.post('https://catbox.moe/user/api.php', formData, {
            headers: {
                ...formData.getHeaders(),
            },
        });

        if (typeof response.data === 'string' && response.data.startsWith('https://')) {
            return { direct_url: response.data.trim() };
        } else {
            throw new Error(`Catbox URL upload failed: ${response.data}`);
        }
    } catch (error: any) {
        console.error('[Catbox] URL Upload error:', error.message);
        throw error;
    }
}
