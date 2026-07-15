"use client";

import { type FirebaseApp, getApps, initializeApp } from "firebase/app";
import {
  type Auth,
  connectAuthEmulator,
  getAuth,
} from "firebase/auth";
import {
  type Firestore,
  connectFirestoreEmulator,
  getFirestore,
} from "firebase/firestore";
import {
  type FirebaseStorage,
  connectStorageEmulator,
  getStorage,
} from "firebase/storage";

import { getClientEnv, isUsingEmulators } from "@/config/env";

/**
 * Inicialização centralizada do Firebase Client SDK.
 *
 * Regras:
 * - Nunca inicializar mais de uma vez (evita erros em hot-reload/dev).
 * - Nunca conter valores fixos ou segredos — tudo vem de variáveis de ambiente validadas por Zod.
 * - Conectar aos emuladores apenas em desenvolvimento, quando explicitamente habilitado.
 */

let app: FirebaseApp;
let auth: Auth;
let firestore: Firestore;
let storage: FirebaseStorage;
let emulatorsConnected = false;

function initFirebaseClient() {
  if (getApps().length > 0) {
    app = getApps()[0]!;
  } else {
    const env = getClientEnv();
    app = initializeApp({
      apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  }

  auth = getAuth(app);
  firestore = getFirestore(app);
  storage = getStorage(app);

  if (isUsingEmulators() && !emulatorsConnected) {
    // As portas seguem os padrões definidos em firebase.json.
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    connectStorageEmulator(storage, "127.0.0.1", 9199);
    emulatorsConnected = true;
  }

  return { app, auth, firestore, storage };
}

export function getFirebaseClient() {
  return initFirebaseClient();
}

export function getFirebaseAuth(): Auth {
  return initFirebaseClient().auth;
}

export function getFirebaseFirestore(): Firestore {
  return initFirebaseClient().firestore;
}

export function getFirebaseStorage(): FirebaseStorage {
  return initFirebaseClient().storage;
}
