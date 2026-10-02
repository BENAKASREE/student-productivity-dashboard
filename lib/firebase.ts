
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDH2l0x1NuqDhO5WzSXvfsUEy7qz0owgqE",
  authDomain: "student-task-dashboard.firebaseapp.com",
  projectId: "student-task-dashboard",
  storageBucket: "student-task-dashboard.firebasestorage.app",
  messagingSenderId: "290372218088",
  appId: "1:290372218088:web:8f86ca8c00ef5798f22d5d",
  measurementId: "G-XMR8F8TCXC",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);