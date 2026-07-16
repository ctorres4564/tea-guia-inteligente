# Assistente de IA / RAG (Fase 5)

Este documento descreve a arquitetura, o fluxo de dados e os procedimentos de blindagem do sistema de geração aumentada de recuperação (RAG - *Retrieval-Augmented Generation*) do assistente conversacional inteligente do TEA Guia Inteligente.

---

## 1. Objetivo

O assistente conversacional inteligente ajuda os usuários a esclarecer suas dúvidas sobre autismo e neurodesenvolvimento de forma contínua e interativa. Para garantir a segurança e a precisão do conteúdo, a IA utiliza RAG para basear suas respostas exclusivamente no conhecimento validado de nossa base clínica, citando as fontes de forma transparente e evitando alucinações.

---

## 2. Arquitetura

O RAG foi projetado de forma centralizada e sem estado persistente no banco (mantendo a privacidade do diálogo) usando streaming HTTP na rota de API do Next.js:

```text
       [Interface do Chat] (ChatInterface.tsx)
               │
               ▼  (HTTP POST com histórico + última mensagem)
     [Route Handler de RAG] (src/app/api/knowledge/chat/route.ts)
               │
               ├─► [Gemini Embeddings] (Gera o vetor da última mensagem)
               │
               ├─► [Firestore KNN Query] (Busca os top 4 artigos semelhantes)
               │
               ├─► [Filtro e Metadados] (Remove nulos, corta similaridade < 0.65)
               │
               ├─► [Montagem do Prompt] (Concatena artigos ao prompt de sistema)
               │
               ├─► [Gemini 1.5 Flash] (Gera resposta streaming baseada nas fichas)
               │
               ▼  (HTTP Streaming + Metadados das Fontes no Header)
       [Chat em Tempo Real] (Exibe resposta caractere por caractere e links)
```

### Componentes:
* **Interface do Chat (`ChatInterface.tsx`):** Componente cliente interativo com histórico de balões de mensagens, scroll automático, barra de carregamento e suporte a Drawer lateral para exibição completa de artigos de fontes correlacionados.
* **Modelo Conversacional:** **Gemini 1.5 Flash** (`gemini-1.5-flash`), escolhido pelo tempo de resposta rápido (baixa latência de streaming), janela de contexto longa (1M tokens) e custo de token mínimo.
* **Canalizador de Stream:** Um buffer dinâmico lê as partes da resposta do Gemini vindo da API (`generateContentStream`) e as encaminha em tempo real via `ReadableStream` para a resposta HTTP no cliente.

---

## 3. Fluxo de Dados

1. O usuário digita uma pergunta na caixa de entrada e envia.
2. A `ChatInterface` envia a pergunta atual e o histórico das últimas 6 mensagens em um payload JSON para `POST /api/knowledge/chat`.
3. O servidor valida a autenticação do usuário.
4. O servidor obtém o vetor da pergunta do usuário com o `text-embedding-004`.
5. Consulta o Firestore buscando os top 4 documentos da coleção `knowledgeItems` mais próximos em similaridade de cosseno (filtrando apenas itens publicados e ativos).
6. Limita as referências a artigos com similaridade `>= 0.65`.
7. Concatena os textos clínicos dos artigos recuperados a uma instrução de sistema blindada e rígida.
8. Envia o histórico estruturado de conversação e o prompt concatenado para a API de geração do Gemini.
9. Emite os metadados dos artigos recomendados (ID, título, resumo, conteúdo, nível de evidência e faixa etária) serializados no cabeçalho HTTP customizado `x-sources-metadata`.
10. O cliente lê o cabeçalho imediatamente antes do stream de texto e armazena as referências na mensagem atual do histórico.
11. Decodifica o corpo da resposta em streaming HTTP caractere por caractere, atualizando a mensagem da IA na interface do usuário.

---

## 4. Blindagem de Prompt e Segurança (LGPD)

O prompt de sistema em [route.ts](file:///c:/tea_guia_inteligente/src/app/api/knowledge/chat/route.ts) aplica diretrizes inquebráveis ao LLM:
* **Disclaimer Clínico:** A IA deve sempre iniciar ou finalizar frisando que é uma ferramenta educativa e que não substitui profissionais de saúde habilitados.
* **Fidelidade de Origem:** Se as fichas clínicas injetadas forem insuficientes para responder, o assistente deve expressar honestamente que não encontrou informações na base e sugerir consulta especializada.
* **Não-Diagnóstico:** O modelo está estritamente proibido de efetuar diagnósticos ou recomendar dosagens de substâncias/medicamentos.
* **Privacidade do Usuário:** O histórico de conversa reside exclusivamente em memória no navegador do cliente (não é salvo em logs ou no Firestore). Mensagens proativas desencorajam o envio de dados pessoais identificáveis das crianças no chat.

---

## 5. Manutenção

* **Ajuste de Comportamento:** Modificações nas diretrizes de tom de voz ou comportamento da IA podem ser feitas ajustando a constante `SYSTEM_INSTRUCTION_BASE` no arquivo [route.ts](file:///c:/tea_guia_inteligente/src/app/api/knowledge/chat/route.ts).
* **Limiar de RAG:** O limiar de corte para artigos considerados relevantes está configurado em `0.65` (`SIMILARITY_THRESHOLD`). Se as fontes parecerem pouco conectadas às respostas, suba o valor (Ex: para `0.70`).
