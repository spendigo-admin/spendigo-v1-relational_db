import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { useNotifications } from '../context/NotificationContext';

export const useFileUpload = () => {
    const [uploading, setUploading] = useState(false);
    const { addNotification } = useNotifications();

    const uploadFile = async (
        file: File,
        path: string,
        maxSizeMB: number = 2
    ): Promise<string | null> => {
        // Validation
        if (file.size > maxSizeMB * 1024 * 1024) {
            addNotification({
                type: 'alert',
                title: 'File Too Large',
                message: `Image must be under ${maxSizeMB}MB.`
            });
            return null;
        }

        if (!file.type.startsWith('image/')) {
            addNotification({
                type: 'alert',
                title: 'Invalid File',
                message: 'Please upload a valid image file (JPG, PNG).'
            });
            return null;
        }

        try {
            setUploading(true);
            const storageRef = ref(storage, path);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(snapshot.ref);
            return downloadUrl;
        } catch (error: any) {
            console.error('Upload failed:', error);
            addNotification({
                type: 'alert',
                title: 'Upload Failed',
                message: error.message || 'Could not upload image.'
            });
            return null;
        } finally {
            setUploading(false);
        }
    };

    const deleteFile = async (url: string | null) => {
        if (!url || !url.includes('firebase')) return; // Ignore external URLs or nulls
        try {
            // Extract path from URL roughly or use refFromURL if available in newer SDKs
            // Simple approach: Create a ref from the full URL
            const fileRef = ref(storage, url);
            const { deleteObject } = await import('firebase/storage');
            await deleteObject(fileRef);
            console.log('Deleted old file:', url);
        } catch (error) {
            console.warn('Failed to delete old file (might not exist):', error);
            // Non-blocking error
        }
    };

    return { uploadFile, deleteFile, uploading };
};
