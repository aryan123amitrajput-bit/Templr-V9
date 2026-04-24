
import axios from 'axios';

class TelegramService {
    private botToken: string;
    private chatId: string;

    constructor() {
        this.botToken = '8692277039:AAHQGo1sIRfBj6rYUrLO2yxUliuzEjijJPo';
        this.chatId = '8187582649';
    }

    isConfigured(): boolean {
        return !!this.botToken && !!this.chatId;
    }

    async uploadDocument(buffer: Buffer, filename: string): Promise<string> {
        const url = `https://api.telegram.org/bot${this.botToken}/sendDocument`;
        const formData = new (await import('form-data')).default();
        formData.append('chat_id', this.chatId);
        formData.append('document', buffer, { filename });

        const response = await axios.post(url, formData, {
            headers: formData.getHeaders()
        });

        if (!response.data.ok) {
            throw new Error(`Telegram upload failed: ${response.data.description}`);
        }

        const fileId = response.data.result.document.file_id;
        // We use a custom URI format that the backend can resolve
        return `tg://0/${fileId}`;
    }

    async getFileDownloadUrl(tgUri: string): Promise<string> {
        const fileId = tgUri.replace('tg://0/', '');
        const getFileUrl = `https://api.telegram.org/bot${this.botToken}/getFile?file_id=${fileId}`;
        const response = await axios.get(getFileUrl);

        if (!response.data.ok) {
            throw new Error(`Telegram getFile failed: ${response.data.description}`);
        }

        const filePath = response.data.result.file_path;
        return `https://api.telegram.org/file/bot${this.botToken}/${filePath}`;
    }

    async getTemplates(): Promise<any[]> {
        // Retrieve templates stored as JSON messages in the chat
        // For now, return empty or implement a real fetch if possible
        return [];
    }

    async uploadImage(buffer: Buffer, filename: string, mimetype: string = 'image/jpeg'): Promise<string> {
        const url = `https://api.telegram.org/bot${this.botToken}/sendPhoto`;
        const formData = new (await import('form-data')).default();
        formData.append('chat_id', this.chatId);
        formData.append('photo', buffer, { filename });

        const response = await axios.post(url, formData, {
            headers: formData.getHeaders()
        });

        if (!response.data.ok) {
            throw new Error(`Telegram photo upload failed: ${response.data.description}`);
        }

        const photo = response.data.result.photo.pop(); // Get highest resolution
        const fileId = photo.file_id;
        
        return `tg://0/${fileId}`;
    }
}

export const telegramService = new TelegramService();
