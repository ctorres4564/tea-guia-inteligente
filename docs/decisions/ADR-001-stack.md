# ADR-001 — Escolha de Stack Tecnológica

**Status:** Aceito
**Data:** 2026-07-15

## Contexto

Os documentos de planejamento fornecidos apresentam recomendações de stack
divergentes:

- **PRD (`prd.txt`, seção 22 — Stack Recomendada):** Flutter (Android/iOS) +
  React (painel administrativo) no front-end; NestJS/Node.js no back-end;
  PostgreSQL com pgvector como banco vetorial; hospedagem em Vercel
  (frontend), Railway/Render (backend) e Supabase (banco).
- **Prompt de execução (instruções deste projeto):** exige explicitamente
  Next.js (App Router) + React + TypeScript + Tailwind CSS + Firebase
  (Authentication, Firestore, Storage, Admin SDK), compatível com Vercel.

Isso configura uma **contradição direta** entre PRD e as instruções
explícitas de execução.

## Hierarquia de decisão aplicada

Conforme a ordem de prioridade definida nas instruções deste projeto:

1. Solicitações explícitas deste prompt;
2. PRD;
3. Documento de planejamento da aplicação;
4. Arquivo de skill;
5. Decisões técnicas necessárias para viabilizar o projeto.

Como as instruções explícitas do prompt têm prioridade máxima, elas
prevalecem sobre a stack recomendada no PRD.

## Decisão

Adotar a stack exigida pelo prompt para esta fase (Fundação técnica):

- **Next.js 14 (App Router) + React 18 + TypeScript** no front-end e
  back-end (Route Handlers), substituindo a combinação Flutter + NestJS.
- **Firebase** (Authentication, Cloud Firestore, Storage, Admin SDK,
  Emulator Suite) como infraestrutura principal, substituindo
  PostgreSQL + pgvector + Supabase.
- **Tailwind CSS** para estilização.
- **Zod** para validação de dados (formulários, variáveis de ambiente,
  dados vindos do Firestore).
- **React Hook Form** para formulários.
- **Vitest** para testes automatizados.
- **ESLint + Prettier** para qualidade e formatação de código.
- Compatibilidade com deploy na **Vercel**.

O aplicativo mobile nativo (Flutter) mencionado no PRD **não é implementado
nesta fase** — o MVP é entregue como aplicação web responsiva em Next.js,
compatível com dispositivos móveis via navegador. A decisão sobre um app
nativo fica para uma fase futura e deve ser reavaliada à luz da stack já
adotada aqui.

O banco vetorial (pgvector/Qdrant) mencionado no PRD para RAG **não é
necessário nesta fase**, pois embeddings, busca semântica e RAG estão fora
do escopo desta fundação técnica (ver seção 3 das instruções do projeto).
Quando essas fases forem implementadas, uma nova ADR deverá avaliar como
compatibilizar busca vetorial com o Firestore (por exemplo, usando
Firestore Vector Search, ou um serviço externo).

## Consequências

- Ganha-se um único ecossistema (Next.js + Firebase) mais simples de operar
  e implantar para um MVP, com menor custo operacional inicial.
- Perde-se, por ora, a flexibilidade de um app mobile nativo (Flutter) e a
  robustez de um banco relacional dedicado (PostgreSQL) com pgvector nativo.
- A evolução futura para busca semântica/RAG exigirá uma decisão técnica
  adicional documentada em ADR própria, já que o Firestore não é a
  ferramenta mais natural para busca vetorial em larga escala.
- Esta divergência entre PRD e stack implementada deve ser comunicada
  explicitamente aos stakeholders do produto (ver relatório final desta
  execução).

## Alternativas consideradas

- Seguir o PRD à risca (Flutter + NestJS + PostgreSQL): rejeitada, pois
  contraria uma instrução explícita e teria prioridade mais baixa segundo a
  hierarquia definida.
- Stack híbrida (Next.js + PostgreSQL, sem Firebase): rejeitada, pois o
  prompt exige Firebase de forma explícita e detalhada (seções 6, 10, 11 das
  instruções).
