
import { supabase } from './src/services/supabaseClient';
import { uploadImage } from './src/services/imageUploadService';

// ==========================================
//   TEMPLR PRODUCTION ENGINE v10.0 (GITHUB)
// ==========================================

export const signInWithGoogle = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
    });
    if (error) throw error;
    return data;
};

export const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });
    if (error) throw error;
    
    if (!data.session) return { ...data, session: null };

    const mappedSession: Session = {
        user: {
            id: data.session.user.id,
            uid: data.session.user.id,
            email: data.session.user.email || '',
            user_metadata: {
                full_name: data.session.user.user_metadata?.full_name || '',
                avatar_url: fixUrl(data.session.user.user_metadata?.avatar_url || ''),
            }
        }
    };
    return { ...data, session: mappedSession };
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                full_name: name,
            },
        },
    });
    if (error) throw error;
    
    if (!data.session) return { ...data, session: null };

    const mappedSession: Session = {
        user: {
            id: data.session.user.id,
            uid: data.session.user.id,
            email: data.session.user.email || '',
            user_metadata: {
                full_name: data.session.user.user_metadata?.full_name || '',
                avatar_url: fixUrl(data.session.user.user_metadata?.avatar_url || ''),
            }
        }
    };
    return { ...data, session: mappedSession };
};

export const signOutUser = async () => {
    await supabase.auth.signOut();
};

export const onAuthStateChange = (callback: (event: string, session: Session | null) => void) => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session) {
            const mappedSession: Session = {
                user: {
                    id: session.user.id,
                    uid: session.user.id,
                    email: session.user.email || '',
                    user_metadata: {
                        full_name: session.user.user_metadata?.full_name || '',
                        avatar_url: fixUrl(session.user.user_metadata?.avatar_url || ''),
                    }
                }
            };
            callback('SIGNED_IN', mappedSession);
        } else if (event === 'SIGNED_OUT') {
            callback('SIGNED_OUT', null);
        }
    });
    return { unsubscribe: () => subscription.unsubscribe() };
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
  template_url?: string;
  sourceCode?: string;
  uploadHost?: string;
  initialStatus?: 'pending_review' | 'draft' | 'approved';
}

