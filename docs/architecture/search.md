# Busca Inteligente / Busca Semântica (Fase 4)

Este documento descreve a arquitetura, o fluxo de dados e os aspectos de manutenção do mecanismo de busca semântica baseado em inteligência artificial do TEA Guia Inteligente.

---

## 1. Objetivo

A Busca Inteligente permite que pais, educadores e profissionais encontrem artigos clínicos na base de conhecimento usando linguagem natural livre. Em vez de depender de correspondência exata de palavras-chave (como buscas tradicionais baseadas em strings), o sistema compreende o sentido conceitual da pergunta do usuário (similaridade semântica) e retorna as orientações clínicas mais relevantes.

---

## 2. Arquitetura

A busca semântica está estruturada de maneira centralizada no lado do servidor para garantir a proteção de chaves de API e a eficiência de execução:

```text
  [Interface do Usuário] (SearchInterface.tsx)
             │
             ▼  (HTTP POST /api/knowledge/search)
   [Route Handler de Busca] (src/app/api/knowledge/search/route.ts)
             │
             ├─► [Google Gen AI] (API text-embedding-004)
             │      (Gera o vetor de 768 dimensões para a busca)
             │
             ├─► [Firestore Database] (Busca KNN via findNearest)
             │      (Filtra itens publicados e encontra os 30 mais próximos)
             │
             ├─► [Processamento em Memória] (Servidor Next.js)
             │      (Aplica filtros de categoria, público e idade; calcula relevância)
             │
             ▼
      [JSON de Resultados] (Ordenados por similaridade de cosseno)
```

### Componentes:
* **Interface do Usuário (`SearchInterface.tsx`):** Componente interativo que oferece entrada para texto de pesquisa e filtros avançados (Categoria, Público-alvo e Faixa Etária). Apresenta os resultados ranqueados com porcentagem de relevância semântica baseada na similaridade de cosseno.
* **Vetorização da Pesquisa (`route.ts`):** O servidor gera o vetor de embeddings da pergunta do usuário usando o modelo `text-embedding-004` (Google Gen AI SDK).
* **Busca KNN no Firestore (`findNearest`):** O servidor executa uma consulta do tipo K-Nearest Neighbors (KNN) na coleção `knowledgeItems` usando a métrica `COSINE`.
* **Pós-filtragem em Memória:** Para otimizar a infraestrutura e evitar a criação de múltiplos índices compostos vetoriais complexos no Firestore para cada combinação de filtro (público, categoria, faixa etária), o servidor traz os resultados mais próximos e aplica as filtragens finas em memória no ambiente de execução do servidor Next.js.
* **Limiar de Corte:** Para prevenir a exibição de resultados irrelevantes para perguntas desconexas, é aplicado um limiar mínimo de corte de similaridade de cosseno de **0.65** (`SIMILARITY_THRESHOLD`).

---

## 3. Fluxo de Dados

1. O usuário digita a pergunta no campo de busca (Ex: *"ecolalia e repetição"*) e opcionalmente escolhe um público-alvo (Ex: *"Educadores"*).
2. O formulário envia uma requisição `POST` com os parâmetros para `/api/knowledge/search`.
3. A rota de API valida a sessão do usuário (exige conta ativa).
4. O servidor chama a API do Gemini com o termo de busca *"ecolalia e repetição"* para obter o vetor de consulta.
5. O servidor cria uma query no Firestore filtrando os documentos publicados (`reviewStatus == "published"`, `deletedAt == null`) e chama `findNearest` com o vetor de consulta para recuperar até 30 itens com a menor distância de cosseno.
6. A distância retornada do Firestore (`searchDistance`) é convertida em pontuação de similaridade de cosseno (`similarity = 1 - distance`).
7. O servidor filtra a lista para conter apenas itens correspondentes aos filtros selecionados (Categoria, Público, Idade) e com pontuação superior a `0.65`.
8. Retorna a lista contendo no máximo 10 resultados para o cliente exibir de forma elegante.

---

## 4. Manutenção e Atualização

### Índices Compostos
O Firestore exige apenas o índice de vetor padrão configurado no override de campo (`fieldOverrides` para o campo `embedding`) do arquivo `firestore.indexes.json`. Não são necessários índices combinados extras devido à nossa estratégia de pós-filtragem no servidor, reduzindo os custos e cotas de uso do banco de dados.

### Manutenção da Qualidade de Busca
* **Limiar de Relevância:** Se os resultados das pesquisas começarem a parecer excessivamente distantes do desejado, o valor de `SIMILARITY_THRESHOLD` no arquivo [route.ts](file:///c:/tea_guia_inteligente/src/app/api/knowledge/search/route.ts) pode ser aumentado para um valor mais restritivo (Ex: `0.70`).
* **Formatos de dados no Seed:** Novos conteúdos inseridos em ambiente de testes pelo [seed.mjs](file:///c:/tea_guia_inteligente/firebase/seed/seed.mjs) devem obrigatoriamente preencher o campo `embedding` com o vetor apropriado (usando mocks em desenvolvimento e embeddings reais em produção via Route Handler de publicação).
