export const uploadToCatbox = async (fileBuffer: Buffer, fileName: string, mimeType: string, userhash?: string) => {
    const formData = new FormData();
    formData.append('reqtype', 'fileupload');
    if (userhash) {
        formData.append('userhash', userhash);
    }
    
    const blob = new Blob([fileBuffer], { type: mimeType });
    formData.append('fileToUpload', blob, fileName);

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Catbox API failed: ${response.status} ${errorText}`);
    }

    const directUrl = (await response.text()).trim();
    
    if (!directUrl.startsWith('http')) {
        throw new Error(`Catbox API returned invalid URL: ${directUrl}`);
    }

    return {
        direct_url: directUrl,
        thumbnail_url: directUrl,
        viewer_url: directUrl
    };
};

export const urlUploadToCatbox = async (url: string, userhash?: string) => {
    const formData = new FormData();
    formData.append('reqtype', 'urlupload');
    formData.append('url', url);
    if (userhash) {
        formData.append('userhash', userhash);
    }

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Catbox URL Upload failed: ${response.status} ${errorText}`);
    }

    const directUrl = (await response.text()).trim();
    
    if (!directUrl.startsWith('http')) {
        throw new Error(`Catbox API returned invalid URL: ${directUrl}`);
    }

    return {
        direct_url: directUrl,
        thumbnail_url: directUrl,
        viewer_url: directUrl
    };
};

export const deleteFromCatbox = async (files: string[], userhash: string) => {
    if (!userhash) throw new Error('userhash is required to delete files');
    
    const formData = new FormData();
    formData.append('reqtype', 'deletefiles');
    formData.append('userhash', userhash);
    formData.append('files', files.join(' '));

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Catbox Delete failed: ${response.status} ${errorText}`);
    }

    return (await response.text()).trim();
};

export const createCatboxAlbum = async (title: string, desc: string, files: string[], userhash?: string) => {
    const formData = new FormData();
    formData.append('reqtype', 'createalbum');
    formData.append('title', title);
    formData.append('desc', desc);
    formData.append('files', files.join(' '));
    if (userhash) {
        formData.append('userhash', userhash);
    }

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Catbox Create Album failed: ${response.status} ${errorText}`);
    }

    const albumUrl = (await response.text()).trim();
    return { album_url: albumUrl };
};

export const editCatboxAlbum = async (short: string, title: string, desc: string, files: string[], userhash: string) => {
    if (!userhash) throw new Error('userhash is required to edit albums');

    const formData = new FormData();
    formData.append('reqtype', 'editalbum');
    formData.append('userhash', userhash);
    formData.append('short', short);
    formData.append('title', title);
    formData.append('desc', desc);
    formData.append('files', files.join(' '));

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Catbox Edit Album failed: ${response.status} ${errorText}`);
    }

    return (await response.text()).trim();
};

export const addToCatboxAlbum = async (short: string, files: string[], userhash: string) => {
    if (!userhash) throw new Error('userhash is required to add to albums');

    const formData = new FormData();
    formData.append('reqtype', 'addtoalbum');
    formData.append('userhash', userhash);
    formData.append('short', short);
    formData.append('files', files.join(' '));

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Catbox Add To Album failed: ${response.status} ${errorText}`);
    }

    return (await response.text()).trim();
};

export const removeFromCatboxAlbum = async (short: string, files: string[], userhash: string) => {
    if (!userhash) throw new Error('userhash is required to remove from albums');

    const formData = new FormData();
    formData.append('reqtype', 'removefromalbum');
    formData.append('userhash', userhash);
    formData.append('short', short);
    formData.append('files', files.join(' '));

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Catbox Remove From Album failed: ${response.status} ${errorText}`);
    }

    return (await response.text()).trim();
};

export const deleteCatboxAlbum = async (short: string, userhash: string) => {
    if (!userhash) throw new Error('userhash is required to delete albums');

    const formData = new FormData();
    formData.append('reqtype', 'deletealbum');
    formData.append('userhash', userhash);
    formData.append('short', short);

    const response = await fetch('https://catbox.moe/user/api.php', {
        method: 'POST',
        body: formData,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Catbox Delete Album failed: ${response.status} ${errorText}`);
    }

    return (await response.text()).trim();
};
