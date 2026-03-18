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
    notice?: string;
}

// 2. Unofficial Host Uploaders
const uploadToGeneral = async (file: Blob): Promise<UploadResult> => {
    console.log('[General] Initiating upload via server proxy...');
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    
    const response = await fetch('/api/upload', { 
        method: 'POST', 
        body: formData 
    });
    
    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        console.error(`[General] Failed to parse JSON response from /api/upload. Response: ${responseText.substring(0, 200)}...`);
        throw new Error(`General upload proxy failed: Server returned non-JSON response (likely HTML). Status: ${response.status}`);
    }
    
    if (!response.ok) {
        throw new Error(`General upload proxy failed: ${data.error || response.statusText}`);
    }
    
    if (data.error) throw new Error(data.error);
    if (!data.url) throw new Error('General upload proxy returned no URL');
    
    return { 
        url: data.url, 
        platformUsed: data.host || 'General CDN', 
        endpoint: '/api/upload' 
    };
};

const uploadToFacebook = async (file: Blob): Promise<UploadResult> => {
    console.log('[Facebook] Initiating upload via server proxy...');
    const formData = new FormData();
    formData.append('file', file, 'image.webp');
    
    const response = await fetch('/api/fb-upload', { 
        method: 'POST', 
        body: formData 
    });
    
    const responseText = await response.text();
    let data;
    try {
        data = JSON.parse(responseText);
    } catch (e) {
        console.error(`[Facebook] Failed to parse JSON response from /api/fb-upload. Response: ${responseText.substring(0, 200)}...`);
        throw new Error(`Facebook proxy failed: Server returned non-JSON response (likely HTML). Status: ${response.status}`);
    }
    
    if (!response.ok) {
        throw new Error(`Facebook proxy failed: ${data.error || response.statusText}`);
    }
    
    if (data.error) throw new Error(data.error);
    if (!data.url) throw new Error('Facebook proxy returned no URL');
    
    return { 
        url: data.url, 
        platformUsed: data.host || 'Facebook CDN', 
        endpoint: '/api/fb-upload' 
    };
};

// 3. Image & CORS Validation
const validateImageUrl = async (url: string): Promise<string> => {
    const proxyUrl = `/api/proxy?url=${encodeURIComponent(url)}`;
    let finalUrl = url;

    console.log(`[Validation] Starting strict verification for: ${url}`);

    // Check 1: Fetch with CORS to ensure accessibility and headers
    try {
        const response = await fetch(url, { method: 'GET', mode: 'cors' });
        if (!response.ok) throw new Error(`Fetch failed with status: ${response.status}`);
        console.log(`[Validation] Fetch check ✅ (Status: ${response.status})`);
        
        // Verify it's actually an image
        const contentType = response.headers.get('Content-Type');
        if (contentType && !contentType.startsWith('image/')) {
            console.warn(`[Validation] Warning: Content-Type is ${contentType}, expected image/*`);
        }
    } catch (error) {
        console.warn(`[Validation] Direct CORS check failed for ${url}, trying proxy...`, error);
        try {
            const proxyResponse = await fetch(proxyUrl, { method: 'GET' });
            if (!proxyResponse.ok) throw new Error(`Proxy failed with status: ${proxyResponse.status}`);
            finalUrl = proxyUrl;
            console.log(`[Validation] Proxy verification successful for ${url}`);
        } catch (proxyError) {
            console.error(`[Validation] Both direct and proxy checks failed for ${url}:`, proxyError);
            throw new Error('CORS/Fetch verification failed. Image may taint canvas.');
        }
    }

    // Check 2: Load into Image object and Canvas Test
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; 
        img.onload = () => {
            console.log(`[Validation] Image load check ✅`);
            
            // Check 3: Canvas Test (Security Check)
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('Could not get canvas context');
                
                ctx.drawImage(img, 0, 0);
                // This will throw SecurityError if the image is tainted
                canvas.toDataURL();
                
                console.log(`[Validation] Canvas test ✅ (Image is CORS-safe)`);
                console.log(`[Validation] Success: ${finalUrl} is fully verified.`);
                resolve(finalUrl);
            } catch (canvasErr) {
                console.error(`[Validation] Canvas test ❌ (SecurityError):`, canvasErr);
                reject(new Error('Canvas test failed: Image taints canvas'));
            }
        };
        img.onerror = () => {
            console.error(`[Validation] Image object load failed ❌ for ${finalUrl}`);
            reject(new Error('Image object load failed'));
        };
        img.src = finalUrl;
    });
};

