import FormData from 'form-data';
import fetch from 'node-fetch';

export const uploadToTelegram = async (buffer: Buffer, originalname: string, mimetype: string): Promise<string> => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
        throw new Error('Telegram credentials not configured');
    }

    const formData = new FormData();
    formData.append('photo', buffer, { filename: originalname, contentType: mimetype });

    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto?chat_id=${chatId}`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.description || 'Telegram upload failed');
    }

    const data = await response.json();
    // Telegram returns a file_id, not a direct URL. 
    // To get a URL, we need to call getFile.
    const fileId = data.result.photo[data.result.photo.length - 1].file_id;
    
    const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileData = await fileResponse.json();
    const filePath = fileData.result.file_path;
    
    return `https://api.telegram.org/file/bot${token}/${filePath}`;
};
