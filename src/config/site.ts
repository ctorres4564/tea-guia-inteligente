export const siteConfig = {
  name: "TEA Guia Inteligente",
  shortDescription:
    "Informações educacionais e de apoio sobre o Transtorno do Espectro Autista para famílias, cuidadores e profissionais.",
  disclaimer:
    "O TEA Guia Inteligente oferece informações educacionais e de apoio. Seu conteúdo não substitui avaliação, diagnóstico, orientação ou acompanhamento realizado por profissionais habilitados.",
  audience: [
    "Pais e responsáveis",
    "Mães, pais, avós e cuidadores",
    "Educadores e professores",
    "Profissionais de saúde e terapeutas",
  ],
  routes: {
    home: "/",
    login: "/login",
    signup: "/cadastro",
    forgotPassword: "/recuperar-senha",
    dashboard: "/dashboard",
  },
} as const;
