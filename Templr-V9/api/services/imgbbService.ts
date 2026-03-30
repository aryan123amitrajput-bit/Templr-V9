export const uploadToImgBB = async (fileBuffer: Buffer, fileName: string, mimeType: string) => {
    const apiKey = process.env.IMGBB_API_KEY;
    if (!apiKey) {
        throw new Error('IMGBB_API_KEY is not configured');
    }

    const formData = new FormData();
    formData.append('image', fileBuffer.toString('base64'));
    formData.append('key', apiKey);
    formData.append('name', fileName);

    const response = await fetch('https://api.imgbb.com/1/upload', {
        method: 'POST',
        body: formData
    });

    const result = await response.json();

    if (!result.success) {
        throw new Error(`ImgBB upload failed: ${result.error?.message || 'Unknown error'}`);
    }

    return {
        direct_url: result.data.url,
        thumbnail_url: result.data.thumb.url,
        medium_url: result.data.medium?.url || result.data.url,
        viewer_url: result.data.display_url,
        slug: result.data.id
    };
};
