# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere a [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.2.0] - 2026-07-15

### Adicionado

- CRUD completo de categorias (`src/domains/categories/service.ts`) e
  painel administrativo em `/dashboard/admin/categorias`.
- CRUD completo de conteúdos da base clínica (`knowledgeItems`), com
  versionamento automático a cada edição de conteúdo
  (`src/domains/knowledge/service.ts`) e painel em
  `/dashboard/admin/conteudos` (listagem, criação, edição).
- Fluxo de revisão de conteúdos: submissão (`draft` → `in_review`),
  aprovação/rejeição e publicação, com transições sensíveis restritas a
  `reviewer`/`administrator` nas regras do Firestore.
- Exclusão lógica de conteúdos (restrita a administradores) com opção de
  restauração.
- Upload de materiais de apoio (Storage) vinculados a conteúdos
  (`src/domains/knowledge/storage-service.ts`), com regras de autorização
  cruzada Storage↔Firestore por papel (`firebase/storage.rules`).
- Helpers de autorização por papel no servidor
  (`src/lib/security/authorization.ts`) e guarda de acesso do painel
  administrativo (`(dashboard)/admin/layout.tsx`).
- Estatísticas do painel administrativo via consultas de agregação
  (`src/domains/administration/stats.ts`).
- Link de navegação para o painel administrativo, visível apenas a
  papéis autorizados (`AppSidebar`).
- Script de seed idempotente para o Firestore Emulator
  (`firebase/seed/seed.mjs`, `npm run firebase:seed`).
- Campo `attachments` no schema de `knowledgeItems` (materiais anexados).
- `docs/decisions/ADR-003-fase2-crud-and-storage-rules.md`.
- Testes adicionais: `slugify`, grupos de papéis, schema de anexos.

### Alterado

- `firebase/firestore.rules`: regra de `knowledgeItems.update` refinada
  para permitir que qualquer editor de conteúdo submeta um rascunho para
  revisão, restringindo apenas as transições de aprovação/publicação/
  rejeição a revisores/administradores; exclusão lógica agora restrita a
  administradores (ver ADR-003).
- `firebase/storage.rules`: substituído o caminho genérico `/public/**`
  por `/knowledge/{itemId}/**`, com autorização por papel via
  `firestore.get()`.

## [0.1.0] - 2026-07-15

### Adicionado

- Fundação técnica do projeto: Next.js 14 (App Router), TypeScript,
  Tailwind CSS, ESLint, Prettier, Vitest.
- Integração com Firebase: Client SDK, Admin SDK, Authentication,
  Firestore, Storage, Emulator Suite.
- Autenticação completa: cadastro, login, logout, recuperação de senha.
- Criação automática de perfil (`profiles/{uid}`) no cadastro, com papel
  `family` e status `active` por padrão.
- Proteção de rotas privadas via middleware + verificação de sessão no
  servidor (Firebase Admin SDK).
- Modelagem inicial do Firestore: `profiles`, `categories`,
  `knowledgeItems`, `knowledgeSources`, `favorites`, `history`.
- Regras de segurança do Firestore e do Storage.
- Índices compostos do Firestore.
- Página inicial, páginas de autenticação e dashboard inicial.
- Biblioteca mínima de componentes de UI (Button, Input, Textarea, Select,
  Card, Alert, Loading, EmptyState, FormField, PageHeader, AppHeader,
  AppSidebar).
- Tratamento padronizado de erros com mensagens em português.
- Testes automatizados (Vitest) para schemas, mapeamento de erros e
  componentes.
- Documentação: README, ROADMAP, arquitetura (`docs/architecture/`) e
  decisões arquiteturais (`docs/decisions/ADR-001`, `ADR-002`).
