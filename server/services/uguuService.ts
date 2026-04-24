
import axios from 'axios';
import FormData from 'form-data';

export const uploadToUguu = async (buffer: Buffer, filename: string, mimetype: string): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    const formData = new FormData();
    formData.append('files[]', buffer, { filename });

    const response = await axios.post('https://uguu.se/upload.php', formData, {
        headers: formData.getHeaders()
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
