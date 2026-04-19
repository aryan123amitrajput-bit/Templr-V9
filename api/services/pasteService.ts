
import axios from 'axios';

export const uploadToPasteRs = async (content: string): Promise<string> => {
    const response = await axios.post('https://paste.rs', content);
    if (typeof response.data !== 'string' || !response.data.startsWith('http')) {
        throw new Error(`Paste.rs upload failed: ${response.data}`);
    }
    return response.data.trim();
};
