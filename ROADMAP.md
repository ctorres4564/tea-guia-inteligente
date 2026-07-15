# Roadmap — TEA Guia Inteligente

Evolução organizada por fases incrementais (herdado do arquivo de skill,
`skill/skill.txt`). Cada fase só é iniciada após a conclusão e validação
da anterior — nenhuma fase é iniciada automaticamente.

## Fase 0/1 — Fundação técnica ✅ (esta execução)

- Projeto Next.js (App Router) + TypeScript + Tailwind + ESLint + Prettier
- Firebase Client SDK e Admin SDK configurados
- Modelagem inicial do Firestore (`profiles`, `categories`,
  `knowledgeItems`, `knowledgeSources`, `favorites`, `history`)
- Regras de segurança do Firestore e Storage
- Índices compostos do Firestore
- Emulator Suite configurado
- Autenticação: cadastro, login, logout, recuperação de senha
- Criação automática de perfil no cadastro (papel `family`, status `active`)
- Proteção de rotas privadas (middleware + verificação no servidor)
- Página inicial, páginas de autenticação e dashboard inicial
- Componentes de UI mínimos
- Testes automatizados (schemas, mapeamento de erros, componentes)
- Documentação (README, ROADMAP, CHANGELOG, arquitetura, ADRs)

## Fase 2 — Base de Conhecimento e Painel Administrativo ✅ (implementada)

- CRUD de categorias (`src/domains/categories/service.ts`)
- CRUD de conteúdos (`knowledgeItems`), com versionamento automático a cada
  edição de conteúdo (`src/domains/knowledge/service.ts`)
- Painel administrativo (`/dashboard/admin`), restrito a
  `professional`/`reviewer`/`administrator`, com visão geral (estatísticas),
  gestão de categorias e gestão de conteúdos
- Fluxo de revisão: `draft` → `in_review` (pelo autor) → `approved`/`rejected`
  → `published` (por `reviewer`/`administrator`) — reforçado nas regras do
  Firestore, não apenas na interface
- Upload de materiais de apoio (Storage) vinculados a conteúdos, com
  controle de tipo/tamanho e autorização por papel via regras cruzadas
  Storage↔Firestore (`firebase/storage.rules`)
- Exclusão lógica de conteúdos restrita a administradores, com opção de
  restauração
- Seed de dados para o emulador (`firebase/seed/seed.mjs`), idempotente,
  nunca aponta para um projeto Firebase real

Ainda não implementado nesta fase: `knowledgeSources` (fontes bibliográficas
vinculadas aos conteúdos) não possui interface própria — apenas schema e
regras já preparados desde a Fase 0/1; a importação em massa da base de
conhecimento completa também permanece fora de escopo.

## Fase 3 — Embeddings

- Geração de embeddings para as fichas da base de conhecimento
- Estratégia de atualização incremental dos embeddings
- Avaliação de banco vetorial (ver ADR-001 — decisão pendente entre
  Firestore Vector Search e serviço externo)

## Fase 4 — Busca Inteligente

- Busca por similaridade semântica
- Ranking de resultados
- Filtros por categoria, público-alvo, faixa etária

## Fase 5 — Chat com IA (RAG)

- Integração com LLM (OpenAI/Anthropic/Gemini/OpenRouter — a definir)
- Pipeline RAG completo: pergunta → embeddings → busca vetorial → ranking
  → prompt → LLM → resposta
- Streaming de respostas
- Exibição de referências e conteúdos relacionados
- O LLM nunca responde apenas com conhecimento próprio — sempre a partir
  do contexto recuperado da base clínica

## Fase 6 — Histórico e Favoritos (interface)

- Interface de histórico de perguntas/buscas
- Interface de favoritos
- A estrutura de dados e as regras de segurança já foram preparadas na
  Fase 0/1

## Fase 7 — Perfil da criança

- Cadastro de perfil da criança (idade, diagnóstico, preferências)
- Personalização de respostas com base no perfil

## Fase 8 — Conteúdo Inteligente

- Recomendações personalizadas
- Conteúdos relacionados automáticos
- Notificações de novos conteúdos

## Fase 9 — Escalabilidade e Observabilidade

- Cache de respostas frequentes
- Filas para processamento assíncrono (ex.: geração de embeddings)
- Monitoramento e observabilidade (logs estruturados, métricas, alertas)
- Rate limiting

## Fora de escopo permanente (a menos que redefinido em PRD futuro)

- Teleconsulta, comunidade, marketplace, gamificação, agenda, integração
  com clínicas (explicitamente fora do escopo do MVP, ver PRD seção 9).
