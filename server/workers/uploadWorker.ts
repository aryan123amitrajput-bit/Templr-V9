import { uploadQueue } from '../services/queueService';
import { snapchatService } from '../services/snapchatService';
import { telegramService } from '../services/telegramService';
import { uploadToCatbox } from '../services/catboxService';
import { updateTemplate } from '../services/supabaseService';

uploadQueue.setProcessor(async (job) => {
    const { templateId, fileBuffer, metadata } = job.data;
    
    console.log(`[Worker] Processing upload for template: ${templateId}`);

    let telegramFileId = null;
    let snapchatStatus: 'pending' | 'uploaded' | 'failed' = 'pending';

    // 1. Try Telegram (User Preferred Primary)
    try {
        telegramFileId = await telegramService.uploadImage(fileBuffer, `${templateId}.jpg`);
        await updateTemplate(templateId, { 
            telegram_file_id: telegramFileId, 
            status: 'active' 
        });
        console.log(`[Worker] Uploaded to Telegram: ${telegramFileId}`);
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

    // 2. Try Snapchat Sharing (Background)
    try {
        console.log('[Worker] Attempting Snapchat share...');
        const spotlightSnap = await snapchatService.uploadToSpotlight(fileBuffer, metadata.description);
        const accountSnap = await snapchatService.uploadToAccount(fileBuffer, metadata.description);
        
        await updateTemplate(templateId, { 
            snap_id: spotlightSnap.snapId, 
            account_snap_id: accountSnap.snapId,
            snapchatStatus: 'uploaded'
        });
        console.log(`[Worker] Shared on Snapchat Spotlight: ${spotlightSnap.snapId}`);
    } catch (snapError: any) {
        console.warn('[Worker] Snapchat share failed:', snapError.message);
        await updateTemplate(templateId, { snapchatStatus: 'failed' });
    }
});
