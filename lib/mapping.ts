
export interface Template {
    id: string;
    title: string;
    description: string;
    author: string;
    author_id?: string;
    author_uid?: string;
    author_avatar?: string;
    authorAvatar?: string;
    author_email?: string;
    imageUrl: string;
    bannerUrl: string;
    thumbnail: string;
    likes: number;
    views: number;
    category: string;
    tags: string[];
    price: string;
    sourceCode?: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    status: string;
    sales?: number;
    earnings?: number;
    created_at?: string;
    createdAt?: string;
    galleryImages?: string[];
    videoUrl?: string;
    fileSize?: number;
    authorBanner?: string;
    template_url?: string;
    uploadHost?: string;
    _source?: string;
}

/**
 * Fixes URLs for the frontend, specifically handling internal protocols like tg://
 */
function fixUrl(url: string | undefined | null): string {
    if (!url) return '';
    
    // Handle BeeIMG double https bug
    if (typeof url === 'string') {
        if (url.startsWith('https://https://')) url = url.replace('https://https://', 'https://');
        if (url.startsWith('http://http://')) url = url.replace('http://http://', 'http://');
    }

    if (url.startsWith('tg://')) {
        // tg://{botIndex}/{fileId} -> /api/tg-file/{botIndex}/{fileId}
        return `/api/tg-file/${url.replace('tg://', '')}`;
    }

    // Do not proxy images. Let the browser load them directly.
    return url;
}

/**
 * Maps any raw template data (Supabase, GitHub, FreeHost, etc.) to the frontend Template interface.
 */
export function mapToTemplate(t: any): Template {
    if (!t) return {} as Template;
    
    return {
        id: t.id || t.templateId || t._id || '',
        title: t.title || t.name || 'Untitled Template',
        description: t.description || t.desc || '',
        author: t.author_name || t.author || t.creator || t.authorName || 'Anonymous',
        author_id: t.author_id || t.creator_id || t.authorId || t.uid || '',
        author_uid: t.author_uid || t.author_id || t.creator_id || t.uid || '',
        author_avatar: fixUrl(t.author_avatar || t.creator_avatar || t.authorAvatar || t.avatar || ''),
        authorAvatar: fixUrl(t.author_avatar || t.creator_avatar || t.authorAvatar || t.avatar || ''),
        author_email: t.author_email || t.authorEmail || t.creator_email || '',
        imageUrl: fixUrl(t.image_url || t.preview_image || t.thumbnail || t.thumbnail_url || t.image_preview || t.imageUrl || ''),
        bannerUrl: fixUrl(t.banner_url || t.image_url || t.preview_image || t.bannerUrl || ''),
        thumbnail: fixUrl(t.thumbnail_url || t.thumbnail || t.image_preview || t.imageUrl || ''),
        likes: Number(t.likes || t.stats?.likes || 0),
        views: Number(t.views || t.stats?.views || 0),
        category: t.category || 'Uncategorized',
        tags: Array.isArray(t.tags) ? t.tags : (typeof t.tags === 'string' ? t.tags.split(',').map((s: string) => s.trim()) : []),
        price: String(t.price || 'Free'),
        sourceCode: fixUrl(t.source_code || t.sourceCode || ''),
        fileUrl: fixUrl(t.file_url || t.fileUrl || ''),
        fileName: t.file_name || t.fileName || '',
        fileType: t.file_type || t.fileType || (t.file_url?.endsWith('.zip') ? 'zip' : 'link'),
        status: t.status || 'approved',
        sales: Number(t.sales || 0),
        earnings: Number(t.earnings || 0),
        created_at: t.created_at || t.createdAt || new Date().toISOString(),
        createdAt: t.created_at || t.createdAt || new Date().toISOString(),
        galleryImages: Array.isArray(t.gallery_images) ? t.gallery_images.map(fixUrl) : (Array.isArray(t.galleryImages) ? t.galleryImages.map(fixUrl) : []),
        videoUrl: fixUrl(t.video_url || t.videoUrl || ''),
        fileSize: Number(t.file_size || t.fileSize || 0),
        authorBanner: fixUrl(t.author_banner || t.authorBanner || t.profile_banner || ''),
        template_url: t.template_url || '',
        uploadHost: t.upload_host || t.uploadHost || '',
        _source: t._source || 'unknown'
    };
}
