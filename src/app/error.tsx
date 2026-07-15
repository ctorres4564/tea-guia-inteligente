"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui";

/**
 * Error boundary global de rota. Nunca exibe stack traces, mensagens técnicas
 * do Firebase ou detalhes internos ao usuário — apenas uma mensagem segura.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log técnico apenas no console do servidor/observabilidade — nunca na tela do usuário.
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-3xl font-semibold text-slate-900">Algo deu errado</h1>
      <p className="max-w-md text-slate-500">
        Ocorreu um erro inesperado. Tente novamente em instantes.
      </p>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
