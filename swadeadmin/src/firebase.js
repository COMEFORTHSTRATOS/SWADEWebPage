// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions, httpsCallable } from 'firebase/functions';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyABVGMHxFC7sUebc8SIIl9rdqFIAfYf_sQ",
  authDomain: "swade-bfd94.firebaseapp.com",
  projectId: "swade-bfd94",
  storageBucket: "swade-bfd94.firebasestorage.app",
  messagingSenderId: "321407970582",
  appId: "1:321407970582:web:d0820d6f9131b171b83437",
  measurementId: "G-5436N9R614"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

// Function to toggle user's disabled status
export const toggleUserStatus = async (uid, disabled) => {
  const toggleUserStatusFn = httpsCallable(functions, 'toggleUserStatus');
  return toggleUserStatusFn({ uid, disabled });
};

// Function to delete a user
export const deleteUser = async (uid) => {
  const deleteUserFn = httpsCallable(functions, 'deleteUser');
  return deleteUserFn({ uid });
};

export { auth, db, storage };