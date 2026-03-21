
import { createClient } from '@supabase/supabase-js';
import { uploadImage } from './src/services/imageUploadService';

// ==========================================
//   TEMPLR PRODUCTION ENGINE v9.37
//   CRITICAL: DO NOT REMOVE OR CHANGE THESE
// ==========================================

export const PROVIDED_URL = ''; // CLEARED PER USER REQUEST
export const PROVIDED_KEY = ''; // CLEARED PER USER REQUEST

const getSupabaseConfig = () => {
    let url = '';
    let key = '';
    
    // Prioritize Env Vars
    try {
        if (import.meta.env) {
            url = import.meta.env.VITE_SUPABASE_URL || '';
            key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
            
            if (url) {}
            if (key) {}
        }
    } catch (e) {}

    // Fallback to Local Storage
    if (!url || !key) {
        try {
            if (typeof window !== 'undefined') {
                url = localStorage.getItem('templr_project_url') || '';
                key = localStorage.getItem('templr_anon_key') || '';
                if (url) {}
            }
        } catch(e) {}
    }

    let finalUrl = url;
    if (finalUrl && finalUrl.endsWith('/')) {
        finalUrl = finalUrl.slice(0, -1);
    }
    return { 
        url: finalUrl, 
        key: key 
    };
};

const config = getSupabaseConfig();
export const activeApiUrl = config.url;
export const isApiConfigured = config.url && config.url !== 'https://placeholder.supabase.co';

export const testConnection = async (url: string, key: string): Promise<{ success: boolean; message: string }> => {
    try {
        const testClient = createClient(url, key, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false,
                storage: typeof window !== 'undefined' ? window.localStorage : undefined,
                lock: (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
                    return fn();
                }
            }
        });
        // Try a very simple public query with timeout
        const { error } = await testClient.from('templates').select('count', { count: 'exact', head: true });
        
        if (error) {
            return { success: false, message: error.message };
        }
        return { success: true, message: "Connection successful!" };
    } catch (e: any) {
        return { success: false, message: e.message || "Network error" };
    }
};

export const fetchWithTimeout = async (url: string, options: any = {}) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        return response;
    } catch (e: any) {
        clearTimeout(timeoutId);
        throw e;
    }
};

// Robust fetch wrapper with retries for the Supabase client
const retryingFetch = async (url: any, options: any) => {
    const MAX_RETRIES = 2;
    let lastError;
    
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetchWithTimeout(url, options);
            
            // If 5xx error, treat as retryable
            if (response.status >= 500 && response.status < 600) {
                throw new Error(`Server error: ${response.status}`);
            }
            
            return response;
        } catch (e: any) {
            lastError = e;
            const msg = e.message;
            
            if (i < MAX_RETRIES - 1) {
                const delay = 1000 * Math.pow(2, i); // 1s, 2s
                await new Promise(r => setTimeout(r, delay));
            }
        }
    }
    throw lastError;
};

export const supabase = createClient(
    config.url || 'https://placeholder.supabase.co',
    config.key || 'placeholder-key',
    { 
        auth: { 
            persistSession: true, 
            autoRefreshToken: true, 
            detectSessionInUrl: true,
            storage: typeof window !== 'undefined' ? window.localStorage : undefined,
            lock: (name: string, acquireTimeout: number, fn: () => Promise<any>) => {
                // Bypass navigator.locks to fix timeout issues in iframes/preview environments
                return fn();
            }
        },
        global: {
            fetch: retryingFetch
        }
    }
);

