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

## Fase 3 — Embeddings ✅ (implementada)
- Geração de embeddings para as fichas da base de conhecimento
- Estratégia de atualização incremental dos embeddings
- Avaliação de banco vetorial (ver ADR-004 — adotado Firestore Vector Search)

## Fase 4 — Busca Inteligente ✅ (implementada)
- Busca por similaridade semântica
- Ranking de resultados
- Filtros por categoria, público-alvo, faixa etária

## Fase 5 — Chat com IA (RAG) ✅ (implementada)
- Integração com LLM (Gemini 1.5 Flash via SDK @google/genai)
- Pipeline RAG completo: pergunta → embeddings → busca vetorial → ranking → prompt → LLM → resposta
- Streaming de respostas
- Exibição de referências e conteúdos relacionados em modal lateral
- O LLM responde estritamente a partir do contexto da base clínica

## Fase 6 — Histórico e Favoritos (interface) ✅ (implementada)
- Interface de histórico de perguntas/buscas em formato de timeline
- Interface de favoritos com gerenciamento dinâmico
- Gravação automática de histórico de pesquisas, perguntas e leituras de fichas

## Fase 7 — Perfil da criança ✅ (implementada)

- Cadastro de perfil(is) da criança por conta (nome, data de nascimento,
  status diagnóstico, nível de suporte, estilo de comunicação, interesses,
  sensibilidades, observações) — múltiplos perfis por conta são suportados
  (`/dashboard/criancas`)
- Personalização de respostas do chat com base no perfil selecionado:
  idade calculada dinamicamente, nível de suporte, interesses e
  sensibilidades são injetados como contexto de calibração de tom no
  assistente de IA — nunca usados para diagnóstico (ver
  `docs/decisions/ADR-005-child-profile-privacy.md`)
- Acesso ao perfil da criança restrito estritamente ao próprio responsável,
  sem exceção administrativa

## Fase 8 — Conteúdo Inteligente ✅ (implementada)

- Recomendações personalizadas no dashboard (`/api/knowledge/recommendations`):
  busca vetorial a partir de interesses, sensibilidades e nível de suporte
  do(s) perfil(is) de criança cadastrado(s), com fallback para conteúdo
  publicado recente quando não há perfil — ver
  `docs/decisions/ADR-006-recommendations-and-notifications.md` (amplia o
  uso do perfil da criança previsto na ADR-005).
- Conteúdos relacionados automáticos (`/api/knowledge/related`): busca por
  similaridade a partir do embedding do próprio artigo, com fallback por
  tags em comum quando o artigo ainda não possui embedding.
- Notificações de novos conteúdos: coleção `notifications` (leitura
  liberada a qualquer conta ativa, escrita somente via Admin SDK),
  populada automaticamente na publicação de um conteúdo
  (`/api/admin/knowledge/publish`); estado de "lida"/"não lida" mantido
  no `localStorage` do navegador (não sincroniza entre dispositivos —
  ver ADR-006).
- Painel `DashboardInsights` no dashboard inicial, reunindo recomendações
  e novidades.

## Fase 9 — Escalabilidade e Observabilidade

- Cache de respostas frequentes
- Filas para processamento assíncrono (ex.: geração de embeddings)
- Monitoramento e observabilidade (logs estruturados, métricas, alertas)
- Rate limiting

## Fora de escopo permanente (a menos que redefinido em PRD futuro)

- Teleconsulta, comunidade, marketplace, gamificação, agenda, integração
  com clínicas (explicitamente fora do escopo do MVP, ver PRD seção 9).
