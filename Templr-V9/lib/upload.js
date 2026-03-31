import { uploadToCatbox } from '../src/services/api/catboxService';
import { telegramService } from '../src/services/api/telegramService';
import { uploadToSupabase } from '../src/services/api/supabaseService';
import { uploadToI111666 } from '../src/services/api/i111666Service';
import { uploadToImgBB } from '../src/services/api/imgbbService';
import { uploadToGifyu } from '../src/services/api/gifyuService';
import { uploadToImgHippo } from '../src/services/api/imghippoService';
import { uploadToPasteRs } from '../src/services/api/pasteService';

export async function processFileUpload(buffer, originalname, mimetype) {
    // Fallback logic: Telegram -> Catbox -> Supabase -> i111666 -> ImgBB -> Gifyu -> ImgHippo
    
    // 1. Try Telegram
    if (telegramService.isConfigured()) {
        try {
            const tgUri = await telegramService.uploadImage(buffer, originalname, mimetype);
            const match = tgUri.match(/^tg:\/\/(\d+)\/(.+)$/);
            if (match) {
                const botIndex = match[1];
                const fileId = match[2];
                return { imageUrl: `/api/tg-file/${botIndex}/${fileId}`, hostUsed: 'Telegram' };
            }
        } catch (e) {
            console.warn('[Upload] Telegram failed, trying Catbox...', e.message);
        }
    }

    // 2. Try Catbox
    try {
        const result = await uploadToCatbox(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, catboxUrl: result.direct_url, hostUsed: 'Catbox' };
    } catch (e) {
        console.warn('[Upload] Catbox failed, trying Supabase...', e.message);
    }

    // 3. Try Supabase
    try {
        const url = await uploadToSupabase(buffer, originalname, mimetype);
        return { imageUrl: url, hostUsed: 'Supabase' };
    } catch (e) {
        console.warn('[Upload] Supabase failed, trying i111666...', e.message);
    }

    // 4. Try i111666
    try {
        const result = await uploadToI111666(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'i111666' };
    } catch (e) {
        console.warn('[Upload] i111666 failed, trying ImgBB...', e.message);
    }

    // 5. Try ImgBB
    try {
        const result = await uploadToImgBB(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'ImgBB' };
    } catch (e) {
        console.warn('[Upload] ImgBB failed, trying Gifyu...', e.message);
    }

    // 6. Try Gifyu
    try {
        const result = await uploadToGifyu(buffer, originalname, mimetype);
        return { imageUrl: result.direct_url, hostUsed: 'Gifyu' };
    } catch (e) {
        console.warn('[Upload] Gifyu failed, trying ImgHippo...', e.message);
    }

    // 7. Try ImgHippo
    try {
        const result = await uploadToImgHippo(buffer, originalname);
        return { imageUrl: result.direct_url, hostUsed: 'ImgHippo' };
    } catch (e) {
        console.error('[Upload] All external hosts failed:', e.message);
        throw new Error('Upload failed on all available external hosts.');
    }
}

export async function uploadText(content, filename = 'template.json') {
    if (telegramService.isConfigured()) {
        try {
            const buffer = Buffer.from(content, 'utf-8');
            const tgUri = await telegramService.uploadDocument(buffer, filename, 'application/json');
            const match = tgUri.match(/^tg:\/\/(\d+)\/(.+)$/);
            if (match) {
                const botIndex = match[1];
                const fileId = match[2];
                return { url: `/api/tg-file/${botIndex}/${fileId}`, host: 'Telegram' };
            }
        } catch (e) {
            console.warn('[Text Upload] Telegram failed, trying Paste.rs...', e.message);
        }
    }
    const url = await uploadToPasteRs(content);
    return { url, host: 'Paste.rs' };
}
