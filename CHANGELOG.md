# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere a [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.4.0] - 2026-07-16

### Adicionado
- Perfil da criança (Fase 7): cadastro de um ou mais perfis por conta
  (nome, data de nascimento, status diagnóstico, nível de suporte,
  estilo de comunicação, interesses, sensibilidades, observações) em
  `/dashboard/criancas` (`src/domains/children/service.ts`).
- Personalização do assistente de IA: seletor de perfil no Chat injeta
  idade calculada dinamicamente, nível de suporte, interesses e
  sensibilidades como contexto de calibração de tom no
  `systemInstruction` de `/api/knowledge/chat` — nunca usado para
  diagnóstico, reforçado explicitamente no prompt.
- Regras do Firestore para `children/{userId}/profiles/{childId}`:
  acesso restrito ao próprio responsável, sem exceção administrativa
  (dado de saúde de menor).
- Utilitário de cálculo de idade (`src/lib/utils/age.ts`).
- `docs/decisions/ADR-005-child-profile-privacy.md`.
- Testes: schema do perfil da criança e cálculo de idade.

## [0.3.0] - 2026-07-16

### Adicionado
- Integração de IA com SDK oficial `@google/genai` e suporte a geração de embeddings com o modelo `text-embedding-004`.
- Busca semântica KNN integrada ao Firestore Vector Search de 768 dimensões com métrica de similaridade de cosseno e pós-filtragem eficiente em memória (por Categoria, Público-alvo e Faixa Etária).
- Assistente Conversacional Clínico com RAG completo alimentado pelo Gemini 1.5 Flash, com streaming de caracteres em tempo real e citação explícita dos artigos utilizados.
- Interface cliente de Chat com histórico local, Drawer de visualização rápida e banner de disclaimer educativo/LGPD.
- Sistema de Favoritos com listagem em `/dashboard/favoritos`, operações do Firestore (`toggleFavorite`, `listFavorites`) e botão de estrela unificado.
- Linha do tempo de Histórico de interações (buscas, perguntas feitas à IA e visualizações de artigos) sob `/dashboard/historico`, com ações rápidas de re-pesquisa e re-visualização.
- Roteamento e linkagem ativos para Chat com IA, Favoritos e Histórico no menu lateral (`AppSidebar`).
- Testes de integridade no Vitest, typechecking com `tsc` e conformidade de linter do Next.js sem avisos ou erros.
- Documentações: `docs/decisions/ADR-004-embeddings.md`, `docs/architecture/embeddings.md`, `docs/architecture/search.md`, `docs/architecture/rag.md` e `docs/architecture/favorites-history.md`.

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
