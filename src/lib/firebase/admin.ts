import "server-only";

import {
  type App,
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { type Auth, getAuth } from "firebase-admin/auth";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

import { getAdminEnv } from "@/config/env";

/**
 * Inicialização centralizada do Firebase Admin SDK.
 *
 * IMPORTANTE:
 * - Este módulo é protegido por `server-only` e NUNCA deve ser importado
 *   em Client Components ("use client") ou em código que rode no navegador.
 * - As credenciais administrativas nunca devem ser expostas ao cliente.
 * - Inicializa apenas uma vez, mesmo em ambientes serverless com reuso de contexto.
 */

let adminApp: App | undefined;

function formatPrivateKey(key: string): string {
  // Variáveis de ambiente costumam armazenar quebras de linha escapadas ("\\n").
  return key.replace(/\\n/g, "\n");
}

function initFirebaseAdmin(): App {
  if (adminApp) return adminApp;

  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0]!;
    return adminApp;
  }

  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    // Desenvolvimento local: o SDK lê o JSON apontado pela variável padrão
    // do Google. O arquivo deve permanecer ignorado pelo Git.
    adminApp = initializeApp({ credential: applicationDefault() });
  } else {
    // Produção/Vercel: credenciais explícitas fornecidas por variáveis seguras.
    const env = getAdminEnv();
    adminApp = initializeApp({
      credential: cert({
        projectId: env.FIREBASE_ADMIN_PROJECT_ID,
        clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey: formatPrivateKey(env.FIREBASE_ADMIN_PRIVATE_KEY),
      }),
    });
  }

  return adminApp;
}

export function getAdminAuth(): Auth {
  return getAuth(initFirebaseAdmin());
}

export function getAdminFirestore(): Firestore {
  return getFirestore(initFirebaseAdmin());
}
