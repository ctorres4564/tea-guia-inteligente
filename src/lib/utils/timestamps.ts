import { serverTimestamp } from "firebase/firestore";

/**
 * Sempre usar o timestamp de servidor do Firestore para `createdAt`/`updatedAt`,
 * evitando divergência de relógio entre clientes.
 */
export function withServerTimestamps<T extends Record<string, unknown>>(
  data: T,
): T & { createdAt: unknown; updatedAt: unknown } {
  return {
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

export function withUpdatedTimestamp<T extends Record<string, unknown>>(
  data: T,
): T & { updatedAt: unknown } {
  return {
    ...data,
    updatedAt: serverTimestamp(),
  };
}