export const signInWithGoogle = async () => {
    if (!isApiConfigured) {
        return { session: { user: { id: 'mock-user', email: 'mock@example.com' } } };
    }
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`
        }
    });
    if (error) throw error;
    return data;
};

export interface NewTemplateData {
  title: string;
  imageUrl: string; 
  bannerUrl: string; 
  galleryImages: string[]; 
  videoUrl?: string; 
  description?: string;
  category: string;
  tags?: string[];
  price: string;
  fileName?: string;
  fileType?: string;
  fileSize?: number; 
  externalLink?: string;
  fileUrl?: string;
  sourceCode?: string;
  initialStatus?: 'pending_review' | 'draft' | 'approved';
}

export type Session = {
  user: {
    id: string;
    email?: string;
    user_metadata: {
        avatar_url?: string;
        banner_url?: string;
        full_name?: string;
        usage_count?: number;
        is_pro?: boolean;
    };
  };
};

export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT';

export interface Template {
  id: string;
  title: string;
  author: string;
  authorAvatar?: string;
  authorBanner?: string;
  imageUrl: string;
  bannerUrl: string; 
  likes: number;
  views: number;
  isLiked: boolean;
  category: string;
  tags?: string[];
  description: string;
  price: string; 
  sourceCode: string;
  
  fileUrl?: string;
  fileName?: string; 
  fileType?: string;
  fileSize?: number;
  status: 'approved' | 'pending_review' | 'rejected' | 'draft';
  sales: number;
  earnings: number;

  galleryImages?: string[];
  videoUrl?: string;
  createdAt?: number;
}

export interface CreatorStats {
    name: string;
    email: string;
    totalViews: number;
    totalLikes: number;
    templateCount: number;
    avatarUrl: string;
    role: string;
}

export const fixUrl = (url?: string | string[]): string => {
    if (!url) return '';
    
    // Handle case where DB returns an array or JSON stringified array
    if (Array.isArray(url)) {
        if (url.length === 0) return '';
        url = url[0];
    } else if (typeof url === 'string' && url.trim().startsWith('[') && url.trim().endsWith(']')) {
        try {
            const parsed = JSON.parse(url);
            if (Array.isArray(parsed) && parsed.length > 0) {
                url = parsed[0];
            }
        } catch (e) {
            // Ignore parse error
        }
    }

    if (typeof url !== 'string') return '';
    let trimmedUrl = url.trim();
    
    // Strip leading/trailing quotes if they exist
    if ((trimmedUrl.startsWith('"') && trimmedUrl.endsWith('"')) || (trimmedUrl.startsWith("'") && trimmedUrl.endsWith("'"))) {
        trimmedUrl = trimmedUrl.slice(1, -1).trim();
    }
    
    return trimmedUrl;
};

export const unfixUrl = (url?: string): string => url || '';

const mapTemplate = (data: any): Template => {
    try {
        let inferredType = data.file_type || 'link';
        const hasSource = data.source_code && data.source_code.trim().length > 0;
        const hasLink = data.file_url && data.file_url.trim().length > 0 && data.file_url !== '#';
        const hasZip = data.file_url && (data.file_url.endsWith('.zip') || data.file_url.endsWith('.rar'));

        if (hasZip) inferredType = 'zip';
        else if (hasSource && !hasLink) inferredType = 'code';
        else if (!hasSource && hasLink) inferredType = 'link';
        else if (hasSource && hasLink) inferredType = 'code';
        else if (!hasSource && !hasLink) inferredType = 'image';

        // Robustly check multiple possible column names for images (snake_case and camelCase)
        const rawImage = data.preview_media || data.image_url || data.imageUrl || data.image || data.thumbnail || data.thumbnail_url || data.thumbnailUrl || data.preview_url || data.previewUrl || data.preview_image || data.previewImage || data.preview || data.cover_image || data.coverImage || data.cover || data.photo || data.picture || data.screenshot || data.screenshot_url || data.screenshotUrl || data.media || data.media_url || data.mediaUrl || (data.images && data.images[0]) || (data.gallery_images && data.gallery_images[0]) || (data.galleryImages && data.galleryImages[0]);
        const rawBanner = data.banner_url || data.bannerUrl || data.banner || rawImage;
        const rawAvatar = data.creator_avatar || data.author_avatar || data.authorAvatar || data.avatar_url || data.avatarUrl || data.avatar || data.profile_pic || data.profilePic || data.profile_image || data.profileImage;
        const rawAuthorBanner = data.author_banner || data.authorBanner || data.profile_banner || data.profileBanner;
        const rawVideo = data.video_url || data.videoUrl || data.video || data.preview_video || data.previewVideo;

        return {
            id: data.id?.toString() || Math.random().toString(),
            title: data.title || data.name || 'Untitled',
            author: data.author_name || data.authorName || data.author || data.creator || 'Anonymous', 
            authorAvatar: fixUrl(rawAvatar),
            authorBanner: fixUrl(rawAuthorBanner),
            imageUrl: fixUrl(rawImage),
            bannerUrl: fixUrl(rawBanner),
            galleryImages: (data.gallery_images || data.galleryImages || data.images || []).map(fixUrl),
            videoUrl: fixUrl(rawVideo),
            likes: data.likes || 0,
            views: data.views || 0,
            isLiked: false, 
            category: data.category || 'Uncategorized',
            tags: data.tags || [],
            description: data.description || '',
            price: data.price || 'Free',
            fileUrl: data.file_url,
            fileName: data.file_name,
            fileType: inferredType,
            fileSize: data.file_size,
            sourceCode: data.source_code || '', 
            status: data.status || 'pending_review',
            sales: data.sales || 0,
            earnings: data.earnings || 0,
            createdAt: data.created_at ? new Date(data.created_at).getTime() : Date.now()
        };
    } catch (e) {
        return {
            id: 'error-' + Math.random(),
            title: 'Error Loading Template',
            author: 'System',
            imageUrl: '',
            bannerUrl: '',
            likes: 0,
            views: 0,
            isLiked: false,
            category: 'Error',
            description: 'Failed to parse template data',
            price: 'Free',
            sourceCode: '',
            status: 'rejected',
            sales: 0,
            earnings: 0
        };
    }
};

let cachedRegistry: any = null;

export const getPublicTemplates = async (
    page: number = 0, 
    limit: number = 6, 
    searchQuery: string = '', 
    category: string = 'All',
    sortBy: 'newest' | 'popular' | 'likes' = 'newest'
): Promise<{ data: Template[], hasMore: boolean, error?: string }> => {
    
    const attempt = async (retryCount = 0): Promise<any> => {
        try {
            // Always use the Backend API for consistent merging and pagination
            const params = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                category: category,
                searchQuery: searchQuery,
                sortBy: sortBy
            });

            const response = await fetchWithTimeout(`/api/templates?${params.toString()}`, {});
            if (!response.ok) {
                throw new Error(`Backend returned ${response.status}`);
            }

            const { data, hasMore } = await response.json();
            const mappedData = (data || []).map(mapTemplate);

            return { data: mappedData, hasMore };
        } catch (e: any) {
            console.error(`[getPublicTemplates] Attempt ${retryCount} failed:`, e);
            
            // Fallback to Supabase directly if backend fails
            if (isApiConfigured) {
                try {
                    let query = supabase
                        .from('templates')
                        .select('*', { count: 'exact' })
                        .eq('status', 'approved');
                    
                    if (category !== 'All') query = query.eq('category', category);
                    if (searchQuery) {
                        query = query.or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
                    }
                    
                    if (sortBy === 'popular' || sortBy === 'likes') {
                        query = query.order('likes', { ascending: false });
                    } else {
                        query = query.order('created_at', { ascending: false });
                    }

                    const { data: sbData, error: sbError, count } = await query
                        .range(page * limit, (page + 1) * limit - 1);

                    if (!sbError && sbData) {
                        return { 
                            data: sbData.map(mapTemplate), 
                            hasMore: count ? (page + 1) * limit < count : sbData.length === limit 
                        };
                    }
                } catch (sbErr) {
                    console.error('[getPublicTemplates] Supabase fallback failed:', sbErr);
                }
            }

            if (retryCount < 1) {
                await new Promise(r => setTimeout(r, 1000));
                return attempt(retryCount + 1);
            }
            return { data: [], hasMore: false, error: e.message || "Connection failed" };
        }
    };

    try {
        return await attempt();
    } catch (e: any) {
        return { data: [], hasMore: false, error: e.message };
    }
};

export const getTemplateById = async (id: string): Promise<Template | null> => {
    const attempt = async (retryCount = 0): Promise<Template | null> => {
        try {
            // 1. Try JSONHosting batches first
            if (cachedRegistry && cachedRegistry.batches) {
                for (const batch of cachedRegistry.batches) {
                    try {
                        const batchRes = await fetch(batch.url);
                        if (batchRes.ok) {
                            const batchData = await batchRes.json();
                            if (batchData && batchData.templates) {
                                const template = batchData.templates.find((t: any) => t.id === id);
                                if (template) return mapTemplate(template);
                            }
                        }
                    } catch (e) {}
                }
            }

            // 2. Fetch from backend (Git/Supabase)
            const response = await fetchWithTimeout(`/api/templates/${id}`, {});
            if (response.ok) {
                const { data } = await response.json();
                if (data) return mapTemplate(data);
            }

            // Fallback to Supabase directly
            if (isApiConfigured) {
                const { data, error } = await supabase
                    .from('templates')
                    .select('*')
                    .eq('id', id)
                    .single();
                
                if (!error && data) return mapTemplate(data);
            }
            
            return null;
        } catch (e: any) {
            return null;
        }
    };
    return attempt();
};

export const getFeaturedCreators = async (): Promise<CreatorStats[]> => {
    const attempt = async (retryCount = 0): Promise<CreatorStats[]> => {
        try {
            const statsMap = new Map<string, CreatorStats>();

            // 1. Fetch from GitHub (via backend /api/creators)
            try {
                const response = await fetchWithTimeout('/api/creators', {});
                if (response.ok) {
                    const { data } = await response.json();
                    (data || []).forEach((t: any) => {
                        const email = t.author_email || t.authorEmail || t.email || 'anon';
                        const name = t.author_name || t.authorName || t.author || 'Anonymous';
                        const rawAvatar = t.author_avatar || t.authorAvatar || t.avatar_url || t.avatarUrl || t.avatar;

                        statsMap.set(email, {
                            name: name,
                            email: email,
                            totalViews: t.views || 0,
                            totalLikes: t.likes || 0,
                            templateCount: t.templates || 1,
                            avatarUrl: rawAvatar ? fixUrl(rawAvatar) : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                            role: 'Creator'
                        });
                    });
                }
            } catch (githubErr) {
            }

            // 2. Fetch from Supabase
            if (isApiConfigured) {
                try {
                    const { data: supabaseData, error } = await supabase
                        .from('templates')
                        .select('author_name, author_email, author_avatar, views, likes')
                        .eq('status', 'approved');
                    
                    if (!error && supabaseData) {
                        supabaseData.forEach((t: any) => {
                            const email = t.author_email || 'anon';
                            const name = t.author_name || 'Anonymous';
                            const rawAvatar = t.author_avatar;

                            const current = statsMap.get(email) || {
                                name: name,
                                email: email,
                                totalViews: 0,
                                totalLikes: 0,
                                templateCount: 0,
                                avatarUrl: rawAvatar ? fixUrl(rawAvatar) : `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`,
                                role: 'Creator'
                            };

                            current.totalViews += (t.views || 0);
                            current.totalLikes += (t.likes || 0);
                            current.templateCount += 1;
                            statsMap.set(email, current);
                        });
                    }
                } catch (supabaseErr) {
                }
            }

            const allCreators = Array.from(statsMap.values())
                .sort((a, b) => b.totalViews - a.totalViews)
                .slice(0, 20);

            for (let i = allCreators.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [allCreators[i], allCreators[j]] = [allCreators[j], allCreators[i]];
            }

            return allCreators.slice(0, 4).map(c => ({
                ...c,
                role: c.totalViews > 1000 ? 'Top Seller' : 'Rising Star'
            }));
        } catch (e: any) {
            const msg = e.message?.toLowerCase() || '';
            if (retryCount < 3 && (msg.includes('fetch') || msg.includes('timeout') || msg.includes('timed out') || msg.includes('offline'))) {
                const delay = 2000 * Math.pow(1.5, retryCount);
                await new Promise(r => setTimeout(r, delay));
                return attempt(retryCount + 1);
            }
            return [];
        }
    };

    return attempt();
};

export const listenForUserTemplates = (userEmail: string, callback: (templates: Template[]) => void) => {
    if (!userEmail) { callback([]); return { unsubscribe: () => {} }; }

    const fetchUserTemplates = async () => {
        try {
            const response = await fetchWithTimeout(`/api/user/templates?email=${encodeURIComponent(userEmail)}`, {});
            if (!response.ok) throw new Error(`Backend returned ${response.status}`);
            
            const { data } = await response.json();
            const mappedTemplates = (data || []).map(mapTemplate);
            
            callback(mappedTemplates);
        } catch (e: any) {
            
            // Fallback to Supabase directly
            if (isApiConfigured) {
                try {
                    const { data, error } = await supabase
                        .from('templates')
                        .select('*')
                        .eq('author_email', userEmail)
                        .order('created_at', { ascending: false });
                    
                    if (!error && data) {
                        callback(data.map(mapTemplate));
                    }
                } catch (sbErr) {
                }
            }
        }
    };

    fetchUserTemplates();
    const interval = setInterval(fetchUserTemplates, 10000); // Poll every 10 seconds

    const handleUpdate = () => fetchUserTemplates();
    window.addEventListener('templr-data-update', handleUpdate);

    return { 
        unsubscribe: () => {
            clearInterval(interval);
            window.removeEventListener('templr-data-update', handleUpdate);
        }
    };
};

export const addTemplate = async (templateData: NewTemplateData, user?: Session['user'] | null): Promise<Template> => {
    if (!user || !user.email) throw new Error("Authentication required.");

    const dbPayload: any = {
        title: templateData.title,
        image_url: unfixUrl(templateData.imageUrl),
        banner_url: unfixUrl(templateData.bannerUrl || templateData.imageUrl),
        category: templateData.category,
        price: templateData.price,
        author_name: user.user_metadata?.full_name || user.email.split('@')[0],
        author_email: user.email,
        author_avatar: unfixUrl(user.user_metadata?.avatar_url),
        file_name: templateData.fileName || 'Project Files',
        file_type: templateData.fileType || 'link',
        file_size: templateData.fileSize || 0,
        status: templateData.initialStatus || 'approved',
        tags: templateData.tags || [],
        description: templateData.description,
        video_url: unfixUrl(templateData.videoUrl),
        gallery_images: (templateData.galleryImages || []).map(unfixUrl),
        source_code: templateData.sourceCode,
        file_url: unfixUrl(templateData.fileUrl || templateData.externalLink),
        views: 0,
        likes: 0,
        sales: 0,
        earnings: 0
    };

    const attempt = async (retryCount = 0): Promise<Template> => {
        try {
            const userEmail = user?.email || 'anonymous@templr.io';
            const response = await fetchWithTimeout('/api/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ template: dbPayload, userEmail: userEmail })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            const t = data.template;
            
            return {
                id: t.id,
                title: t.name || t.title,
                author: t.creator || t.author_name,
                imageUrl: fixUrl(t.image_preview || t.image_url),
                bannerUrl: fixUrl(t.banner_url || t.image_preview),
                category: t.category,
                tags: t.tags || [],
                createdAt: new Date(t.created_at).getTime(),
                likes: 0,
                views: 0,
                isLiked: false,
                description: t.description || '',
                price: t.price || 'Free',
                sourceCode: '',
                status: 'approved',
                sales: 0,
                earnings: 0,
                fileUrl: fixUrl(t.file_url || t.preview_url)
            };
        } catch (error: any) {
            const msg = error.message?.toLowerCase() || '';
            if (retryCount < 3 && (msg.includes('fetch') || msg.includes('timeout') || msg.includes('timed out') || msg.includes('offline'))) {
                const delay = 2000 * Math.pow(1.5, retryCount);
                await new Promise(r => setTimeout(r, delay));
                return attempt(retryCount + 1);
            }
            throw new Error(error.message || "Connection error while saving template.");
        }
    };

    return attempt();
};

export const updateTemplateData = async (id: string, data: Partial<NewTemplateData>, userEmail: string): Promise<void> => {
    const dbPayload: any = {};
    if (data.title) dbPayload.title = data.title;
    if (data.description) dbPayload.description = data.description;
    if (data.category) dbPayload.category = data.category;
    if (data.tags) dbPayload.tags = data.tags;
    if (data.externalLink) dbPayload.file_url = unfixUrl(data.externalLink);
    if (data.imageUrl) dbPayload.image_url = unfixUrl(data.imageUrl);
    if (data.bannerUrl) dbPayload.banner_url = unfixUrl(data.bannerUrl);
    if (data.videoUrl) dbPayload.video_url = unfixUrl(data.videoUrl);
    if (data.sourceCode) dbPayload.source_code = data.sourceCode;
    if (data.fileUrl) dbPayload.file_url = unfixUrl(data.fileUrl);

    const attempt = async (retryCount = 0): Promise<void> => {
        try {
            const response = await fetchWithTimeout(`/api/templates/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: dbPayload, userEmail })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
        } catch (e: any) {
            const msg = e.message?.toLowerCase() || '';
            if (retryCount < 2 && (msg.includes('fetch') || msg.includes('timeout') || msg.includes('timed out'))) {
                await new Promise(r => setTimeout(r, 1000));
                return attempt(retryCount + 1);
            }
            throw new Error(e.message || "Connection failed while updating.");
        }
    };

    return attempt();
};

