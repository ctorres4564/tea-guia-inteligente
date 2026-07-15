import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("getClientEnv", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("lança erro descritivo quando variáveis obrigatórias estão ausentes", async () => {
    delete process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
    const { getClientEnv } = await import("@/config/env");
    expect(() => getClientEnv()).toThrow(/NEXT_PUBLIC_FIREBASE_API_KEY/);
  });
});
