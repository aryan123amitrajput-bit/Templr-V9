/**
 * Templr Image Upload Service - Smart Engine
 * 
 * Handles multi-host upload with dynamic fallback chain, timeouts, and retries.
 */

export interface UploadResult {
    success: boolean;
    provider: string;
    direct_url: string;
    thumbnail_url: string;
    viewer_url: string;
    fallback_used: boolean;
    auth_token?: string;
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

// 2. Timeout Wrapper
const fetchWithTimeout = async (resource: string, options: RequestInit & { timeout?: number }) => {
    const { timeout = 8000 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
};

// 3. Provider Factory
const createProvider = (name: string, endpoint: string) => async (file: Blob): Promise<Partial<UploadResult>> => {
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    
    const response = await fetchWithTimeout(`/api/upload/${endpoint}`, { 
        method: 'POST', 
        body: formData,
        timeout: 6000 // 6 seconds max per provider
    });
    
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `${name} upload failed with status ${response.status}`);
    }
    
    const data = await response.json();
    return {
        provider: name,
        direct_url: data.direct_url || data.url,
        thumbnail_url: data.thumbnail_url || data.direct_url || data.url,
        viewer_url: data.viewer_url || data.direct_url || data.url,
        auth_token: data.auth_token
    };
};

const providers = [
    { name: 'i111666', fn: createProvider('i111666', 'i111666') },
    { name: 'catbox', fn: createProvider('catbox', 'catbox') },
    { name: 'beeimg', fn: createProvider('beeimg', 'beeimg') },
    { name: 'gifyu', fn: createProvider('gifyu', 'gifyu') },
    { name: 'imgbb', fn: createProvider('imgbb', 'imgbb') },
    { name: 'imghippo', fn: createProvider('imghippo', 'imghippo') },
    { name: 'github', fn: createProvider('github', 'github') }
];

// 4. Main Upload Orchestrator
export const uploadFromUrl = async (url: string): Promise<UploadResult> => {
    try {
        console.log(`[Orchestrator] Fetching image from URL via backend: ${url}`);
        const response = await fetchWithTimeout('/api/upload/url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
            timeout: 10000
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Upload from URL failed: ${response.statusText}`);
        }

        const data = await response.json();
        return {
            success: true,
            provider: data.host,
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
    const optimizedBlob = await optimizeImage(file);
    let lastError = '';

    // Smart Engine: Try each provider with a strict timeout
    for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        console.log(`[Orchestrator] Attempting upload with ${provider.name}...`);
        
        try {
            // Attempt upload with 1 retry per provider
            let result;
            try {
                result = await provider.fn(optimizedBlob);
            } catch (e) {
                console.warn(`[Orchestrator] ${provider.name} failed, retrying once...`);
                result = await provider.fn(optimizedBlob);
            }
            
            console.log(`[Orchestrator] ${provider.name} upload successful!`);
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
            console.warn(`[Orchestrator] Provider ${provider.name} failed permanently:`, lastError);
        }
    }

    throw new Error(`CRITICAL: All image hosting providers failed. Last error: ${lastError}`);
};
