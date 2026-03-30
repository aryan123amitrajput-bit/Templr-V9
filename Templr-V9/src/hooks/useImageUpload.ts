import { useState } from 'react';
import { uploadImage, UploadResult } from '../services/imageUploadService';

export const useImageUpload = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const upload = async (file: File): Promise<UploadResult | null> => {
        setLoading(true);
        setError(null);
        try {
            const result = await uploadImage(file);
            return result;
        } catch (err) {
            setError('Failed to upload image after multiple attempts.');
            console.error(err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    const uploadFromUrl = async (url: string): Promise<UploadResult | null> => {
        setLoading(true);
        setError(null);
        try {
            const { uploadFromUrl: serviceUploadFromUrl } = await import('../services/imageUploadService');
            const result = await serviceUploadFromUrl(url);
            return result;
        } catch (err) {
            setError('Failed to upload image from URL.');
            console.error(err);
            return null;
        } finally {
            setLoading(false);
        }
    };

    return { upload, uploadFromUrl, loading, error };
};
