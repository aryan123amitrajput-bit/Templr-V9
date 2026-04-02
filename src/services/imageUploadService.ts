/**
 * Templr Image Upload Service
 * 
 * Handles image upload via backend proxy which uses:
 * External Hosting (i111666, ImgBB, etc.)
 */

export interface UploadResult {
    success: boolean;
    provider: string;
    direct_url: string;
    thumbnail_url: string;
    viewer_url: string;
    fallback_used: boolean;
    auth_token?: string; // Added to support deletion
}

// 1. Image Optimization
export const optimizeImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > 1280) {
                height = (height * 1280) / width;
                width = 1280;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Optimization failed'));
                },
                'image/webp',
                0.8
            );
        };
        img.onerror = reject;
    });
};

// 2. Providers
const fileToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

// Telegram Upload Logic
export const uploadToTelegram = async (file: File | Blob): Promise<string> => {
    const token = '8692277039:AAHQGo1sIRfBj6rYUrLO2yxUliuzEjijJPo';
    const chatId = '8187582649';
    
    const formData = new FormData();
    formData.append('photo', file);
    
    const response = await fetch(`https://api.telegram.org/bot${token}/sendPhoto?chat_id=${chatId}`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) throw new Error('Telegram upload failed');
    const data = await response.json();
    const fileId = data.result.photo[data.result.photo.length - 1].file_id;
    
    const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileData = await fileResponse.json();
    const filePath = fileData.result.file_path;
    
    return `https://api.telegram.org/file/bot${token}/${filePath}`;
};

// 3. Main Upload Orchestrator
export const uploadFromUrl = async (url: string): Promise<UploadResult> => {
    try {
        console.log(`[Orchestrator] Fetching image from URL via backend: ${url}`);
        const response = await fetch('/api/upload/url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Upload from URL failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            provider: data.host || 'External URL',
            direct_url: data.url,
            thumbnail_url: data.url,
            viewer_url: data.url,
            fallback_used: false
        };
    } catch (error) {
        const lastError = error instanceof Error ? error.message : String(error);
        console.error(`[Orchestrator] URL upload failed:`, lastError);
        throw new Error(`CRITICAL: URL upload failed. Last error: ${lastError}`);
    }
};

export const uploadImage = async (file: File): Promise<UploadResult> => {
    try {
        console.log(`[Orchestrator] Optimizing image: ${file.name}`);
        const optimizedBlob = await optimizeImage(file);
        
        try {
            console.log(`[Orchestrator] Uploading to Telegram...`);
            const telegramUrl = await uploadToTelegram(optimizedBlob);
            return {
                success: true,
                provider: 'Telegram',
                direct_url: telegramUrl,
                thumbnail_url: telegramUrl,
                viewer_url: telegramUrl,
                fallback_used: false
            };
        } catch (telegramErr) {
            console.warn(`[Orchestrator] Telegram upload failed, falling back to proxy:`, telegramErr);
        }

        const base64File = await fileToBase64(optimizedBlob);
        
        console.log(`[Orchestrator] Sending optimized image to backend proxy...`);
        const response = await fetch('/api/upload', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                file: base64File, 
                path: `optimized/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}` 
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Backend upload failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            provider: data.host || 'Multi-service Proxy',
            direct_url: data.url,
            thumbnail_url: data.url,
            viewer_url: data.url,
            fallback_used: true
        };
    } catch (error) {
        const lastError = error instanceof Error ? error.message : String(error);
        console.error(`[Orchestrator] Image upload failed:`, lastError);
        throw new Error(`CRITICAL: Image upload failed. Last error: ${lastError}`);
    }
};
