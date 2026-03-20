export const uploadToI111666 = async (fileBuffer: Buffer, fileName: string, mimeType: string) => {
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('image', blob, fileName);

    const response = await fetch('https://i.111666.best/image', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`i111666 API failed: ${response.status} ${errorText}`);
    }

    const directUrl = (await response.text()).trim();
    
    return {
        direct_url: directUrl,
        thumbnail_url: directUrl,
        viewer_url: directUrl
    };
};