export const updateUserProfile = async (updates: { full_name?: string; avatar_url?: string; banner_url?: string }) => {
  if (!isApiConfigured) {
      return { user: { email: 'mock@example.com', user_metadata: updates } };
  }
  
  const dbUpdates: any = { ...updates };
  if (dbUpdates.avatar_url) {
      dbUpdates.avatar_url = unfixUrl(dbUpdates.avatar_url);
  }
  if (dbUpdates.banner_url) {
      dbUpdates.banner_url = unfixUrl(dbUpdates.banner_url);
  }

  const attempt = async (retryCount = 0): Promise<any> => {
    try {
        const { data, error } = await supabase.auth.updateUser({ data: dbUpdates });
        if (error) throw new Error(error.message);

        if (data.user?.email) {
            try {
                const syncUpdates: any = {};
                if (dbUpdates.full_name) syncUpdates.author_name = dbUpdates.full_name;
                if (dbUpdates.avatar_url) syncUpdates.author_avatar = dbUpdates.avatar_url;
                if (dbUpdates.banner_url) syncUpdates.author_banner = dbUpdates.banner_url;
                
                if (Object.keys(syncUpdates).length > 0) {
                    const response = await fetchWithTimeout('/api/user/templates', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email: data.user.email, updates: syncUpdates })
                    });
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                    }
                }
            } catch (e) {}
        }
        return data;
    } catch (e: any) {
        const msg = e.message?.toLowerCase() || '';
        if (retryCount < 2 && (msg.includes('fetch') || msg.includes('timeout') || msg.includes('timed out'))) {
            await new Promise(r => setTimeout(r, 1000));
            return attempt(retryCount + 1);
        }
        if (msg.includes('fetch')) throw new Error("Connection error while updating profile.");
        throw e;
    }
  };

  return attempt();
};

