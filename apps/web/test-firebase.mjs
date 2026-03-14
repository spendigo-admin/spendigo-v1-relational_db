import { serverTimestamp } from 'firebase/firestore';
const ts = serverTimestamp();
console.log("TS:", ts);
console.log("has isEqual:", typeof ts.isEqual);
console.log("Is object?", typeof ts);
console.log("Keys:", Object.keys(ts));
