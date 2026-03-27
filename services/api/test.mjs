import admin from 'firebase-admin';
import { getDownloadURL } from 'firebase-admin/storage';
admin.initializeApp({ storageBucket: 'spendigo-8540c.firebasestorage.app' });
const file = admin.storage().bucket().file('products/mp-cottage-cheese-2-milkfat-minimum-small-curd-1039.jpg');
getDownloadURL(file).then(u => console.log('URL:', u)).catch(console.error);
