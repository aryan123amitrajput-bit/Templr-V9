import axios from 'axios';

/**
 * Uploads text content to paste.rs
 * @param content The text content to upload
 * @returns The URL of the uploaded paste
 */
export const uploadToPasteRs = async (content: string): Promise<string> => {
    try {
        const response = await axios.post('https://paste.rs', content, {
            headers: {
                'Content-Type': 'text/plain'
            }
        });
        
        if (response.status !== 201 && response.status !== 200) {
            throw new Error(`Paste.rs upload failed: ${response.status} ${response.statusText}`);
        }
        
        return response.data.trim();
    } catch (error: any) {
        console.error('[Paste.rs] Upload failed:', error.message);
        throw new Error(`Paste.rs upload failed: ${error.message}`);
    }
};
