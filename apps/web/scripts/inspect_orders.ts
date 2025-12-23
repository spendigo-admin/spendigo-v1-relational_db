import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";
import 'dotenv/config';

const firebaseConfig = {
    apiKey: process.env.VITE_FIREBASE_API_KEY,
    authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspectOrders() {
    console.log("Checking orders...");
    const snap = await getDocs(collection(db, "orders"));
    console.log(`Total Orders: ${snap.size}`);

    if (snap.empty) {
        console.log("No orders found.");
        return;
    }

    snap.forEach(doc => {
        const d = doc.data();
        console.log(`Order ${doc.id}:`);
        console.log(`  - Date: ${d.date}`);
        console.log(`  - StoreId: ${d.storeId} (Type: ${typeof d.storeId})`);
        console.log(`  - PaymentStatus: ${d.paymentStatus}`);
        console.log(`  - Total: ${d.total}`);
    });
}

inspectOrders().catch(console.error);