export type Session = {
  user: {
    id: string;
    uid: string;
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
  template_url?: string;
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
  uploadHost?: string;
  author_uid?: string;
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
        const rawImage = data.preview_media || data.image_url || data.imageUrl || data.image || data.thumbnail || data.thumbnail_url || data.thumbnailUrl || data.preview_image || data.previewImage || data.preview_url || data.previewUrl || data.preview || data.cover_image || data.coverImage || data.cover || data.photo || data.picture || data.screenshot || data.screenshot_url || data.screenshotUrl || data.media || data.media_url || data.mediaUrl || (data.images && data.images[0]) || (data.gallery_images && data.gallery_images[0]) || (data.galleryImages && data.galleryImages[0]);
        const rawBanner = data.banner_url || data.bannerUrl || data.banner || rawImage;
        const rawAvatar = data.creator_avatar || data.author_avatar || data.authorAvatar || data.avatar_url || data.avatarUrl || data.avatar || data.profile_pic || data.profilePic || data.profile_image || data.profileImage;
        const rawAuthorBanner = data.author_banner || data.authorBanner || data.profile_banner || data.profileBanner;
        const rawVideo = data.video_url || data.videoUrl || data.video || data.preview_video || data.previewVideo;

        console.log(`[API] Mapping template ${data.id}. Data:`, {
            file_url: data.file_url,
            fileUrl: data.fileUrl,
            source_code: data.source_code,
            sourceCode: data.sourceCode,
            data: data
        });

        return {
            id: data.id?.toString() || Math.random().toString(),
            title: data.title || data.name || 'Untitled',
            author: data.author_name || data.authorName || data.author || 'Anonymous', 
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
            fileUrl: data.file_url || data.fileUrl,
            fileName: data.file_name || data.fileName,
            fileType: inferredType,
            fileSize: data.file_size || data.fileSize,
            sourceCode: data.source_code || data.sourceCode || '', 
            status: (() => {
                console.log(`[API] Mapping template ${data.id}. Full data:`, data);
                const s = data.status || 'pending_review';
                console.log(`[API] Mapping template ${data.id} with status: ${s}`);
                return s;
            })(),
            sales: data.sales || 0,
            earnings: data.earnings || 0,
            uploadHost: data.upload_host || data.uploadHost,
            author_uid: data.author_uid || data.authorUid,
            createdAt: data.created_at?.seconds ? data.created_at.seconds * 1000 : 
                      (data.created_at instanceof Date ? data.created_at.getTime() : 
                      (typeof data.created_at === 'string' ? new Date(data.created_at).getTime() : 
                      (data.createdAt ? new Date(data.createdAt).getTime() : Date.now()))),
        };
    } catch (e) {
        console.error("Error mapping template:", e, data);
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

export const getPublicTemplates = async (
    page: number = 0, 
    limitNum: number = 6, 
    searchQuery: string = '', 
    category: string = 'All',
    sortBy: 'newest' | 'popular' | 'likes' = 'newest',
    currentUserId?: string
): Promise<{ data: Template[], hasMore: boolean, error?: string }> => {
    try {
        const url = `/api/templates?page=${page}&limit=${limitNum}&category=${category}&searchQuery=${searchQuery}&sortBy=${sortBy}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            const text = await response.text();
            console.error(`[API Debug] Server returned ${response.status} for ${url}. Body: ${text.substring(0, 100)}`);
            throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error(`[API Debug] Expected JSON but received ${contentType} for ${url}. Body start: ${text.substring(0, 100)}`);
            throw new Error(`Invalid response format: Expected JSON but received ${contentType}`);
        }

        const result = await response.json();
        
        // Map data to Template interface
        const data = (result.data || []).map((t: any) => mapTemplate(t));
        
        return { data, hasMore: result.hasMore || false };
    } catch (e: any) {
        console.error("Error fetching public templates:", e.message || e);
        return { data: [], hasMore: false, error: e.message || "Connection failed" };
    }
};

export const getTemplateById = async (id: string): Promise<Template | null> => {
    try {
        const response = await fetch(`/api/templates/${id}`);
        if (!response.ok) return null;
        const result = await response.json();
        return mapTemplate(result.template);
    } catch (e: any) {
        console.error("Error fetching template:", e);
        return null;
    }
};

export const getFeaturedCreators = async (): Promise<CreatorStats[]> => {
    try {
        const response = await fetch('/api/creators');
        if (!response.ok) throw new Error("Failed to fetch featured creators");
        const result = await response.json();
        return result.data;
    } catch (e: any) {
        console.error("Error fetching featured creators:", e);
        return [];
    }
};

export const listenForUserTemplates = (userId: string, userEmail: string | undefined, callback: (templates: Template[]) => void) => {
    if (!userId) { callback([]); return { unsubscribe: () => {} }; }
    
    let interval: any;
    const fetchTemplates = async () => {
        try {
            const url = `/api/user/templates?email=${encodeURIComponent(userEmail || '')}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                const text = await response.text();
                console.error(`[API Debug] Server returned ${response.status} for ${url}. Body: ${text.substring(0, 100)}`);
                throw new Error(`Server error (${response.status}): ${text.substring(0, 100)}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error(`[API Debug] Expected JSON but received ${contentType} for ${url}. Body start: ${text.substring(0, 100)}`);
                throw new Error(`Invalid response format: Expected JSON but received ${contentType}`);
            }

            const result = await response.json();
            if (result.error) {
                console.error(`[API Debug] Server returned error in JSON for ${url}: ${result.error}`);
                throw new Error(result.error);
            }
            callback(result.data.map((t: any) => mapTemplate(t)));
        } catch (e: any) {
            console.error("Error fetching user templates:", e.message || e);
        }
    };
    
    fetchTemplates();
    interval = setInterval(fetchTemplates, 5000);
    
    return { unsubscribe: () => clearInterval(interval) };
};

export const addTemplate = async (templateData: NewTemplateData, user?: Session['user'] | null): Promise<Template> => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();

    if (!currentUser) throw new Error("Authentication required.");

    const templatePayload = {
        title: templateData.title,
        preview_image: unfixUrl(templateData.imageUrl),
        banner_url: unfixUrl(templateData.bannerUrl || templateData.imageUrl),
        category: templateData.category,
        price: templateData.price,
        author_name: currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Anonymous',
        author_email: currentUser.email,
        author_avatar: unfixUrl(currentUser.user_metadata?.avatar_url),
        file_name: templateData.fileName || 'Project Files',
        file_type: templateData.fileType || 'link',
        file_size: templateData.fileSize || 0,
        status: templateData.initialStatus === 'draft' ? 'draft' : 'approved',
        tags: templateData.tags || [],
        description: templateData.description,
        video_url: unfixUrl(templateData.videoUrl),
        gallery_images: (templateData.galleryImages || []).map(unfixUrl),
        template_url: templateData.template_url || '',
        file_url: unfixUrl(templateData.fileUrl || templateData.externalLink),
        upload_host: templateData.uploadHost,
        author_uid: currentUser.id
    };

    try {
        const response = await fetch('/api/templates', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template: templatePayload })
        });
        if (!response.ok) throw new Error("Failed to add template");
        const result = await response.json();
        return mapTemplate(result.template);
    } catch (error: any) {
        console.error("Error adding template:", error);
        throw new Error(error.message || "Error saving template.");
    }
};

export const updateTemplateData = async (id: string, data: Partial<NewTemplateData>, userEmail: string): Promise<void> => {
    const updates: any = {};
    if (data.title) updates.title = data.title;
    if (data.description) updates.description = data.description;
    if (data.category) updates.category = data.category;
    if (data.tags) updates.tags = data.tags;
    if (data.externalLink) updates.file_url = unfixUrl(data.externalLink);
    if (data.imageUrl) updates.preview_image = unfixUrl(data.imageUrl);
    if (data.bannerUrl) updates.banner_url = unfixUrl(data.bannerUrl);
    if (data.videoUrl) updates.video_url = unfixUrl(data.videoUrl);
    if (data.template_url) updates.template_url = data.template_url;
    if (data.fileUrl) updates.file_url = unfixUrl(data.fileUrl);
    if (data.initialStatus) updates.status = data.initialStatus === 'draft' ? 'draft' : 'approved';

    try {
        const response = await fetch(`/api/templates/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
        });
        if (!response.ok) throw new Error("Failed to update template");
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('templr-data-update', { detail: { type: 'update', id } }));
        }
    } catch (error: any) {
        console.error("Error updating template data:", error);
        throw new Error(error.message || "Error updating template.");
    }
};

