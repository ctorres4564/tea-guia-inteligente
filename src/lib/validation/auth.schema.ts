import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "A senha deve ter pelo menos 8 caracteres")
  .max(128, "Senha muito longa")
  .regex(/[a-z]/, "A senha deve conter ao menos uma letra minúscula")
  .regex(/[A-Z]/, "A senha deve conter ao menos uma letra maiúscula")
  .regex(/[0-9]/, "A senha deve conter ao menos um número");

export const loginSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, "Informe o nome completo").max(120),
    email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
    password: passwordSchema,
    confirmPassword: z.string().min(1, "Confirme a senha"),
    acceptTerms: z
      .boolean()
      .refine((value) => value === true, "É necessário aceitar os termos de uso"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });
export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, "Informe o e-mail").email("E-mail inválido"),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
