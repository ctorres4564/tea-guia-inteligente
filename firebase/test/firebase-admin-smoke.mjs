import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { cert, deleteApp, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

function parseEnvFile(contents) {
  return Object.fromEntries(
    contents
      .split(/\r?\n/)
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1).replace(/^"|"$/g, "")];
      }),
  );
}

const root = resolve(import.meta.dirname, "../..");
const serviceAccountPath = resolve(root, "serviceAccountKey.json");
const [serviceAccountText, envText] = await Promise.all([
  readFile(serviceAccountPath, "utf8"),
  readFile(resolve(root, ".env.local"), "utf8"),
]);
const serviceAccount = JSON.parse(serviceAccountText);
const env = parseEnvFile(envText);

if (serviceAccount.project_id !== env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
  throw new Error("A conta de serviço e o Firebase Client apontam para projetos diferentes.");
}

const app = initializeApp({
  credential: cert(serviceAccount),
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
});
const auth = getAuth(app);
const firestore = getFirestore(app);
const bucket = getStorage(app).bucket();
const runId = randomUUID();
const email = `codex.firebase.smoke+${runId}@example.com`;
const password = `T3st!${runId}`;
const documentRef = firestore.collection("_codexIntegrationTests").doc(runId);
const objectRef = bucket.file(`internal/codex-integration-tests/${runId}/pixel.png`);
const imageBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);
let uid;
const results = {};
let testError;

try {
  const user = await auth.createUser({ email, password, emailVerified: true });
  uid = user.uid;
  results.authCadastro = user.email === email;

  const loginResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const loginPayload = await loginResponse.json();
  results.authLogin = loginResponse.ok && Boolean(loginPayload.idToken);
  if (!results.authLogin) throw new Error("Falha no login do usuário administrativo de teste.");

  await documentRef.set({ runId, uid, createdAt: new Date() });
  const documentSnapshot = await documentRef.get();
  results.firestoreCriacaoLeitura = documentSnapshot.exists;

  await objectRef.save(imageBytes, { metadata: { contentType: "image/png" } });
  const [downloadedBytes] = await objectRef.download();
  results.storageUploadDownload = downloadedBytes.equals(imageBytes);

  if (Object.values(results).some((value) => value !== true)) {
    throw new Error("Uma ou mais verificações administrativas falharam.");
  }

} catch (error) {
  testError = error;
} finally {
  const cleanupResults = await Promise.allSettled([
    objectRef.delete(),
    documentRef.delete(),
    uid ? auth.deleteUser(uid) : Promise.resolve(),
  ]);
  results.limpeza = cleanupResults.every((result) => result.status === "fulfilled");
  await deleteApp(app);
}

if (testError) throw testError;
if (!results.limpeza) throw new Error("Falha ao remover um ou mais dados temporários.");

console.log(JSON.stringify({ ok: true, results }, null, 2));
