import crypto from 'crypto';

export const uploadToI111666 = async (fileBuffer: Buffer, fileName: string, mimeType: string) => {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('image', blob, fileName);

    const authToken = crypto.randomBytes(16).toString('hex');
    const response = await fetch('https://i.111666.best/image', {
        method: 'POST',
        body: formData,
        headers: {
            'Auth-Token': authToken,
            'Referer': 'https://i.111666.best/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`i111666 API failed: ${response.status} ${errorText}`);
    }

    const responseText = (await response.text()).trim();
    console.log(`[i111666Service] Raw response:`, responseText);
    let directUrl = responseText;
    
    try {
        const parsed = JSON.parse(responseText);
        console.log(`[i111666Service] Parsed JSON:`, parsed);
        if (parsed.src) {
            directUrl = parsed.src;
        } else if (parsed.direct_url) {
            directUrl = parsed.direct_url;
        }
    } catch (e) {
        console.log(`[i111666Service] Not JSON, using raw text`);
        // Not JSON, treat as plain text
    }
    
    // Ensure absolute URL and direct image path
    if (directUrl.startsWith('/')) {
        directUrl = `https://i.111666.best${directUrl}`;
    }
    
    // If it doesn't contain /image/ or doesn't have an extension, it might be a viewer link
    if (!directUrl.includes('/image/') && !directUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp)$/i)) {
        // Try to convert viewer link to direct link if it follows the pattern https://i.111666.best/abc
        const urlObj = new URL(directUrl);
        if (urlObj.hostname === 'i.111666.best' && urlObj.pathname.length > 1 && !urlObj.pathname.includes('/')) {
            directUrl = `https://i.111666.best/image${urlObj.pathname}`;
        }
    }
    
    console.log(`[i111666Service] Final URL:`, directUrl);
    
    return {
        direct_url: directUrl,
        thumbnail_url: directUrl,
        viewer_url: directUrl
    };
};
