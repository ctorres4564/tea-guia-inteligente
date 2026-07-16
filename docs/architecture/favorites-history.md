# Histórico e Favoritos (Fase 6)

Este documento descreve a arquitetura, fluxo de dados e manutenção dos mecanismos de **Favoritos** e **Histórico de Navegação/Interações** no TEA Guia Inteligente.

---

## 1. Coleções do Firestore

O armazenamento é feito por usuário, de forma isolada, em subcoleções:

### Favoritos (`favorites/{userId}/items/{favoriteId}`)
Salva os artigos clínicos preferidos do usuário.
* **knowledgeItemId:** ID do artigo clínico.
* **createdAt:** timestamp de criação.

### Histórico (`history/{userId}/items/{historyId}`)
Registra as interações e termos buscados ou lidos pelo usuário.
* **type:** `"search"` (busca na interface), `"question"` (pergunta à IA) ou `"view"` (artigo clínico aberto).
* **query:** texto buscado ou perguntado (opcional).
* **knowledgeItemId:** ID do artigo clínico visualizado (opcional).
* **createdAt:** timestamp de criação.

As regras de acesso em `firebase/firestore.rules` garantem que apenas o próprio proprietário (`isOwner(userId)`) e com conta ativa possa ler e escrever nesses documentos.

---

## 2. Fluxo de Dados

### Registro Automático de Histórico
1. **Busca Semântica:** Ao obter resultados com sucesso na `SearchInterface`, o sistema dispara `addHistoryEntry` registrando a query.
2. **Chat de IA:** Ao submeter uma pergunta ao assistente virtual, o sistema dispara `addHistoryEntry` registrando a pergunta.
3. **Leitura de Artigo:** Ao abrir o Drawer lateral de um artigo clínico na busca, chat ou favoritos, o sistema registra `addHistoryEntry` do tipo `"view"`, vinculando o ID do artigo.

### Gerenciamento de Favoritos
* **Cards e Drawers:** O usuário pode alternar a estrela de favoritos a partir de qualquer card de resultado na busca ou de dentro do Drawer lateral (no chat, favoritos ou busca).
* **Reatividade:** Ao desfavoritar um artigo a partir de `/dashboard/favoritos`, o estado local do React remove o card instantaneamente, mantendo a experiência do usuário fluida.

### Ações Rápidas na Timeline (Histórico)
* **Refazer Busca:** Redireciona o usuário para `/dashboard?q={query}`. A `SearchInterface` captura o query param `q` no carregamento e executa a busca semântica automaticamente.
* **Refazer Pergunta:** Redireciona o usuário para `/dashboard/chat?q={query}`. A `ChatInterface` captura o query param `q` no carregamento e pré-preenche a barra de mensagem para facilitar o reenvio.
* **Ver Novamente:** Abre o Drawer de visualização completa do artigo correspondente ali mesmo na tela de histórico, registrando um novo evento de visualização.

---

## 3. Manutenção e Boas Práticas

* **Resolução de Fichas Clínicas:** Na listagem de favoritos e histórico, as referências são unificadas usando `Promise.all` em lote com `getKnowledgeItem` para otimizar os tempos de resposta.
* **Limitação de Consulta:** O histórico carrega apenas os últimos 30 registros (`limit(30)`) para economizar recursos de leitura do Firestore e otimizar a renderização no front-end.
