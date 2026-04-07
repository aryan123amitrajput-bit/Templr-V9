export const TELEGRAM_BOT_TOKEN = '8692277039:AAHQGo1sIRfBj6rYUrLO2yxUliuzEjijJPo';
export const TELEGRAM_CHAT_ID = '8187582649';

export const sendTelegramMessage = async (message: string) => {
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message }),
    });
  } catch (error) {
    console.error('Telegram error:', error);
  }
};
