export const uploadToBeeIMG = async (fileBuffer: Buffer, fileName: string, mimeType: string, apiKey: string) => {
    const formData = new FormData();
    formData.append('file', new Blob([fileBuffer], { type: mimeType }), fileName);
    if (apiKey) {
        formData.append('api_key', apiKey);
    }

    const response = await fetch('https://beeimg.com/api/upload/file/json/', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`BeeIMG API failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    if (result.files && result.files.url) {
        return result.files.url;
    } else {
        throw new Error(`BeeIMG upload failed: ${JSON.stringify(result)}`);
    }
};
