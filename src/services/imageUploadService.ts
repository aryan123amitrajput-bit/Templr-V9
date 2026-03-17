/**
 * Templr Image Upload Service
 * 
 * Handles optimization, multi-host upload, and validation.
 * NOTE: Unofficial APIs may have CORS restrictions. If they fail,
 * it is due to the host's CORS policy, not the code.
 */

// 1. Image Optimization
export const optimizeImage = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // Resize to max 1280px
            if (width > 1280) {
                height = (height * 1280) / width;
                width = 1280;
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            // Convert to WebP and compress
            canvas.toBlob(
                (blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Optimization failed'));
                },
                'image/webp',
                0.8 // Quality
            );
        };
        img.onerror = reject;
    });
};

export interface UploadResult {
    platformUsed: string;
    endpoint: string;
    url: string;
}

// 2. Unofficial Host Uploaders
const uploadToRemit = async (file: Blob): Promise<UploadResult> => {
    const endpoint = 'https://img.remit.ee/api/upload';
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    const response = await fetch(endpoint, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Remit upload failed');
    const data = await response.json();
    return { url: data.url, platformUsed: 'Remit.ee', endpoint };
};

const uploadToCatbox = async (file: Blob): Promise<UploadResult> => {
    const endpoint = 'https://catbox.moe/user/api.php';
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    formData.append('fileToUpload', file, 'image.webp');
    const response = await fetch(endpoint, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('Catbox upload failed');
    return { url: await response.text(), platformUsed: 'Catbox', endpoint };
};

const uploadToPostImages = async (file: Blob): Promise<UploadResult> => {
    const endpoint = 'https://postimages.org/json/submit';
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    const response = await fetch(endpoint, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('PostImages upload failed');
    const data = await response.json();
    return { url: data.url, platformUsed: 'PostImages', endpoint };
};

const uploadToImgHippo = async (file: Blob): Promise<UploadResult> => {
    const endpoint = 'https://api.imghippo.com/v1/upload';
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    const response = await fetch(endpoint, { method: 'POST', body: formData });
    if (!response.ok) throw new Error('ImgHippo upload failed');
    const data = await response.json();
    return { url: data.data.url, platformUsed: 'ImgHippo', endpoint };
};

// 3. Image Validation
const validateImageUrl = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(url);
        img.onerror = () => reject(new Error('Image validation failed'));
        img.src = url;
    });
};

// 4. Main Upload Orchestrator
export const uploadImage = async (file: File): Promise<UploadResult> => {
    const optimizedBlob = await optimizeImage(file);
    const uploaders = [
        { name: 'Remit.ee', fn: uploadToRemit },
        { name: 'Catbox', fn: uploadToCatbox },
        { name: 'PostImages', fn: uploadToPostImages },
        { name: 'ImgHippo', fn: uploadToImgHippo }
    ];

    let lastPlatform = '';

    for (let i = 0; i < uploaders.length; i++) {
        const uploader = uploaders[i];
        
        if (i > 0) {
            console.log(`${lastPlatform} failed, switched to ${uploader.name}`);
        }

        for (let attempt = 0; attempt < 2; attempt++) {
            try {
                const result = await uploader.fn(optimizedBlob);
                
                // Validate domain
                if (!result.url.includes(result.platformUsed.toLowerCase().split('.')[0])) {
                    throw new Error(`URL domain mismatch for ${result.platformUsed}`);
                }

                await validateImageUrl(result.url);
                
                console.log(`Media uploaded using ${result.platformUsed} at ${result.endpoint}`);
                return result;
            } catch (error) {
                console.warn(`${uploader.name} attempt ${attempt + 1} failed:`, error);
            }
        }
        lastPlatform = uploader.name;
    }
    throw new Error('All upload attempts failed');
};
