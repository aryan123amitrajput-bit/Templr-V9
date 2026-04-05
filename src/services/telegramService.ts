import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

export const fetchLatestTemplates = async () => {
  try {
    const response = await axios.get(`${TELEGRAM_API_URL}/getUpdates`, {
      params: {
        limit: 100, // Increased limit to get more updates
      },
    });

    // Filter messages that have documents (templates) and match the chat_id
    const messages = response.data.result;
    const templates = messages
      .filter((update: any) => 
        update.message && 
        update.message.document && 
        update.message.chat && 
        update.message.chat.id.toString() === TELEGRAM_CHAT_ID
      )
      .map((update: any) => ({
        file_id: update.message.document.file_id,
        file_name: update.message.document.file_name,
      }));

    return templates;
  } catch (error) {
    console.error('Error fetching templates from Telegram:', error);
    throw error;
  }
};

export const downloadTemplate = async (fileId: string) => {
  try {
    // 1. Get file path
    const fileResponse = await axios.get(`${TELEGRAM_API_URL}/getFile`, {
      params: { file_id: fileId },
    });
    const filePath = fileResponse.data.result.file_path;

    // 2. Download file
    const fileUrl = `https://api.telegram.org/file/bot${TELEGRAM_BOT_TOKEN}/${filePath}`;
    const fileContentResponse = await axios.get(fileUrl, { responseType: 'blob' });

    return fileContentResponse.data;
  } catch (error) {
    console.error('Error downloading template from Telegram:', error);
    throw error;
  }
};
