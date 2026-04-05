import { telegramService } from '@/src/services/telegramService';
import { uploadToCatbox } from '@/src/services/catboxService';
import { uploadToSupabase } from '@/src/services/supabaseService';
import { uploadToI111666 } from '@/src/services/i111666Service';
import { uploadToImgBB } from '@/src/services/imgbbService';
import { uploadToGifyu } from '@/src/services/gifyuService';
import { uploadToImgHippo } from '@/src/services/imghippoService';
import { uploadToPasteRs } from '@/src/services/pasteService';

export async function processFileUpload(buffer: Buffer, originalname: string, mimetype: string) {
    const isVideo = mimetype.startsWith('video/');
    
    // 1. Try Telegram
    if (telegramService.isConfigured()) {
        try {
            const tgUri = isVideo 
                ? await telegramService.uploadDocument(buffer, originalname, mimetype)
                : await telegramService.uploadImage(buffer, originalname, mimetype);
            return { imageUrl: tgUri, hostUsed: 'Telegram' };
        } catch (e: any) {
            console.warn('[Upload] Telegram failed, trying Catbox...', e.message);
        }
    }

    // 2. Try Catbox
    try {
        const result = await uploadToCatbox(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'Catbox' };
    } catch (e: any) {
        console.warn('[Upload] Catbox failed, trying Supabase...', e.message);
    }

    // 3. Try Supabase
    try {
        const url = await uploadToSupabase(buffer, originalname, mimetype);
        return { imageUrl: url, hostUsed: 'Supabase' };
    } catch (e: any) {
        console.warn('[Upload] Supabase failed, trying i111666...', e.message);
    }

    // 4. Try i111666
    try {
        const result = await uploadToI111666(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'i111666' };
    } catch (e: any) {
        console.warn('[Upload] i111666 failed, trying ImgBB...', e.message);
    }

    // 5. Try ImgBB
    try {
        const result = await uploadToImgBB(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'ImgBB' };
    } catch (e: any) {
        console.warn('[Upload] ImgBB failed, trying Gifyu...', e.message);
    }

    // 6. Try Gifyu
    try {
        const result = await uploadToGifyu(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'Gifyu' };
    } catch (e: any) {
        console.warn('[Upload] Gifyu failed, trying ImgHippo...', e.message);
    }

    // 7. Try ImgHippo
    try {
        const result = await uploadToImgHippo(buffer, originalname);
        return { imageUrl: result.direct_url, hostUsed: 'ImgHippo' };
    } catch (e: any) {
        console.error('[Upload] All upload services failed.');
        throw new Error('All upload services failed');
    }
}

export async function uploadText(text: string) {
    try {
        const url = await uploadToPasteRs(text);
        return { url, hostUsed: 'Paste.rs' };
    } catch (e: any) {
        console.error('[Upload] Text upload failed:', e.message);
        throw new Error('Text upload failed');
    }
}