// 4. Main Upload Orchestrator
export const uploadImage = async (file: File): Promise<UploadResult> => {
    const optimizedBlob = await optimizeImage(file);
    const uploaders = [
        { name: 'Facebook', domain: 'fbcdn.net', fn: uploadToFacebook },
        { name: 'General', domain: '', fn: uploadToGeneral }
    ];

    for (const uploader of uploaders) {
        console.log(`[Orchestrator] Attempting internal upload via ${uploader.name}...`);
        
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const result = await uploader.fn(optimizedBlob);
                
                // Step 1: Hostname Validation (Skip for General as it can be multiple domains)
                if (uploader.domain) {
                    const urlObj = new URL(result.url);
                    const hostname = urlObj.hostname.toLowerCase();
                    const expectedDomain = uploader.domain.toLowerCase();
                    if (!hostname.includes(expectedDomain)) {
                        console.error(`[Orchestrator] Host check ❌: URL domain ${hostname} does not include expected ${expectedDomain}`);
                        throw new Error(`Security Alert: Host mismatch. Expected ${expectedDomain}, got ${hostname}`);
                    }
                    console.log(`[Orchestrator] Host check ✅: ${hostname} matches ${expectedDomain}`);
                }

                // Step 2, 3, 4: Verify accessibility, CORS, Image Load, and Canvas
                await validateImageUrl(result.url);
                
                console.log(`[Orchestrator] SUCCESS: Media verified on ${result.platformUsed}`);
                if (result.notice) console.info(`[Orchestrator] Notice: ${result.notice}`);
                console.log(`[Orchestrator] Final URL: ${result.url}`);
                return result;
            } catch (error) {
                const isDeprecated = uploader.name === 'Facebook' && (error instanceof Error && error.message.includes('deprecated'));
                
                if (isDeprecated) {
                    console.info(`[Orchestrator] ${uploader.name} hosting is deprecated. Moving to next provider...`);
                } else {
                    console.warn(`[Orchestrator] ${uploader.name} attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
                }
                
                // If it's a deprecation error from Facebook, don't retry
                if (isDeprecated) {
                    break;
                }
                
                if (attempt < 3) await new Promise(r => setTimeout(r, 1000));
            }
        }
    }
    
    // Final Fallback: Attempt basic upload (which includes Supabase Storage)
    console.log('[Orchestrator] All specialized hosts failed. Attempting final fallback to basic upload...');
    try {
        const formData = new FormData();
        formData.append('file', optimizedBlob, file.name);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });

        const responseText = await response.text();
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error(`[Orchestrator] Fallback failed to parse JSON. Response: ${responseText.substring(0, 200)}...`);
            throw new Error(`Fallback upload failed: Server returned non-JSON response. Status: ${response.status}`);
        }

        if (!response.ok) throw new Error(`Basic upload fallback failed: ${data.error || response.statusText}`);
        
        if (!data.url) throw new Error('No URL returned from basic upload');

        // Verify the fallback URL too
        await validateImageUrl(data.url);
        
        return {
            url: data.url,
            endpoint: '/api/upload',
            platformUsed: data.host || 'Fallback/Supabase'
        };
    } catch (err) {
        console.error('[Orchestrator] CRITICAL: All image hosting methods failed.', err);
        throw new Error('CRITICAL: All image hosting providers failed verification. Please check network or CORS settings.');
    }
};
