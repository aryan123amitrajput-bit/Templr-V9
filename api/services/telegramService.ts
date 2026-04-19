
import axios from 'axios';
import FormData from 'form-data';

export class TelegramService {
    private botTokens: string[] = [];
    private chatId: string;

    constructor() {
        const tokens = process.env.TELEGRAM_BOT_TOKENS || '';
        this.botTokens = tokens.split(',').map(t => t.trim()).filter(t => t);
        this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    }

    isConfigured(): boolean {
        return this.botTokens.length > 0 && !!this.chatId;
    }

    private getBotToken(index: number = 0): string {
        return this.botTokens[index] || this.botTokens[0];
    }

    async uploadImage(buffer: Buffer, originalName: string): Promise<string> {
        if (!this.isConfigured()) throw new Error('Telegram not configured');

        const botToken = this.getBotToken(0);
        const url = `https://api.telegram.org/bot${botToken}/sendPhoto`;

        const formData = new FormData();
        formData.append('chat_id', this.chatId);
        formData.append('photo', buffer, originalName);

        const response = await axios.post(url, formData, {
            headers: formData.getHeaders()
        });

        if (!response.data || !response.data.ok) {
            throw new Error(`Telegram upload failed: ${response.data.description}`);
        }

        const photo = response.data.result.photo;
        const largestPhoto = photo[photo.length - 1];
        return `tg://0/${largestPhoto.file_id}`;
    }

    async uploadDocument(buffer: Buffer, fileName: string): Promise<string> {
        if (!this.isConfigured()) throw new Error('Telegram not configured');

        const botToken = this.getBotToken(0);
        const url = `https://api.telegram.org/bot${botToken}/sendDocument`;

        const formData = new FormData();
        formData.append('chat_id', this.chatId);
        formData.append('document', buffer, fileName);

        const response = await axios.post(url, formData, {
            headers: formData.getHeaders()
        });

        if (!response.data || !response.data.ok) {
            throw new Error(`Telegram upload failed: ${response.data.description}`);
        }

        return `tg://0/${response.data.result.document.file_id}`;
    }

    async getFileDownloadUrl(tgUri: string): Promise<string> {
        const matches = tgUri.match(/^tg:\/\/(\d+)\/(.+)$/);
        if (!matches) throw new Error('Invalid TG URI');

        const botIndex = parseInt(matches[1]);
        const fileId = matches[2];
        const botToken = this.getBotToken(botIndex);

        const fileInfoUrl = `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`;
        const response = await axios.get(fileInfoUrl);

        if (!response.data || !response.data.ok) {
            throw new Error(`Failed to get file info: ${response.data.description}`);
        }

        const filePath = response.data.result.file_path;
        return `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    }

    /**
     * Fetches templates from recent messages in the Telegram chat/channel.
     * Looks for JSON blocks or descriptions that match TemplateMetadata.
     */
    async getTemplates(): Promise<any[]> {
        if (!this.isConfigured()) return [];
        
        try {
            const botToken = this.getBotToken(0);
            // We use getUpdates but for a channel/chat we usually need a webhook or database of messages.
            // As a fallback for "Wire" logic, we'll try to get the latest messages if possible.
            // Note: Telegram API getUpdates is limited. For real production, we'd store these in a registry.
            const response = await axios.get(`https://api.telegram.org/bot${botToken}/getUpdates?limit=100&allowed_updates=["message","channel_post"]`);
            
            if (!response.data || !response.data.ok) return [];

            const templates: any[] = [];
            const items = response.data.result;

            for (const item of items) {
                const msg = item.message || item.channel_post;
                if (!msg || !msg.text) continue;

                // Try to find a JSON block in the message
                const jsonMatch = msg.text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    try {
                        const data = JSON.parse(jsonMatch[0]);
                        if (data.id && (data.title || data.name)) {
                            templates.push({
                                ...data,
                                _source: 'telegram',
                                tg_msg_id: msg.message_id
                            });
                        }
                    } catch (e) {
                        // Not a valid template JSON
                    }
                }
            }
            return templates;
        } catch (e) {
            console.error('[TelegramService] Failed to fetch templates from wire:', e);
            return [];
        }
    }
}

export const telegramService = new TelegramService();
