import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-app-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "your-id",
  appId: "your-app-id"
};

// Initialize Firebase and the Database
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
