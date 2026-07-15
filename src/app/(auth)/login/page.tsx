"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, Button, FormField, Input, Card } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { signIn } from "@/domains/auth/service";
import { isAppError } from "@/lib/errors/app-error";
import { loginSchema, type LoginInput } from "@/lib/validation/auth.schema";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(data: LoginInput) {
    setFormError(null);
    try {
      await signIn(data);
      const redirectTo = searchParams.get("redirectTo") || siteConfig.routes.dashboard;
      router.push(redirectTo);
      router.refresh();
    } catch (error) {
      setFormError(isAppError(error) ? error.message : "Não foi possível entrar. Tente novamente.");
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-slate-900">Entrar</h1>
      <p className="mt-1 text-sm text-slate-500">Acesse sua conta do {siteConfig.name}.</p>

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

        <FormField label="Senha" htmlFor="password" error={errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            hasError={Boolean(errors.password)}
            {...register("password")}
          />
        </FormField>

        <div className="text-right text-sm">
          <Link href={siteConfig.routes.forgotPassword} className="text-brand-700 hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Entrar
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Ainda não tem conta?{" "}
        <Link href={siteConfig.routes.signup} className="font-medium text-brand-700 hover:underline">
          Criar conta
        </Link>
      </p>
    </Card>
  );
}
