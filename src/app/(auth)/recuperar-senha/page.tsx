"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, Button, Card, FormField, Input } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { requestPasswordReset } from "@/domains/auth/service";
import { isAppError } from "@/lib/errors/app-error";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validation/auth.schema";

export default function ForgotPasswordPage() {
  const [formError, setFormError] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(data: ForgotPasswordInput) {
    setFormError(null);
    try {
      await requestPasswordReset(data);
      setIsSent(true);
    } catch (error) {
      setFormError(
        isAppError(error) ? error.message : "Não foi possível enviar o e-mail. Tente novamente.",
      );
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-slate-900">Recuperar senha</h1>
      <p className="mt-1 text-sm text-slate-500">
        Informe seu e-mail cadastrado para receber um link de redefinição de senha.
      </p>

      {isSent ? (
        <Alert variant="success" className="mt-6">
          Se este e-mail estiver cadastrado, você receberá um link para redefinir sua senha em
          instantes.
        </Alert>
      ) : (
        <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
          {formError && (
            <Alert variant="error" role="alert">
              {formError}
            </Alert>
          )}

          <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              hasError={Boolean(errors.email)}
              {...register("email")}
            />
          </FormField>

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Enviar link de recuperação
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-slate-500">
        Lembrou a senha?{" "}
        <Link href={siteConfig.routes.login} className="font-medium text-brand-700 hover:underline">
          Entrar
        </Link>
      </p>
    </Card>
  );
}
