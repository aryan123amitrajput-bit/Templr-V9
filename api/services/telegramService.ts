import axios from 'axios';
import FormData from 'form-data';

// Helper to sleep for rate limiting
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class TelegramService {
  private tokens: string[];
  private chatId: string;
  private currentBotIndex: number = 0;

  constructor() {
    const tokensStr = process.env.TELEGRAM_BOT_TOKENS || '';
    this.tokens = tokensStr.split(',').map((t) => t.trim()).filter(Boolean);
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  public isConfigured(): boolean {
    return this.tokens.length > 0 && !!this.chatId;
  }

  private getNextBot(): { token: string; index: number } {
    if (!this.isConfigured()) throw new Error('Telegram bots are not configured.');
    const index = this.currentBotIndex;
    const token = this.tokens[index];
    this.currentBotIndex = (this.currentBotIndex + 1) % this.tokens.length;
    return { token, index };
  }

  private async executeWithRetry<T>(apiCall: (token: string, chatId: string) => Promise<T>, retries = 3, usePrefix = false): Promise<T> {
    const bot = this.getNextBot();
    const currentChatId = usePrefix && !this.chatId.startsWith('-') ? `-100${this.chatId}` : this.chatId;
    
    try {
      return await apiCall(bot.token, currentChatId);
    } catch (error: any) {
      if (error.response) {
        // If chat not found, try with -100 prefix if we haven't already
        if (error.response.status === 400 && error.response.data?.description?.includes('chat not found')) {
            if (!usePrefix && !this.chatId.startsWith('-')) {
                // Silently retry with -100 prefix
                return this.executeWithRetry(apiCall, retries, true);
            } else {
                // If it still fails, throw a clean error without logging the raw API response
                throw new Error(`Telegram Chat Not Found. Please ensure the bot is added to chat ${this.chatId} (or -100${this.chatId}) and has permission to send messages.`);
            }
        }

        console.error(`[Telegram API Error] Status: ${error.response.status}, Data:`, JSON.stringify(error.response.data));

        if (error.response.status === 429) {
          const retryAfter = error.response.data?.parameters?.retry_after || 5;
          console.warn(`[Telegram] Rate limit hit (429). Waiting ${retryAfter} seconds...`);
          await sleep(retryAfter * 1000);
          if (retries > 0) {
            return this.executeWithRetry(apiCall, retries - 1, usePrefix);
          }
        }
      } else {
        console.error(`[Telegram API Error] Network or other error:`, error.message);
      }
      throw error;
    }
  }

  /**
   * Uploads an image as a photo to Telegram.
   * Returns a custom URI: tg://{botIndex}/{fileId}
   */
  public async uploadImage(buffer: Buffer, filename: string, contentType?: string): Promise<string> {
    if (!this.isConfigured()) throw new Error('Telegram not configured');
    
    const bot = this.getNextBot();
    
    return this.executeWithRetry(async (token, chatId) => {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('photo', buffer, { filename, contentType: contentType || 'image/jpeg' });

      const response = await axios.post(`https://api.telegram.org/bot${token}/sendPhoto`, form, {
        headers: form.getHeaders(),
      });
      
      const photos = response.data.result.photo;
      // Get the highest resolution photo (last in the array)
      const bestPhoto = photos[photos.length - 1];
      return `tg://${bot.index}/${bestPhoto.file_id}`;
    });
  }

  /**
   * Uploads a document (e.g., JSON bundle) to Telegram.
   * Returns a custom URI: tg://{botIndex}/{fileId}
   */
  public async uploadDocument(buffer: Buffer, filename: string, contentType?: string): Promise<string> {
    if (!this.isConfigured()) throw new Error('Telegram not configured');

    const bot = this.getNextBot();
    
    return this.executeWithRetry(async (token, chatId) => {
      const form = new FormData();
      form.append('chat_id', chatId);
      form.append('document', buffer, { filename, contentType: contentType || 'application/json' });

      const response = await axios.post(`https://api.telegram.org/bot${token}/sendDocument`, form, {
        headers: form.getHeaders(),
      });
      
      const document = response.data.result.document;
      return `tg://${bot.index}/${document.file_id}`;
    });
  }

  /**
   * Gets the temporary download URL for a file from Telegram.
   * Note: This URL contains the bot token, so it MUST NOT be sent to the client.
   */
  public async getFileDownloadUrl(tgUri: string): Promise<string> {
    const match = tgUri.match(/^tg:\/\/(\d+)\/(.+)$/);
    if (!match) throw new Error('Invalid Telegram URI format');

    const botIndex = parseInt(match[1], 10);
    const fileId = match[2];

    if (botIndex < 0 || botIndex >= this.tokens.length) {
      throw new Error('Invalid bot index in Telegram URI');
    }

    const token = this.tokens[botIndex];

    const response = await axios.get(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const filePath = response.data.result.file_path;

    return `https://api.telegram.org/file/bot${token}/${filePath}`;
  }
}

export const telegramService = new TelegramService();
