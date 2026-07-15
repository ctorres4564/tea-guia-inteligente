"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";

import { getFirebaseAuth, getFirebaseFirestore } from "@/lib/firebase/client";
import { mapFirebaseError } from "@/lib/errors/firebase-errors";
import {
  DEFAULT_PROFILE_ROLE,
  DEFAULT_PROFILE_STATUS,
} from "@/lib/validation/profile.schema";
import type { SignupInput, LoginInput, ForgotPasswordInput } from "@/lib/validation/auth.schema";
import { FIRESTORE_COLLECTIONS } from "@/types/firestore";

async function establishServerSession(user: User): Promise<void> {
  const idToken = await user.getIdToken();
  await fetch("/api/auth/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
  });
}

async function clearServerSession(): Promise<void> {
  await fetch("/api/auth/logout", { method: "POST" });
}

/**
 * Cria o documento inicial de perfil em `profiles/{uid}` logo após o cadastro.
 * Papel e status padrão são sempre atribuídos pelo servidor/cliente confiável —
 * o usuário nunca escolhe seu próprio papel no formulário de cadastro.
 */
async function createInitialProfile(user: User, fullName: string): Promise<void> {
  const firestore = getFirebaseFirestore();
  const profileRef = doc(firestore, FIRESTORE_COLLECTIONS.profiles, user.uid);

  await setDoc(profileRef, {
    uid: user.uid,
    fullName,
    email: user.email,
    role: DEFAULT_PROFILE_ROLE,
    status: DEFAULT_PROFILE_STATUS,
    avatarUrl: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function signUp(input: SignupInput): Promise<User> {
  try {
    const auth = getFirebaseAuth();
    const credential = await createUserWithEmailAndPassword(auth, input.email, input.password);
    await createInitialProfile(credential.user, input.fullName);
    await establishServerSession(credential.user);
    return credential.user;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function signIn(input: LoginInput): Promise<User> {
  try {
    const auth = getFirebaseAuth();
    const credential = await signInWithEmailAndPassword(auth, input.email, input.password);
    await establishServerSession(credential.user);
    return credential.user;
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function signOutUser(): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    await firebaseSignOut(auth);
    await clearServerSession();
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<void> {
  try {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, input.email);
  } catch (error) {
    throw mapFirebaseError(error);
  }
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  const auth = getFirebaseAuth();
  return firebaseOnAuthStateChanged(auth, callback);
}
