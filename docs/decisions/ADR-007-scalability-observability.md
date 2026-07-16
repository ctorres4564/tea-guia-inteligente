# ADR-007: Escalabilidade, Caching e Observabilidade (Fase 9)

## Status
Aprovado

## Contexto
À medida que o aplicativo "TEA Guia Inteligente" caminha para produção, a integração com grandes modelos de linguagem (RAG com Gemini) apresenta desafios de custo, latência e robustez. Chamadas frequentes de IA para perguntas idênticas geram sobrecarga de cota e custos redundantes. Adicionalmente, processos síncronos pesados (como a geração de embeddings de 768 dimensões do artigo clínico no momento da publicação) expõem os endpoints administrativos a timeouts HTTP. Por fim, a ausência de controle de abusos centralizado (Rate Limiting) e telemetria estruturada dificulta a detecção rápida de incidentes em ambientes serveless em nuvem.

## Decisão

### 1. Centralização do Rate Limiting
- Criamos um utilitário em `src/lib/security/rate-limit.ts` centralizado, em memória com expiração automática e periódica de janelas inativas (limpeza a cada 5 minutos) para evitar memory leaks.
- O rate limit é baseado em chaves (`chat:uid`, `search:uid`, `recommendations:uid`, `related:uid`).
- **Limites configurados**:
  - Chat: 20 requisições por minuto por usuário.
  - Busca Semântica: 40 requisições por minuto por usuário.
  - Recomendações: 40 requisições por minuto por usuário.
  - Artigos Relacionados: 40 requisições por minuto por usuário.

### 2. Cache de Chat RAG Isolado por Usuário
- Para economizar cota da API do Gemini e reduzir o tempo de resposta das mesmas perguntas feitas por um mesmo usuário, introduzimos uma camada de cache no Firestore na coleção `chatResponseCache`.
- **Privacidade Estrita**: A chave do documento (ID) é o hash SHA-256 da concatenação de `pergunta_normalizada` + `childId_opcional` + `userId_autenticado`. Isso garante isolamento total: o cache é individual e nenhuma resposta de chat RAG (que contém informações clínicas personalizadas da criança) cruza ou vaza entre usuários distintos.
- **TTL (Tempo de Vida) e Limpeza**: O cache expira automaticamente após 1 hora (60 minutos) da data de criação (`createdAt`). Para evitar custos de armazenamento progressivo no Firestore, **recomendamos ativar a política de TTL nativa no Console do Firestore** configurando a coleção `chatResponseCache` para apagar documentos após 24 horas baseado no atributo `createdAt`.
- O stream do cache é retornado de forma simulada em blocos para manter a interface de usuário reativa sem quebras estruturais no frontend.

### 3. Processamento Assíncrono de Embeddings e Resiliência
- Desacoplamos a geração de embeddings da transação síncrona de publicação em `/api/admin/knowledge/publish`.
- A API administrativa realiza o update no documento definindo `reviewStatus: 'published'` e `embeddingVersion: 0` (pendente) e responde instantaneamente com `200 OK` ao usuário reviewer.
- **Mitigação Serverless (Vercel)**: Para garantir que a Promise não seja interrompida precocemente pelo runtime da Vercel após a resposta HTTP, utilizamos `request.waitUntil` ou o objeto de contexto do Next.js para manter o processo em background vivo.
- **Conciliação e Interface**: Criamos a rota de conciliação administrativa `/api/admin/embeddings/reprocess` que permite reprocessar em lotes (limite de 10 itens por vez) quaisquer publicações com embeddings pendentes (`embeddingVersion == 0`). Adicionalmente, incluímos um botão de **"Sincronizar Embeddings"** na interface do painel do administrador para permitir a conciliação manual rápida.

### 4. Telemetria com Logs Estruturados
- Criamos a biblioteca `src/lib/observability/logger.ts` contendo suporte aos níveis `INFO`, `WARN` e `ERROR`.
- **Ambiente de Produção**: Emite logs em formato JSON estruturado em linha única para consumo otimizado por APMs e visualizadores de logs em nuvem.
- **Ambiente de Desenvolvimento**: Formata logs coloridos de fácil leitura humana.
- **Mascaramento de Dados Sensíveis**: Filtra chaves específicas de metadados como `email`, `name`, `birthDate`, `sensitivities`, `interests` e `notes`, substituindo o valor por `[REDACTED]` antes de emitir o log, garantindo conformidade com a LGPD e privacidade de dados de saúde.

## Consequências
- Painel de controle administrativo muito mais reativo durante a publicação de novos conteúdos, eliminando timeouts do Next.js.
- Redução expressiva no consumo de tokens e custos de chamada do Gemini graças ao cache de 1 hora.
- Garantia de conformidade com LGPD e privacidade com o cache do chat isolado por UID do usuário e mascaramento de PII em logs.
- Facilidade de auditoria de performance através dos logs estruturados.
