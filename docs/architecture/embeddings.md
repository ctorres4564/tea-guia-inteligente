# Geração e Armazenamento de Embeddings (Fase 3)

Este documento descreve a arquitetura, o fluxo de dados e os procedimentos de manutenção do mecanismo de embeddings e indexação vetorial introduzidos na Fase 3 do TEA Guia Inteligente.

---

## 1. Objetivo

Os embeddings convertem os conteúdos textuais da base clínica (`knowledgeItems`) em vetores de 768 números reais, representando semanticamente cada ficha. Esses vetores viabilizam buscas semânticas (busca por sentido/intenção na Fase 4) e alimentam o pipeline de RAG (Fase 5) para embasamento de respostas do LLM.

---

## 2. Arquitetura

O sistema adota uma arquitetura nativa integrada ao ecossistema Google Cloud / Firebase do projeto, evitando bancos de dados vetoriais dedicados e sincronizadores externos:

```text
               [Painel Admin] (Ação de Publicar)
                      │
                      ▼
        [POST /api/admin/knowledge/publish] (Route Handler)
                      │
                      ├─► [Google Gen AI] (Gemini API text-embedding-004)
                      │
                      ▼
             [Firestore Database] (Gravação nativa)
          ├─► knowledgeItems/{id} (campo "embedding" via FieldValue.vector)
          └─► Índice Vetorial Flat (768 dimensões, Métrica Cosine)
```

### Componentes:
* **Provedor:** Google Gen AI SDK (`@google/genai`) utilizando o modelo `text-embedding-004` (multilíngue, custo-benefício excelente para português brasileiro).
* **Vetor:** 768 dimensões de ponto flutuante.
* **Banco Vetorial:** **Firestore Vector Search** nativo, permitindo indexação e consultas KNN diretamente na coleção `knowledgeItems` através da nova propriedade `embedding` e do índice vetorial definido em `firestore.indexes.json`.

---

## 3. Fluxo de Dados

### Geração Incremental (Publicação no Painel)
Para proteger a chave privada `GEMINI_API_KEY` de vazamentos no front-end, a geração do embedding ocorre de forma síncrona/transacional no servidor:

1. O Revisor/Administrador aciona a publicação na UI do painel administrativo.
2. A aplicação front-end envia o ID do item de conhecimento ao Route Handler `POST /api/admin/knowledge/publish`.
3. O servidor valida a sessão do usuário (exigindo papel de `reviewer` ou `administrator`).
4. O servidor compõe o texto que será indexado concatenando os campos do documento:
   `texto = titulo + "\n" + resumo + "\n" + conteudo + "\nTags: " + tags.join(", ")`
5. O servidor solicita à API do Gemini o vetor de embeddings para o texto composto.
6. Usando o Firebase Admin SDK, o servidor atualiza o status do item para `published` e grava o vetor de embeddings no campo `embedding` usando a função nativa `FieldValue.vector(values)`.

*Nota: Em desenvolvimento local (com emuladores ativos) sem `GEMINI_API_KEY` configurada, o servidor gera automaticamente um vetor mockado de 768 zeros e valores aleatórios, permitindo testar toda a interface administrativa localmente sem custo e de forma independente.*

### Processamento Retroativo (Sincronização em Lote)
Para vetorizar fichas antigas ou em caso de mudanças nas fichas pré-existentes, o script administrativo `scripts/generate-all-embeddings.mjs` realiza uma varredura:
1. Consulta todos os documentos publicados no Firestore.
2. Identifica quais não possuem o campo `embedding` ou possuem vetor inválido.
3. Solicita os embeddings para cada um deles sequencialmente à API do Gemini e atualiza os documentos.

---

## 4. Manutenção da Funcionalidade

### Execução de Comandos

#### Sincronização Retroativa no Emulador Local:
```bash
# Executa a geração em lote contra o Firestore Emulator
export FIRESTORE_EMULATOR_HOST="127.0.0.1:8080"
node scripts/generate-all-embeddings.mjs
```

#### Sincronização Retroativa em Produção:
```bash
# Carrega as variáveis de ambiente do .env.local e executa
node --env-file=.env.local scripts/generate-all-embeddings.mjs
```

### Configuração de Índice
O índice vetorial está configurado na seção `fieldOverrides` do arquivo [firestore.indexes.json](file:///c:/tea_guia_inteligente/firebase/firestore.indexes.json). Se houver necessidade de recriar o índice ou alterar a dimensão do vetor, execute o deploy dos índices via Firebase CLI:
```bash
firebase deploy --only firestore:indexes
```

### Custos de Operação
* A precificação do `text-embedding-004` é baseada em tokens ($0.000025 por 1.000 tokens).
* Uma base de dados típica de 500 fichas clínicas (contendo ~500 palavras cada) consumirá cerca de 250.000 tokens para vetorização total, o que custa menos de **$0.01** (um centavo de dólar) no total.
* A regeneração de embeddings só é feita durante publicação/edições, gerando custos recorrentes desprezíveis.
