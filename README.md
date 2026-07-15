# TEA Guia Inteligente

Aplicativo independente com finalidade **educacional e informativa**,
destinado a pais, responsáveis, cuidadores, educadores e profissionais que
buscam informações confiáveis sobre o Transtorno do Espectro Autista (TEA)
e temas relacionados ao desenvolvimento infantil.

> O TEA Guia Inteligente oferece informações educacionais e de apoio. Seu
> conteúdo não substitui avaliação, diagnóstico, orientação ou
> acompanhamento realizado por profissionais habilitados.

## Estado atual do projeto

**Fase 0/1 (Fundação técnica)** e **Fase 2 (Base de Conhecimento e Painel
Administrativo)** implementadas: autenticação, perfis, proteção de rotas,
CRUD de categorias e conteúdos com fluxo de revisão e versionamento,
upload de materiais de apoio, e painel administrativo em
`/dashboard/admin`. Funcionalidades de IA (chat, RAG, embeddings, busca
semântica), favoritos, histórico e pagamentos **ainda não foram
implementados** — ver [ROADMAP.md](./ROADMAP.md).

## Público

Pais e responsáveis de crianças com TEA (principal); mães, avós,
cuidadores, professores, acompanhantes terapêuticos e familiares
(secundário).

## Stack

- [Next.js 14](https://nextjs.org/) (App Router) + React 18 + TypeScript
- Tailwind CSS
- Firebase: Authentication, Cloud Firestore, Storage, Admin SDK, Emulator
  Suite
- Zod (validação) + React Hook Form
- Vitest (testes) + ESLint + Prettier

Ver justificativa completa em
[`docs/decisions/ADR-001-stack.md`](./docs/decisions/ADR-001-stack.md)
(inclui a divergência identificada entre o PRD original e a stack exigida
para esta execução).

## Pré-requisitos

- Node.js >= 18.18
- Uma conta e um projeto no [Firebase Console](https://console.firebase.google.com/)
- (Opcional, recomendado) [Firebase CLI](https://firebase.google.com/docs/cli) para usar os emuladores locais

## Instalação

```bash
npm install
cp .env.example .env.local
```

Preencha `.env.local` com as credenciais do seu projeto Firebase (ver
seção "Configuração do Firebase" abaixo).

## Execução local

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Variáveis de ambiente

Ver `.env.example` para a lista completa. Resumo:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Configuração pública do Firebase Client SDK |
| `NEXT_PUBLIC_USE_FIREBASE_EMULATORS` | `true` para conectar aos emuladores locais em desenvolvimento |
| `FIREBASE_ADMIN_PROJECT_ID` | Projeto do Firebase Admin SDK (servidor) |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | E-mail da conta de serviço (servidor) |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Chave privada da conta de serviço (servidor, nunca exposta ao cliente) |

**Nunca** commite `.env.local` nem o JSON da conta de serviço do Firebase.

## Configuração do Firebase

1. Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
2. Em **Authentication → Sign-in method**, habilite o provedor
   **E-mail/senha**.
3. Em **Firestore Database**, crie o banco (modo produção).
4. Em **Storage**, crie o bucket padrão.
5. Em **Configurações do projeto → Geral**, registre um app Web e copie os
   valores para as variáveis `NEXT_PUBLIC_FIREBASE_*` em `.env.local`.
6. Em **Configurações do projeto → Contas de serviço**, gere uma nova
   chave privada (JSON) e preencha `FIREBASE_ADMIN_PROJECT_ID`,
   `FIREBASE_ADMIN_CLIENT_EMAIL` e `FIREBASE_ADMIN_PRIVATE_KEY` em
   `.env.local` a partir desse arquivo — **não** adicione o arquivo JSON
   ao repositório.
7. Publique as regras e índices:

   ```bash
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

## Emuladores (desenvolvimento local sem custo)

```bash
npm run firebase:emulators
```

Em outro terminal, com `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` em
`.env.local`:

```bash
npm run dev
```

A UI dos emuladores fica disponível em `http://localhost:4000`.

## Comandos

| Comando | Descrição |
| --- | --- |
| `npm run dev` | Inicia o servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Inicia o servidor de produção (após build) |
| `npm run lint` | Executa o ESLint |
| `npm run typecheck` | Verifica tipos com `tsc --noEmit` |
| `npm run test` | Executa os testes com Vitest |
| `npm run test:watch` | Executa os testes em modo watch |
| `npm run firebase:emulators` | Inicia os emuladores do Firebase |
| `npm run firebase:seed` | Popula dados de exemplo no Firestore Emulator (categorias e conteúdos) |

## Estrutura do projeto

```text
src/
├── app/            # Rotas (App Router): (public), (auth), (dashboard), api
├── components/      # Componentes de UI (ui, layout, feedback)
├── domains/         # Regras de negócio por domínio
├── lib/             # Firebase, validação (Zod), erros, segurança, utils
├── config/          # Variáveis de ambiente e configuração do site
├── hooks/           # Hooks React
└── types/           # Tipos e constantes compartilhadas

firebase/            # Regras, índices e seed do Firebase
docs/                # Arquitetura e decisões (ADRs)
```

Ver [`docs/architecture/overview.md`](./docs/architecture/overview.md)
para o detalhamento completo.

## Implantação (Vercel)

1. Importe o repositório na Vercel.
2. Configure as mesmas variáveis de ambiente de `.env.example` no painel
   da Vercel (Production e Preview).
3. O build padrão (`npm run build`) já é compatível com a Vercel — nenhuma
   configuração adicional é necessária.
4. Publique as regras do Firestore/Storage separadamente via Firebase CLI
   (a Vercel não faz isso automaticamente).

## Painel administrativo

Acessível em `/dashboard/admin` para usuários com papel `professional`,
`reviewer` ou `administrator`. Permite gerenciar categorias, criar e
editar conteúdos da base clínica, conduzir o fluxo de revisão
(`draft → in_review → approved/rejected → published`) e anexar materiais
de apoio (PDF/imagem, até 5 MB). Para testar localmente sem um projeto
Firebase real, use os emuladores (`npm run firebase:emulators`) e o
script de seed (`npm run firebase:seed`); em seguida, promova seu usuário
de teste a `professional` ou `administrator` diretamente pela UI dos
emuladores (`http://localhost:4000`) em `profiles/{uid}.role`.

## Limitações conhecidas desta fase

- Chat com IA, RAG, embeddings e busca semântica: não implementados.
- Interface de fontes bibliográficas (`knowledgeSources`): schema e
  regras prontos, sem tela própria.
- Favoritos e histórico: apenas estrutura de dados e regras de segurança
  preparadas — sem interface.
- Aplicativo mobile nativo: não implementado (o app é web responsivo).

## Segurança

Ver [`docs/architecture/security.md`](./docs/architecture/security.md).

## Licença

Uso interno do projeto — licença a ser definida.
