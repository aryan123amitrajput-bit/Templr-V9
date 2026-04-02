
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  updateDoc,
  Timestamp,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  onSnapshot,
  startAfter
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { uploadImage } from './src/services/imageUploadService';

// ==========================================
//   TEMPLR PRODUCTION ENGINE v10.0 (GITHUB)
// ==========================================

export const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        return { session: { user: result.user } };
    } catch (error) {
        console.error("Google Sign-In Error:", error);
        throw error;
    }
};

export const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    const user = result.user;
    const session = {
        user: {
            id: user.uid,
            uid: user.uid,
            email: user.email || '',
            user_metadata: {
                full_name: user.displayName || '',
                avatar_url: fixUrl(user.photoURL || ''),
                usage_count: 0,
                is_pro: false
            }
        }
    };
    return { session };
};

export const signUpWithEmail = async (email: string, password: string, name: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName: name });
    const user = result.user;
    const session = {
        user: {
            id: user.uid,
            uid: user.uid,
            email: user.email || '',
            user_metadata: {
                full_name: name,
                avatar_url: fixUrl(user.photoURL || ''),
                usage_count: 0,
                is_pro: false
            }
        }
    };
    return { session };
};

export const signOutUser = async () => {
    await signOut(auth);
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
    return onAuthStateChanged(auth, (user) => {
        if (user) {
            const session = {
                user: {
                    id: user.uid,
                    uid: user.uid,
                    email: user.email,
                    user_metadata: {
                        full_name: user.displayName,
                        avatar_url: user.photoURL,
                        usage_count: 0, // Will be fetched from Firestore
                        is_pro: false   // Will be fetched from Firestore
                    }
                }
            };
            callback('SIGNED_IN', session);
        } else {
            callback('SIGNED_OUT', null);
        }
    });
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
        const rawImage = data.preview_media || data.image_url || data.imageUrl || data.image || data.thumbnail || data.thumbnail_url || data.thumbnailUrl || data.preview_url || data.previewUrl || data.preview_image || data.previewImage || data.preview || data.cover_image || data.coverImage || data.cover || data.photo || data.picture || data.screenshot || data.screenshot_url || data.screenshotUrl || data.media || data.media_url || data.mediaUrl || (data.images && data.images[0]) || (data.gallery_images && data.gallery_images[0]) || (data.galleryImages && data.galleryImages[0]);
        const rawBanner = data.banner_url || data.bannerUrl || data.banner || rawImage;
        const rawAvatar = data.creator_avatar || data.author_avatar || data.authorAvatar || data.avatar_url || data.avatarUrl || data.avatar || data.profile_pic || data.profilePic || data.profile_image || data.profileImage;
        const rawAuthorBanner = data.author_banner || data.authorBanner || data.profile_banner || data.profileBanner;
        const rawVideo = data.video_url || data.videoUrl || data.video || data.preview_video || data.previewVideo;

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
            fileUrl: data.file_url,
            fileName: data.file_name,
            fileType: inferredType,
            fileSize: data.file_size,
            sourceCode: data.source_code || '', 
            status: (() => {
                console.log(`[API] Mapping template ${data.id}. Full data:`, data);
                const s = data.status || 'pending_review';
                console.log(`[API] Mapping template ${data.id} with status: ${s}`);
                return s;
            })(),
            sales: data.sales || 0,
            earnings: data.earnings || 0,
            uploadHost: data.upload_host,
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
        let q = query(collection(db, 'templates'), where('status', '==', 'approved'));
        
        if (category !== 'All') {
            q = query(q, where('category', '==', category));
        }

        // Note: Firestore doesn't support full-text search natively well without external services.
        // We will fetch more and filter client-side if there's a search query.
        const fetchLimit = searchQuery ? 50 : limitNum + 1;
        
        if (sortBy === 'popular' || sortBy === 'likes') {
            q = query(q, orderBy('likes', 'desc'), limit(fetchLimit));
        } else {
            q = query(q, orderBy('created_at', 'desc'), limit(fetchLimit));
        }

        const querySnapshot = await getDocs(q);
        let results: any[] = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            results = results.filter(t => 
                (t.title && t.title.toLowerCase().includes(lowerQuery)) ||
                (t.description && t.description.toLowerCase().includes(lowerQuery)) ||
                (t.author_name && t.author_name.toLowerCase().includes(lowerQuery))
            );
        }

        const hasMore = results.length > limitNum;
        if (hasMore) {
            results = results.slice(0, limitNum);
        }

        const data = results.map((t: any) => mapTemplate(t)).filter((t: Template) => {
            const titleLower = t.title.toLowerCase();
            const isAnonymous = titleLower.includes('anonymous');
            const hasNumbers = /\d/.test(t.title);
            return !isAnonymous && !hasNumbers;
        });
        
        return { data, hasMore };
    } catch (e: any) {
        console.error("Error fetching public templates:", e);
        return { data: [], hasMore: false, error: e.message || "Connection failed" };
    }
};

export const getTemplateById = async (id: string): Promise<Template | null> => {
    try {
        const docRef = doc(db, 'templates', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return mapTemplate({ id: docSnap.id, ...docSnap.data() });
        }
        return null;
    } catch (e: any) {
        console.error("Error fetching template:", e);
        return null;
    }
};

