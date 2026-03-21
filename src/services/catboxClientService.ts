export interface CatboxAlbumResult {
    success: boolean;
    result?: any;
    error?: string;
}

export const catboxUrlUpload = async (url: string): Promise<{ direct_url: string; thumbnail_url: string; viewer_url: string }> => {
    const response = await fetch('/api/catbox/urlupload', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ url })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Catbox URL upload failed');
    }

    return response.json();
};

export const catboxDeleteFiles = async (files: string[]): Promise<{ success: boolean; result: string }> => {
    const response = await fetch('/api/catbox/deletefiles', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Catbox delete files failed');
    }

    return response.json();
};

export const catboxCreateAlbum = async (title: string, desc: string, files: string[]): Promise<CatboxAlbumResult> => {
    const response = await fetch('/api/catbox/album/create', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title, desc, files })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Catbox create album failed');
    }

    return response.json();
};

export const catboxEditAlbum = async (short: string, title: string, desc: string, files: string[]): Promise<CatboxAlbumResult> => {
    const response = await fetch('/api/catbox/album/edit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ short, title, desc, files })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Catbox edit album failed');
    }

    return response.json();
};

export const catboxAddToAlbum = async (short: string, files: string[]): Promise<CatboxAlbumResult> => {
    const response = await fetch('/api/catbox/album/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ short, files })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Catbox add to album failed');
    }

    return response.json();
};

export const catboxRemoveFromAlbum = async (short: string, files: string[]): Promise<CatboxAlbumResult> => {
    const response = await fetch('/api/catbox/album/remove', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ short, files })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Catbox remove from album failed');
    }

    return response.json();
};

export const catboxDeleteAlbum = async (short: string): Promise<CatboxAlbumResult> => {
    const response = await fetch('/api/catbox/album/delete', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ short })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Catbox delete album failed');
    }

    return response.json();
};
