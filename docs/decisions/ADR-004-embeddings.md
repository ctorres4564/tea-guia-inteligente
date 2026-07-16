# ADR-004 — Provedor de Embeddings e Banco Vetorial para Busca Semântica

**Status:** Aceito
**Data:** 2026-07-16

## Contexto

Para implementar a Fase 3 (Embeddings) e viabilizar a busca semântica (Fase 4) e RAG (Fase 5) no TEA Guia Inteligente, precisamos definir:
1. O modelo e provedor para a geração dos embeddings (vetores que representam o significado conceitual dos artigos de conhecimento clínico).
2. O local e o mecanismo de armazenamento e busca desses vetores (Banco Vetorial).

O PRD original sugeria utilizar `pgvector` sobre um banco de dados PostgreSQL externo ou `Qdrant` para escala futura. No entanto, o projeto atual está baseado em Next.js e Firebase (Auth, Firestore, Storage) hospedados na Vercel e Firebase, o que geraria uma complexidade adicional de sincronização de dados e infraestrutura.

## Decisão

Adotamos a seguinte especificação técnica para a arquitetura de busca semântica:

### 1. Provedor de Embeddings: Google Gen AI (`text-embedding-004`)
* **Por que:** Excelente compreensão conceitual do português brasileiro, altíssimo custo-benefício (custando apenas $0.000025 por 1.000 tokens) e facilidade de integração nativa com o SDK oficial `@google/genai` sob o runtime do Next.js.
* **Modelo alternativo considerado:** OpenAI `text-embedding-3-small` (descartado para evitar contas de faturamento separadas e complexidade desnecessária na gerência de múltiplas chaves de API externa).

### 2. Banco Vetorial: Firestore Vector Search (Nativo)
* **Por que:** O Cloud Firestore oferece suporte nativo para busca vetorial baseada em KNN (K-Nearest Neighbors). Isso permite armazenar os vetores no próprio documento `knowledgeItems/{itemId}` da coleção e realizar buscas semânticas diretamente pelo Firestore SDK (`findNearest()`).
* **Segurança:** Essa abordagem herda diretamente as regras de segurança existentes do Firestore (`firestore.rules`). Não há necessidade de replicar dados para serviços externos de terceiros (como Qdrant ou Pinecone) nem de construir lógicas complexas de sincronização de escrita/exclusão.
* **Custo:** Sem custos fixos de infraestrutura ou licenciamento de banco de dados dedicado. O pagamento é realizado apenas por operações normais de leitura e gravação no Firestore.

### 3. Fluxo de Vetorização no Servidor (Route Handler)
* **Por que:** A chave da API do Gemini (`GEMINI_API_KEY`) e o Firebase Admin SDK exigem execução estritamente protegida no lado do servidor para evitar exposição e violações de segurança.
* **Como funciona:** O cliente (revisor) chama uma API segura `/api/admin/knowledge/publish` para efetuar a transação de publicação, que gera o embedding no servidor e grava o vetor de forma atômica utilizando o Admin SDK (`FieldValue.vector(embedding)`).
* **Desenvolvimento Local:** Caso não haja chave API do Gemini configurada em ambiente local com emuladores, o sistema gera vetores mockados com valores aleatórios de 768 posições para permitir testes manuais rápidos de publicação na interface sem custos ou dependência externa.

## Consequências

* **Positivas:**
  - Arquitetura enxuta e coesa, sem a introdução de novos provedores de banco de dados ou dependências de sincronizadores.
  - Segurança integrada nativamente por meio das regras de segurança e autenticação do Firebase.
  - Custo operacional extremamente baixo para o MVP.
* **Negativas / Limitações:**
  - O tamanho do documento de conhecimento aumenta ligeiramente (cerca de 3 KB por vetor), gerando um tráfego de dados marginalmente maior nas leituras completas de itens. Como as fichas de conhecimento possuem tamanho enxuto (normalmente <5 KB), o impacto total é negligenciável para o MVP.
  - A busca KNN do Firestore em modo `flat` faz varredura linear exaustiva, o que é excelente para o volume atual de dados, mas pode necessitar de transição para índices aproximados (como HNSW) se a base de conhecimento crescer além de dezenas de milhares de itens no futuro.
