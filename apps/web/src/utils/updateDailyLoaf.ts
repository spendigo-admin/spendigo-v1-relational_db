import { db } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';

async function updateStore() {
    const q = query(collection(db, 'stores'), where('name', '==', 'Daily Loaf'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
        console.log('Daily Loaf not found');
        return;
    }

    for (const d of snapshot.docs) {
        await updateDoc(doc(db, 'stores', d.id), {
            business_category: 'Bakery',
            category: 'Bakery'
        });
        console.log(`Updated store ${d.id} to Bakery`);
    }
}

updateStore();
