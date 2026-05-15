import { useState } from 'react';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { useNotifications } from '../context/NotificationContext';

export const useFileUpload = () => {
    const [uploading, setUploading] = useState(false);
    const { addNotification } = useNotifications();

    const uploadFile = async (
        file: File,
        path: string,
        maxSizeMB: number = 2,
        acceptedMimeTypes: string[] = ['image/', 'video/']
    ): Promise<string | null> => {
        // Validation
        if (file.size > maxSizeMB * 1024 * 1024) {
            addNotification({
                type: 'alert',
                title: 'File Too Large',
                message: `File must be under ${maxSizeMB}MB.`
            });
            return null;
        }

        const isAccepted = acceptedMimeTypes.some(prefix =>
            prefix.endsWith('/') ? file.type.startsWith(prefix) : file.type === prefix
        );
        if (!isAccepted) {
            addNotification({
                type: 'alert',
                title: 'Invalid File',
                message: 'Please upload a valid image, video, or PDF file.'
            });
            return null;
        }

        try {
            setUploading(true);

            // Create a timeout promise
            const timeout = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Upload timed out. Please check your connection.')), 30000);
            });

            const storageRef = ref(storage, path);

            // Race between upload and timeout
            const snapshot = await Promise.race([
                uploadBytes(storageRef, file),
                timeout
            ]) as any;

            const downloadUrl = await getDownloadURL(snapshot.ref);
            return downloadUrl;
        } catch (error: any) {
            console.error('Upload failed details:', {
                code: error.code,
                message: error.message,
                serverResponse: error.serverResponse,
                storageBucket: storage.app.options.storageBucket
            });

            let message = error.message || 'Could not upload image.';
            if (error.code === 'storage/unauthorized') {
                message = 'Permission denied. Please check your account access.';
            } else if (error.code === 'storage/canceled') {
                message = 'Upload cancelled.';
            } else if (error.code === 'storage/retry-limit-exceeded') {
                message = 'Network unstable. Please try again.';
            }

            addNotification({
                type: 'alert',
                title: 'Upload Failed',
                message: message
            });
            return null;
        } finally {
            setUploading(false);
        }
    };

    const deleteFile = async (url: string | null) => {
        if (!url || !url.includes('firebase')) return;
        try {
            const fileRef = ref(storage, url);
            await deleteObject(fileRef);
            console.log('Deleted old file:', url);
        } catch (error) {
            console.warn('Failed to delete old file (might not exist):', error);
        }
    };

    return { uploadFile, deleteFile, uploading };
};
