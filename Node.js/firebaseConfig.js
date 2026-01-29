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
import { db } from './firebaseConfig'; 
import { collection, addDoc, serverTimestamp } from "firebase/firestore"; 

// ... inside your AddItemForm component ...

const handleSubmit = async (e) => {
  e.preventDefault();

  try {
    // Reference the 'items' collection in Firestore
    const docRef = await addDoc(collection(db, "items"), {
      title: formData.title,
      description: formData.description,
      lookingFor: formData.lookingFor,
      category: formData.category,
      status: "available",
      createdAt: serverTimestamp(), // Syncs with Firebase server time
      ownerId: "current_user_id" // Replace with real Auth ID later
    });

    console.log("Document written with ID: ", docRef.id);
    alert("Item listed successfully!");
    
    // Reset form after success
    setFormData({ title: '', description: '', category: 'General', lookingFor: '' });
  } catch (error) {
    console.error("Error adding document: ", error);
    alert("Error uploading item. Try again.");
  }
};
