/**
 * Templr Image Upload Service
 * 
 * Handles multi-host upload with fallback chain:
 * 1. i.111666.best (Primary)
 * 2. Pixhost (Fallback 1)
 * 3. GitHub (Fallback 2)
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
const uploadToI111666 = async (file: Blob): Promise<Partial<UploadResult>> => {
    console.log('[i111666] Attempting upload via server proxy...');
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    
    const response = await fetch('/api/upload/i111666', { method: 'POST', body: formData });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'i111666 upload failed');
    }
    
    const data = await response.json();
    return {
        provider: 'i111666',
        direct_url: data.direct_url,
        thumbnail_url: data.direct_url,
        viewer_url: data.direct_url,
        auth_token: data.auth_token
    };
};

const uploadToPixhost = async (file: Blob): Promise<Partial<UploadResult>> => {
    console.log('[Pixhost] Attempting upload via server proxy...');
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    
    const response = await fetch('/api/upload/pixhost', { method: 'POST', body: formData });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Pixhost upload failed');
    }
    
    const data = await response.json();
    return {
        provider: 'pixhost',
        direct_url: data.direct_url,
        thumbnail_url: data.thumbnail_url,
        viewer_url: data.viewer_url
    };
};

const uploadToImgLink = async (file: Blob): Promise<Partial<UploadResult>> => {
    console.log('[ImgLink] Attempting upload...');
    const formData = new FormData();
    formData.append('source', file, 'image.webp');
    
    const response = await fetch('https://imglink.io/api/upload', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('ImgLink upload failed');
    
    const data = await response.json();
    return {
        provider: 'imglink',
        direct_url: data.image.url,
        thumbnail_url: data.image.thumb.url,
        viewer_url: data.image.url_viewer
    };
};

const uploadToImgHippo = async (file: Blob): Promise<Partial<UploadResult>> => {
    console.log('[ImgHippo] Attempting upload via server proxy...');
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    
    const response = await fetch('/api/upload/imghippo', { method: 'POST', body: formData });
    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'ImgHippo upload failed');
    }
    
    const data = await response.json();
    return {
        provider: 'imghippo',
        direct_url: data.direct_url,
        thumbnail_url: data.thumbnail_url,
        viewer_url: data.viewer_url
    };
};

const uploadToGitHub = async (file: Blob): Promise<Partial<UploadResult>> => {
    console.log('[GitHub] Attempting upload via server proxy...');
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    
    const response = await fetch('/api/upload/github', { method: 'POST', body: formData });
    if (!response.ok) throw new Error('GitHub upload failed');
    
    const data = await response.json();
    return {
        provider: 'github',
        direct_url: data.url,
        thumbnail_url: data.url, // GitHub raw doesn't have thumbnails
        viewer_url: data.url
    };
};

// 3. Main Upload Orchestrator
export const uploadFromUrl = async (url: string): Promise<UploadResult> => {
    const providers = [
        { name: 'i111666', endpoint: '/api/upload/i111666' }
    ];

    let lastError = '';
    for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        try {
            console.log(`[Orchestrator] Attempting URL upload via ${provider.name}...`);
            const response = await fetch(provider.endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || `${provider.name} URL upload failed`);
            }
            
            const data = await response.json();
            return {
                success: true,
                provider: provider.name,
                direct_url: data.direct_url,
                thumbnail_url: data.direct_url,
                viewer_url: data.direct_url,
                fallback_used: i > 0
            };
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            console.warn(`[Orchestrator] ${provider.name} URL upload failed:`, lastError);
        }
    }

    throw new Error(`CRITICAL: All URL upload providers failed. Last error: ${lastError}`);
};

export const uploadImage = async (file: File): Promise<UploadResult> => {
    const optimizedBlob = await optimizeImage(file);
    
    const providers = [
        { name: 'i111666', fn: uploadToI111666 },
        { name: 'imghippo', fn: uploadToImgHippo },
        { name: 'pixhost', fn: uploadToPixhost },
        { name: 'github', fn: uploadToGitHub }
    ];

    let lastError = '';
    for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        try {
            console.log(`[Orchestrator] Attempting upload via ${provider.name}...`);
            const result = await provider.fn(optimizedBlob);
            
            return {
                success: true,
                provider: result.provider!,
                direct_url: result.direct_url!,
                thumbnail_url: result.thumbnail_url || result.direct_url!,
                viewer_url: result.viewer_url!,
                fallback_used: i > 0,
                auth_token: result.auth_token
            };
        } catch (error) {
            lastError = error instanceof Error ? error.message : String(error);
            console.warn(`[Orchestrator] ${provider.name} failed:`, lastError);
        }
    }

    throw new Error(`CRITICAL: All image hosting providers failed. Last error: ${lastError}`);
};
