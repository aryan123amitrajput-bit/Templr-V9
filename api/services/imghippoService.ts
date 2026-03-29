export const uploadToImgHippo = async (fileBuffer: Buffer, fileName: string) => {
    const apiKey = process.env.IMGHIPPO_API_KEY;
    if (!apiKey) {
        throw new Error('IMGHIPPO_API_KEY is not configured');
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer]);
    formData.append('file', blob, fileName);
    formData.append('api_key', apiKey);

    const response = await fetch('https://api.imghippo.com/v1/upload', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(`ImgHippo upload failed: ${result.message || 'Unknown error'}`);
    }

    return {
        direct_url: result.data.url,
        thumbnail_url: result.data.thumbnail_url || result.data.url,
        viewer_url: result.data.view_url || result.data.url
    };
};