export const getFeaturedCreators = async (): Promise<CreatorStats[]> => {
    try {
        const q = query(collection(db, 'templates'), where('status', '==', 'approved'));
        const querySnapshot = await getDocs(q);
        
        const statsMap = new Map<string, CreatorStats>();
        
        querySnapshot.docs.forEach(doc => {
            const t = doc.data();
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

        const allCreators = Array.from(statsMap.values())
            .sort((a, b) => b.totalViews - a.totalViews)
            .slice(0, 20);

        // Shuffle
        for (let i = allCreators.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCreators[i], allCreators[j]] = [allCreators[j], allCreators[i]];
        }

        return allCreators.slice(0, 4).map(c => ({
            ...c,
            role: c.totalViews > 1000 ? 'Top Seller' : 'Rising Star'
        }));
    } catch (e: any) {
        console.error("Error fetching featured creators:", e);
        return [];
    }
};

export const listenForUserTemplates = (userId: string, callback: (templates: Template[]) => void) => {
    if (!userId) { callback([]); return { unsubscribe: () => {} }; }
    
    const q = query(collection(db, 'templates'), where('author_uid', '==', userId), orderBy('created_at', 'desc'));
    
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
        const templates = querySnapshot.docs.map(doc => mapTemplate({ id: doc.id, ...doc.data() }));
        callback(templates);
    }, (error) => {
        console.error("Error listening for user templates:", error);
    });
    
    return { unsubscribe };
};

export const addTemplate = async (templateData: NewTemplateData, user?: Session['user'] | null): Promise<Template> => {
    const currentUser = user || (auth.currentUser ? { 
        uid: auth.currentUser.uid, 
        id: auth.currentUser.uid, 
        email: auth.currentUser.email || '', 
        user_metadata: { 
            full_name: auth.currentUser.displayName || '', 
            avatar_url: auth.currentUser.photoURL || '' 
        } 
    } : null);

    if (!currentUser || !currentUser.uid) throw new Error("Authentication required.");

    const templatePayload = {
        title: templateData.title,
        preview_image: unfixUrl(templateData.imageUrl),
        banner_url: unfixUrl(templateData.bannerUrl || templateData.imageUrl),
        category: templateData.category,
        price: templateData.price,
        author_name: currentUser.user_metadata?.full_name || currentUser.email.split('@')[0],
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
        author_uid: currentUser.uid,
        created_at: Timestamp.now(),
        views: 0,
        likes: 0,
        sales: 0,
        earnings: 0
    };

    try {
        const docRef = await addDoc(collection(db, 'templates'), templatePayload);
        return mapTemplate({ id: docRef.id, ...templatePayload });
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
        const docRef = doc(db, 'templates', id);
        await updateDoc(docRef, updates);
        
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('templr-data-update', { detail: { type: 'update', id } }));
        }
    } catch (error: any) {
        console.error("Error updating template data:", error);
        throw new Error(error.message || "Error updating template.");
    }
};

export const updateUserProfile = async (updates: { full_name?: string; avatar_url?: string; banner_url?: string }) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Authentication required.");
  
  const dbUpdates: any = { ...updates };
  if (dbUpdates.avatar_url) dbUpdates.avatar_url = unfixUrl(dbUpdates.avatar_url);
  if (dbUpdates.banner_url) dbUpdates.banner_url = unfixUrl(dbUpdates.banner_url);

  try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
          display_name: updates.full_name,
          avatar_url: dbUpdates.avatar_url,
          banner_url: dbUpdates.banner_url,
          updated_at: Timestamp.now()
      }, { merge: true });

      // Also update templates author info if needed (optional, can be done via cloud functions)
      // For now, let's just update the user profile.
      
      return { user: { ...user, user_metadata: { ...user.providerData[0], ...updates } } };
  } catch (e: any) {
      console.error("Error updating profile:", e);
      throw e;
  }
};

export const updateUserUsage = async (count: number) => {
  const user = auth.currentUser;
  if (!user) return;
  
  try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { usage_count: count });
  } catch (e: any) {
      console.error("Sync usage error:", e);
  }
};

export const setProStatus = async (status: boolean) => {
    const user = auth.currentUser;
    if (!user) return;
    
    try {
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { is_pro: status });
    } catch (e: any) {
        console.error("Pro Status update failed:", e);
    }
};

export const updateTemplate = async (templateId: string, updates: Partial<Template>): Promise<void> => {
    try {
        const docRef = doc(db, 'templates', templateId);
        await updateDoc(docRef, updates);
    } catch(e: any) {
        console.error("Error updating template:", e);
    }
};

export const deleteTemplate = async (templateId: string): Promise<void> => {
    try {
        const docRef = doc(db, 'templates', templateId);
        await deleteDoc(docRef);

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
    const user = auth.currentUser;
    if (!user) return null;
    
    return {
        user: {
            id: user.uid,
            uid: user.uid,
            email: user.email || '',
            user_metadata: {
                full_name: user.displayName || '',
                avatar_url: fixUrl(user.photoURL || ''),
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

    // Use Telegram for all files
    try {
        const token = '8692277039:AAHQGo1sIRfBj6rYUrLO2yxUliuzEjijJPo';
        const chatId = '8187582649';
        
        const formData = new FormData();
        formData.append('document', file);
        
        const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument?chat_id=${chatId}`, {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) throw new Error('Telegram document upload failed');
        const data = await response.json();
        const fileId = data.result.document.file_id;
        
        const fileResponse = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
        const fileData = await fileResponse.json();
        const filePath = fileData.result.file_path;
        
        return { url: `https://api.telegram.org/file/bot${token}/${filePath}`, host: 'Telegram' };
    } catch (err: any) {
        console.warn("[Upload] Telegram document upload failed, falling back to backend:", err.message);
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
