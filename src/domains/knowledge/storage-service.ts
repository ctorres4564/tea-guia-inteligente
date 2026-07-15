"use client";

import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
} from "firebase/storage";

import { getFirebaseStorage } from "@/lib/firebase/client";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB — mantido em sincronia com firebase/storage.rules
const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export interface UploadedAttachment {
  path: string;
  url: string;
}

function assertValidFile(file: File): void {
  if (file.size >= MAX_FILE_SIZE_BYTES) {
    throw new Error("Arquivo muito grande. O limite é de 5 MB.");
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error("Tipo de arquivo não permitido. Envie PDF, PNG, JPG ou WEBP.");
  }
}

/**
 * Envia um material de apoio (imagem ou PDF) vinculado a uma ficha da base
 * de conhecimento. A escrita neste caminho (`/knowledge/{itemId}/...`) é
 * restrita a editores de conteúdo pelas regras do Storage
 * (`firebase/storage.rules`), que consultam o papel do usuário no Firestore.
 */
export async function uploadKnowledgeAttachment(
  itemId: string,
  file: File,
): Promise<UploadedAttachment> {
  assertValidFile(file);

  try {
    const storage = getFirebaseStorage();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `knowledge/${itemId}/${Date.now()}-${safeName}`;
    const fileRef = ref(storage, path);

    await uploadBytes(fileRef, file, { contentType: file.type });
    const url = await getDownloadURL(fileRef);

    return { path, url };
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function deleteKnowledgeAttachment(path: string): Promise<void> {
  try {
    const storage = getFirebaseStorage();
    await deleteObject(ref(storage, path));
  } catch (error) {
    throw mapFirebaseError(error);
  }
}