export const updateUserUsage = async (count: number) => {
  if (!isApiConfigured) return;
  
  const attempt = async (retryCount = 0): Promise<void> => {
    try {
        const { error } = await supabase.auth.updateUser({ data: { usage_count: count } });
        if (error) throw error;
    } catch (e: any) {
        const msg = e.message?.toLowerCase() || '';
        if (retryCount < 2 && (msg.includes('fetch') || msg.includes('timeout') || msg.includes('timed out'))) {
            await new Promise(r => setTimeout(r, 1000));
            return attempt(retryCount + 1);
        }
    }
  };

  return attempt();
};

export const setProStatus = async (status: boolean) => {
    if (!isApiConfigured) return;
    
    const attempt = async (retryCount = 0): Promise<void> => {
        try {
            const { error } = await supabase.auth.updateUser({ data: { is_pro: status } });
            if (error) throw error;
        } catch (e: any) {
            const msg = e.message?.toLowerCase() || '';
            if (retryCount < 2 && (msg.includes('fetch') || msg.includes('timeout') || msg.includes('timed out'))) {
                await new Promise(r => setTimeout(r, 1000));
                return attempt(retryCount + 1);
            }
        }
    };

    return attempt();
};

export const updateTemplate = async (templateId: string, updates: Partial<Template>): Promise<void> => {
    if (!isApiConfigured) return;
    
    const attempt = async (retryCount = 0): Promise<void> => {
        try {
            const dbUpdates: any = {};
            if (updates.views !== undefined) dbUpdates.views = updates.views;
            if (updates.likes !== undefined) dbUpdates.likes = updates.likes;
            
            const response = await fetch(`/api/templates/${templateId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ updates: dbUpdates })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
        } catch(e: any) {
            const msg = e.message?.toLowerCase() || '';
            if (retryCount < 2 && (msg.includes('fetch') || msg.includes('timeout') || msg.includes('timed out'))) {
                await new Promise(r => setTimeout(r, 1000));
                return attempt(retryCount + 1);
            }
        }
    };

    return attempt();
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
    const attempt = async (retryCount = 0): Promise<void> => {
        try {
            const response = await fetch(`/api/templates/${templateId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('templr-data-update', { detail: { type: 'delete', id: templateId } }));
            }
        } catch (e: any) {
            const msg = e.message?.toLowerCase() || '';
            if (retryCount < 2 && (msg.includes('fetch') || msg.includes('timeout') || msg.includes('timed out'))) {
                await new Promise(r => setTimeout(r, 1000));
                return attempt(retryCount + 1);
            }
            throw new Error(e.message || "Connection failed while deleting.");
        }
    };

    return attempt();
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const uploadFileFromUrl = async (url: string): Promise<{ url: string; host: string }> => {
    if (!url) throw new Error("No URL provided for upload.");
    
    try {
        const response = await fetch('/api/upload/url', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Upload from URL failed: ${response.statusText}`);
        }

        const data = await response.json();
        return { url: data.url, host: data.host };
    } catch (err: any) {
        throw new Error("Upload from URL failed: " + err.message);
    }
};

export const uploadFile = async (file: File, path: string): Promise<{ url: string; host: string }> => {
    if (!file) throw new Error("No file provided for upload.");
    
    // Use specialized image upload service for images to ensure iimg.live prioritization and verification
    if (file.type.startsWith('image/')) {
        try {
            const result = await uploadImage(file);
            return { url: result.direct_url, host: result.provider };
        } catch (err) {
        }
    }

    if (!isApiConfigured) {
        return { url: URL.createObjectURL(file), host: 'Local/Mock' };
    }
    
    // Sanitize path just in case
    const safePath = path.replace(/[^a-zA-Z0-9/._-]/g, '_');

    const attempt = async (retryCount = 0): Promise<{ url: string; host: string }> => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('path', safePath);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const contentType = response.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'File upload failed');
                } else {
                    const errorText = await response.text();
                    throw new Error(`File upload failed: ${errorText.substring(0, 100)}`);
                }
            }

            const data = await response.json();
            return { url: fixUrl(data.url), host: data.host || 'Supabase Storage' };
        } catch (e: any) {
            if (retryCount < 2) {
                await new Promise(r => setTimeout(r, 1000));
                return attempt(retryCount + 1);
            }
            throw new Error("Upload failed: " + e.message);
        }
    };

    return attempt();
};

export const getSession = async (): Promise<Session | null> => {
    try {
        // supabase.auth.getSession() can throw "Failed to fetch" if Supabase is unreachable
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
            if (error.message?.includes('Refresh Token') || error.message?.includes('refresh_token')) {
                await supabase.auth.signOut();
                return null;
            }
            return null;
        }
        
        if (!data || !data.session) return null;
        return {
            user: {
                id: data.session.user.id,
                email: data.session.user.email,
                user_metadata: {
                    ...data.session.user.user_metadata,
                    avatar_url: fixUrl(data.session.user.user_metadata.avatar_url),
                    banner_url: fixUrl(data.session.user.user_metadata.banner_url)
                }
            }
        };
    } catch (e: any) {
        return null;
    }
};

export const onAuthStateChange = (callback: (event: AuthChangeEvent, session: Session | null) => void) => {
    try {
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session: any) => {
            if (event === 'SIGNED_OUT') {
                // Clear any stale data if needed
                callback('SIGNED_OUT', null);
                return;
            }

            // Handle token refresh errors that might come through as events or session updates
            if (event === 'TOKEN_REFRESHED') {
            }

            const mappedSession = session ? {
                user: {
                    id: session.user.id,
                    email: session.user.email,
                    user_metadata: {
                        ...session.user.user_metadata,
                        avatar_url: fixUrl(session.user.user_metadata?.avatar_url),
                        banner_url: fixUrl(session.user.user_metadata?.banner_url)
                    }
                }
            } : null;
            callback(event as any, mappedSession as any);
        });
        return subscription;
    } catch (e: any) {
        return { unsubscribe: () => {} };
    }
};



export const signInWithEmail = async (email: string, pass: string) => {
    if (!isApiConfigured) {
        return { 
            session: { 
                user: { 
                    id: 'mock-user-id', 
                    email: email, 
                    user_metadata: { full_name: 'Mock User' } 
                } 
            }, 
            error: null 
        };
    }

    try {
        // Force sign out first to clear any stale state that might cause "Refresh Token Not Found"
        // This is a nuclear fix for the specific error the user is seeing.
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError) {}

        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: pass,
        });

        if (error) throw error;
        
        // Map session to our format
        if (data.session) {
            return {
                session: {
                    user: {
                        id: data.session.user.id,
                        email: data.session.user.email,
                        user_metadata: {
                            ...data.session.user.user_metadata,
                            avatar_url: fixUrl(data.session.user.user_metadata.avatar_url),
                            banner_url: fixUrl(data.session.user.user_metadata.banner_url)
                        }
                    }
                },
                error: null
            };
        }
        return { session: null, error: "No session returned" };

    } catch (e: any) {
        throw e;
    }
};


export const signUpWithEmail = async (email: string, pass: string, name: string) => {
    if (!isApiConfigured) {
        throw new Error("Supabase is not configured. Please check your environment variables.");
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password: pass,
            options: {
                data: {
                    full_name: name,
                    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
                }
            }
        });

        if (error) throw error;
        
        return data;
    } catch (e: any) {
        throw new Error(e.message || "Signup failed");
    }
};

export const signOut = async () => {
    try {
        await supabase.auth.signOut();
    } catch (e) {}
};