export const updateUserProfile = async (updates: { full_name?: string; avatar_url?: string; banner_url?: string }) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");
  
  const dbUpdates: any = { ...updates };
  if (dbUpdates.avatar_url) dbUpdates.avatar_url = unfixUrl(dbUpdates.avatar_url);
  if (dbUpdates.banner_url) dbUpdates.banner_url = unfixUrl(dbUpdates.banner_url);

  try {
      // Use backend API instead of Firestore
      const response = await fetch('/api/user/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates, uid: user.id })
      });
      
      if (!response.ok) throw new Error("Failed to update profile");
      
      return { user: { ...user, user_metadata: { ...user.user_metadata, ...updates } } };
  } catch (e: any) {
      console.error("Error updating profile:", e);
      throw e;
  }
};

export const updateUserUsage = async (count: number) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  
  try {
      // Use backend API instead of Firestore
      await fetch('/api/user/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ updates: { usage_count: count }, uid: user.id })
      });
  } catch (e: any) {
      console.error("Sync usage error:", e);
  }
};

export const setProStatus = async (status: boolean) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    try {
        // Use backend API instead of Firestore
        await fetch('/api/user/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates: { is_pro: status }, uid: user.id })
        });
    } catch (e: any) {
        console.error("Pro Status update failed:", e);
    }
};

export const updateTemplate = async (templateId: string, updates: Partial<Template>): Promise<void> => {
    try {
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ updates })
        });
        if (!response.ok) throw new Error("Failed to update template");
    } catch(e: any) {
        console.error("Error updating template:", e);
    }
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
    try {
        const response = await fetch(`/api/templates/${templateId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error("Failed to delete template");

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('templr-data-update', { detail: { type: 'delete', id: templateId } }));
        }
    } catch (e: any) {
        console.error("Error deleting template:", e);
        throw new Error(e.message || "Error deleting template.");
    }
};

const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
};

export const getSession = async (): Promise<Session | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;
    
    return {
        user: {
            id: session.user.id,
            uid: session.user.id,
            email: session.user.email || '',
            user_metadata: {
                full_name: session.user.user_metadata?.full_name || '',
                avatar_url: fixUrl(session.user.user_metadata?.avatar_url || ''),
            }
        }
    };
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
    
    // Use specialized image upload service for images to ensure external hosting prioritization
    if (file.type.startsWith('image/')) {
        try {
            const result = await uploadImage(file);
            return { url: result.direct_url, host: result.provider };
        } catch (err: any) {
            console.warn("[Upload] Client-side uploadImage failed, falling back to backend:", err.message);
        }
    }

    // Sanitize path just in case
    const safePath = path.replace(/[^a-zA-Z0-9/._-]/g, '_');

    const attempt = async (retryCount = 0): Promise<{ url: string; host: string }> => {
        try {
            const base64File = await fileToBase64(file);
            
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ file: base64File, path: safePath })
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
            return { url: data.url, host: data.host };
        } catch (err: any) {
            if (retryCount < 2) {
                await new Promise(r => setTimeout(r, 1000));
                return attempt(retryCount + 1);
            }
            throw new Error("Upload failed: " + err.message);
        }
    };
    return attempt();
};
