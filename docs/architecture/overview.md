# Arquitetura — Visão Geral

## Objetivo desta fase

Este documento descreve a arquitetura da **Fase 0/1 (Fundação técnica)**
do TEA Guia Inteligente: autenticação, perfis, estrutura de dados base e
a interface mínima necessária para operar essas funcionalidades. Chat com
IA, RAG, embeddings, busca semântica e painel administrativo completo
**não fazem parte desta fase** (ver ROADMAP.md).

## Visão em camadas

```text
Navegador (Client Components)
        │
        │  Firebase Client SDK (Auth, Firestore, Storage)
        ▼
Firebase (Authentication / Firestore / Storage)
        ▲
        │  Firebase Admin SDK (somente servidor)
        │
Next.js Server (Server Components, Route Handlers, Middleware)
```

- **Front-end:** Next.js 14 (App Router) + React 18 + TypeScript +
  Tailwind CSS. Formulários com React Hook Form + Zod.
- **Servidor:** Route Handlers (`src/app/api/**`) e Server Components
  rodando em runtime Node.js na Vercel.
- **Firebase Client SDK:** usado em Client Components (`"use client"`)
  para autenticação e leitura/escrita de dados do próprio usuário,
  respeitando as regras de segurança do Firestore/Storage.
- **Firebase Admin SDK:** usado exclusivamente no servidor
  (`src/lib/firebase/admin.ts`, protegido por `server-only`) para
  verificar cookies de sessão e ler dados com privilégio de servidor.

## Fluxo de dados de autenticação

```text
Formulário (cliente)
   → Firebase Auth (createUser/signIn)
   → cria/lê profiles/{uid} no Firestore (client SDK)
   → obtém idToken
   → POST /api/auth/session (Route Handler, Admin SDK)
   → cookie de sessão httpOnly definido
   → middleware + Server Components passam a reconhecer a sessão
```

Ver `docs/decisions/ADR-002-auth-strategy.md` para o detalhamento completo
da estratégia de autenticação e suas limitações conhecidas.

## Organização por domínios

```text
src/
├── app/            # rotas (App Router): (public), (auth), (dashboard), api
├── components/      # componentes de UI reutilizáveis (ui, layout, feedback)
├── domains/         # regras de negócio por domínio (auth, users, categories,
│                     #   knowledge, favorites, history, administration)
├── lib/
│   ├── firebase/     # client.ts e admin.ts (inicialização do Firebase)
│   ├── validation/   # schemas Zod (fonte única de verdade dos formatos de dado)
│   ├── security/      # helpers de sessão/autorização usados no servidor
│   ├── errors/        # AppError + mapeamento de erros do Firebase para PT-BR
│   └── utils/          # utilitários gerais (cn, timestamps)
├── config/           # configuração de ambiente (env.ts) e do site (site.ts)
├── hooks/             # hooks React (useAuth)
└── types/             # tipos e constantes compartilhadas (nomes de coleções)
```

Regra de organização (herdada do arquivo de skill): nunca misturar regras
de negócio de domínios diferentes no mesmo módulo. Cada domínio expõe
apenas o que é necessário para a camada de apresentação (`app/` e
`components/`).

## Painel administrativo (Fase 2)

`/dashboard/admin` (protegido a `professional`/`reviewer`/`administrator`
via `getAuthorizedSession`, ver `src/lib/security/authorization.ts`)
oferece: visão geral com estatísticas, CRUD de categorias e CRUD de
conteúdos com fluxo de revisão (`draft → in_review → approved/rejected →
published`) e upload de materiais de apoio no Storage. As mutações usam o
Firebase Client SDK diretamente (não Route Handlers) — a autorização real
é garantida pelas regras do Firestore/Storage, seguindo o mesmo padrão já
usado para perfis desde a Fase 0/1; a checagem de papel no servidor
(`getAuthorizedSession`) protege apenas a renderização da página (evita
que um usuário sem permissão sequer veja a interface administrativa).

## Funcionalidades implementadas (Fases 3–6)

- **Fase 3 — Embeddings:** geração de vetor semântico (Gemini `text-embedding-004`, 768 dims) no momento da publicação. Campo `embeddingVersion` sinaliza se o vetor está atualizado (`1`) ou desatualizado após edição (`0`).
- **Fase 4 — Busca Semântica:** `/api/knowledge/search` — busca KNN no Firestore, filtros em memória, threshold de similaridade 0.65. Resultados exibem rótulo qualitativo de correspondência.
- **Fase 5 — Chat RAG:** `/api/knowledge/chat` — retrieval aumentado, streaming via Gemini 1.5 Flash, instruções de sistema clínico, disclaimer obrigatório. Payload validado via Zod.
- **Fase 6 — Favoritos e Histórico:** `/dashboard/favoritos` e `/dashboard/historico`. Favoritos usam ID determinístico (idempotente). Histórico com limite de 30 registros na consulta.

## Limites atuais (o que ainda não está coberto)

- Importação em massa da base clínica (script de seed em `firebase/seed/seed.mjs` cobre apenas dados mínimos para o emulador).
- Interface de `knowledgeSources` (fontes bibliográficas) — schema e regras prontos, sem tela própria.
- Fase 7: Perfil da criança, personalização da IA, recomendações — planejado, não iniciado.
- Pagamentos, notificações e aplicativo mobile nativo.

## Hospedagem

- **Vercel:** hospedagem do Next.js (front-end + Route Handlers).
- **Firebase:** Authentication, Firestore, Storage. Emuladores locais
  disponíveis via `npm run firebase:emulators` para desenvolvimento sem
  custo e sem dependência de um projeto Firebase real.
