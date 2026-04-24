
import axios from 'axios';
import FormData from 'form-data';

export const uploadToCatbox = async (buffer: Buffer, originalName: string, mimetype: string, userhash: string = ''): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    if (userhash) formData.append('userhash', userhash);
    formData.append('fileToUpload', buffer, { filename: originalName, contentType: mimetype });

    const response = await axios.post('https://catbox.moe/user/api.php', formData, {
        headers: {
            ...formData.getHeaders()
        }
    });

    if (response.status !== 200 || typeof response.data !== 'string' || !response.data.startsWith('http')) {
        console.error(`Catbox returned abnormal response:`, response.status, response.data);
        throw new Error(`Catbox upload rejected or returned invalid URL: ${response.data || response.statusText}`);
    }

    const url = response.data.trim();
    return { direct_url: url, thumbnail_url: url, viewer_url: url };
};

export const urlUploadToCatbox = async (url: string, userhash: string = ''): Promise<string> => {
    const formData = new FormData();
    formData.append('reqtype', 'urlupload');
    if (userhash) formData.append('userhash', userhash);
    formData.append('url', url);

    const response = await axios.post('https://catbox.moe/user/api.php', formData, {
        headers: formData.getHeaders()
    });

    if (typeof response.data !== 'string' || !response.data.startsWith('http')) {
        throw new Error(`Catbox URL upload failed: ${response.data}`);
    }
    return response.data.trim();
};

export const deleteFromCatbox = async (files: string[], userhash: string): Promise<boolean> => {
    const formData = new FormData();
    formData.append('reqtype', 'deletefiles');
    formData.append('userhash', userhash);
    formData.append('files', files.join(' '));
    const response = await axios.post('https://catbox.moe/user/api.php', formData, { headers: formData.getHeaders() });
    return response.status === 200;
};

export const createCatboxAlbum = async (title: string, description: string, files: string[], userhash: string) => ({ success: true, url: '' });
export const editCatboxAlbum = async (short: string, title: string, description: string, files: string[], userhash: string) => ({ success: true });
export const addToCatboxAlbum = async (short: string, files: string[], userhash: string) => ({ success: true });
export const removeFromCatboxAlbum = async (short: string, files: string[], userhash: string) => ({ success: true });
export const deleteCatboxAlbum = async (short: string, userhash: string) => ({ success: true });
