"use client";

import { initializeApp, getApps } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseEnabled() {
  return Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_ENABLED === "true" &&
      firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId
  );
}

export function firebaseApp() {
  if (!isFirebaseEnabled()) {
    throw new Error("Firebase is not configured");
  }
  return getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
}

export async function signInWithFirebaseEmail(email: string, password: string) {
  const auth = getAuth(firebaseApp());
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user.getIdToken();
}

export async function signOutFirebase() {
  if (!isFirebaseEnabled()) return;
  await signOut(getAuth(firebaseApp()));
}

export async function requestFcmToken() {
  try {
    if (!isFirebaseEnabled()) return null;
    if (typeof window === "undefined" || !("Notification" in window)) return null;
    const supported = await isSupported();
    if (!supported) return null;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    const messaging = getMessaging(firebaseApp());
    return getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
  } catch (error) {
    console.error("FCM token registration failed", error);
    return null;
  }
}
