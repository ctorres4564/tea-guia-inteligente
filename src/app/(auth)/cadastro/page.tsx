"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Alert, Button, Card, FormField, Input } from "@/components/ui";
import { siteConfig } from "@/config/site";
import { signUp } from "@/domains/auth/service";
import { isAppError } from "@/lib/errors/app-error";
import { signupSchema, type SignupInput } from "@/lib/validation/auth.schema";

export default function SignupPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(data: SignupInput) {
    setFormError(null);
    try {
      await signUp(data);
      router.push(siteConfig.routes.dashboard);
      router.refresh();
    } catch (error) {
      setFormError(
        isAppError(error) ? error.message : "Não foi possível concluir o cadastro. Tente novamente.",
      );
    }
  }

  return (
    <Card>
      <h1 className="text-xl font-semibold text-slate-900">Criar conta</h1>
      <p className="mt-1 text-sm text-slate-500">
        Cadastre-se gratuitamente no {siteConfig.name}. Todo novo cadastro é criado com o papel de
        familiar/responsável.
      </p>

      <form className="mt-6 flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError && (
          <Alert variant="error" role="alert">
            {formError}
          </Alert>
        )}

        <FormField label="Nome completo" htmlFor="fullName" error={errors.fullName?.message}>
          <Input
            id="fullName"
            type="text"
            autoComplete="name"
            hasError={Boolean(errors.fullName)}
            {...register("fullName")}
          />
        </FormField>

        <FormField label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            hasError={Boolean(errors.email)}
            {...register("email")}
          />
        </FormField>

        <FormField
          label="Senha"
          htmlFor="password"
          error={errors.password?.message}
          hint="Mínimo de 8 caracteres, com letras maiúsculas, minúsculas e números."
        >
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            hasError={Boolean(errors.password)}
            {...register("password")}
          />
        </FormField>

        <FormField
          label="Confirmar senha"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
        >
          <Input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            hasError={Boolean(errors.confirmPassword)}
            {...register("confirmPassword")}
          />
        </FormField>

        <FormField label="" htmlFor="acceptTerms" error={errors.acceptTerms?.message}>
          <label htmlFor="acceptTerms" className="flex items-start gap-2 text-sm text-slate-600">
            <input
              id="acceptTerms"
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
              {...register("acceptTerms")}
            />
            <span>
              Li e estou de acordo com a finalidade educacional e informativa do {siteConfig.name}.
            </span>
          </label>
        </FormField>

        <Button type="submit" isLoading={isSubmitting} className="w-full">
          Criar conta
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        Já tem conta?{" "}
        <Link href={siteConfig.routes.login} className="font-medium text-brand-700 hover:underline">
          Entrar
        </Link>
      </p>
    </Card>
  );
}
