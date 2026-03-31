import { uploadQueue } from '@/src/services/queueService';
import { telegramService } from '@/src/services/telegramService';
import { uploadToCatbox } from '@/src/services/catboxService';
import { updateTemplate } from '@/src/services/supabaseService';

uploadQueue.setProcessor(async (job) => {
    const { templateId, fileBuffer, metadata } = job.data;
    
    console.log(`[Worker] Processing upload for template: ${templateId}`);

    let telegramFileId = null;

    // 1. Try Telegram (User Preferred Primary)
    try {
        const tgUri = await telegramService.uploadImage(fileBuffer, `${templateId}.jpg`);
        const match = tgUri.match(/^tg:\/\/(\d+)\/(.+)$/);
        if (match) {
            const botIndex = match[1];
            const fileId = match[2];
            const imageUrl = `/api/tg-file/${botIndex}/${fileId}`;
            await updateTemplate(templateId, { 
                image_url: imageUrl, 
                status: 'active' 
            });
            console.log(`[Worker] Uploaded to Telegram: ${imageUrl}`);
        }
    } catch (tgError: any) {
        console.warn('[Worker] Telegram failed, trying Catbox as primary fallback...', tgError.message);
        try {
            const catboxResult = await uploadToCatbox(fileBuffer, `${templateId}.jpg`, 'image/jpeg');
            await updateTemplate(templateId, { 
                catbox_url: catboxResult.direct_url, 
                image_url: catboxResult.direct_url,
                status: 'active' 
            });
            console.log(`[Worker] Uploaded to Catbox: ${catboxResult.direct_url}`);
        } catch (catboxError: any) {
            console.error('[Worker] Primary hosting failed:', catboxError.message);
            await updateTemplate(templateId, { status: 'failed' });
        }
    }
});
