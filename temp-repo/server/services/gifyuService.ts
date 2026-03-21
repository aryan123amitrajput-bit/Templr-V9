export const uploadToGifyu = async (fileBuffer: Buffer, fileName: string, mimeType: string) => {
    const apiKey = process.env.GIFYU_API_KEY;
    if (!apiKey) {
        throw new Error('GIFYU_API_KEY is not configured');
    }

    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('image', blob, fileName);
    formData.append('key', apiKey);

    const response = await fetch('https://gifyu.com/api/1/upload', {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(`Gifyu upload failed: ${result.error?.message || 'Unknown error'}`);
    }

    return {
        direct_url: result.data.url,
        thumbnail_url: result.data.thumb?.url || result.data.url,
        viewer_url: result.data.display_url
    };
};
