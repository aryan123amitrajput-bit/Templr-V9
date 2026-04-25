
import axios from 'axios';

export const uploadToPasteRs = async (content: string): Promise<string> => {
    try {
        const response = await axios.post('https://paste.rs', content, {
            headers: { 'Content-Type': 'text/plain' },
            timeout: 15000
        });
        return response.data.trim();
    } catch (error: any) {
        console.error('Paste.rs upload failed:', error.message);
        throw error;
    }
};
