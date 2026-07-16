# Modelo de Dados — Cloud Firestore

## Convenções gerais

- Todo documento possui `createdAt` e `updatedAt` como
  `serverTimestamp()` do Firestore (nunca definidos pelo cliente
  manualmente), garantindo consistência mesmo com relógios de cliente
  divergentes.
- Exclusão lógica: coleções de conteúdo (`knowledgeItems`) usam
  `deletedAt` (nullable) em vez de exclusão física, permitindo auditoria
  e recuperação. A exclusão física (`delete`) é restrita a
  administradores.
- Versionamento: `knowledgeItems.version` é incrementado a cada revisão
  publicada (a lógica de incremento será implementada junto ao CRUD, na
  Fase 2).
- IDs: documentos usam o ID gerado pelo Firestore, exceto `profiles`, que
  usa o `uid` do Firebase Authentication como ID do documento.

## Coleções

### `profiles/{uid}`

| Campo       | Tipo                                                              |
| ----------- | ------------------------------------------------------------------ |
| uid         | string (= ID do documento)                                        |
| fullName    | string                                                             |
| email       | string                                                             |
| role        | `family \| educator \| professional \| reviewer \| administrator` |
| status      | `active \| inactive \| blocked \| pending`                        |
| avatarUrl   | string \| null                                                    |
| createdAt   | timestamp                                                          |
| updatedAt   | timestamp                                                          |

Criado automaticamente no cadastro, sempre com `role: "family"` e
`status: "active"` (nunca escolhido pelo usuário). Alteração de `role`/
`status` restrita a administradores (ver `firebase/firestore.rules`).

### `categories/{categoryId}`

| Campo        | Tipo                                    |
| ------------ | ---------------------------------------- |
| id           | string                                    |
| name         | string                                    |
| slug         | string (kebab-case)                       |
| description  | string                                    |
| parentId     | string \| null (permite hierarquia)      |
| status       | `draft \| published \| archived`         |
| displayOrder | number                                    |
| createdAt    | timestamp                                 |
| updatedAt    | timestamp                                 |

### `knowledgeItems/{itemId}`

| Campo           | Tipo                                                              |
| --------------- | ------------------------------------------------------------------ |
| id              | string                                                              |
| categoryId      | string (referência lógica a `categories`)                          |
| title           | string                                                              |
| slug            | string (kebab-case)                                                 |
| summary         | string                                                              |
| content         | string                                                              |
| targetAudience  | array de `family \| educator \| professional \| general`          |
| ageRange        | string (opcional)                                                    |
| tags            | array de string                                                     |
| evidenceLevel   | `low \| moderate \| high \| expert_consensus`                      |
| reviewStatus    | `draft \| in_review \| approved \| published \| rejected`          |
| version         | number                                                              |
| publishedAt     | timestamp \| null                                                    |
| createdBy       | string (uid)                                                       |
| reviewedBy      | string \| null (uid)                                                |
| createdAt       | timestamp                                                            |
| updatedAt       | timestamp                                                            |
| deletedAt       | timestamp \| null (exclusão lógica, restrita a administradores)      |
| attachments     | array de `{ path, url, name }` (materiais de apoio no Storage)      |

### `knowledgeSources/{sourceId}`

| Campo             | Tipo                                                                          |
| ------------------ | ------------------------------------------------------------------------------ |
| id                 | string                                                                          |
| knowledgeItemId    | string (referência lógica a `knowledgeItems`)                                  |
| title              | string                                                                          |
| authors            | array de string                                                                 |
| publication        | string (opcional)                                                                |
| publicationYear    | number (opcional)                                                                |
| url                | string (opcional)                                                                |
| doi                | string (opcional)                                                                |
| sourceType         | `article \| guideline \| book \| official_document \| systematic_review \| other` |
| createdAt          | timestamp                                                                        |

### `favorites/{userId}/items/{favoriteId}` (subcoleção)

Estrutura documentada nesta fase; **interface não implementada** — ver
ROADMAP.md.

| Campo            | Tipo      |
| ----------------- | --------- |
| knowledgeItemId   | string    |
| createdAt         | timestamp |

### `history/{userId}/items/{historyId}` (subcoleção)

Estrutura documentada nesta fase; **recurso não implementado** — ver
ROADMAP.md.

| Campo            | Tipo                          |
| ----------------- | ------------------------------ |
| type              | `question \| search \| view`  |
| query             | string (opcional)               |
| knowledgeItemId   | string \| null                  |
| createdAt         | timestamp                      |

### `children/{userId}/profiles/{childId}` (subcoleção — Fase 7)

Dado sensível (status diagnóstico de uma criança). Acesso restrito ao
próprio responsável, sem exceção administrativa — ver
`docs/decisions/ADR-005-child-profile-privacy.md`.

| Campo               | Tipo                                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| id                   | string                                                                          |
| name                 | string (nome ou apelido)                                                       |
| birthDate            | string (`AAAA-MM-DD`)                                                          |
| diagnosisStatus      | `not_diagnosed \| in_evaluation \| diagnosed`                                  |
| supportLevel         | `level_1 \| level_2 \| level_3 \| null` (aplicável apenas se `diagnosed`)       |
| communicationStyle   | `verbal \| verbal_with_support \| minimally_verbal \| non_verbal \| uses_aac \| null` |
| interests            | array de string (até 10)                                                        |
| sensitivities        | array de string (até 10)                                                        |
| notes                | string (opcional, até 500 caracteres)                                           |
| createdAt            | timestamp                                                                        |
| updatedAt            | timestamp                                                                        |

Usado apenas para personalizar o tom das respostas do assistente de IA
(`/api/knowledge/chat`) — nunca para diagnóstico, nunca lido por outra
conta.

## Versionamento (Fase 2)

`knowledgeItems.version` é incrementado atomicamente (`increment(1)`) a
cada chamada a `updateKnowledgeItemContent` — ou seja, toda edição de
título, resumo, conteúdo, público-alvo, tags, faixa etária ou nível de
evidência gera uma nova versão. Transições de `reviewStatus` (submissão,
aprovação, rejeição, publicação) e o vínculo/remoção de anexos NÃO
incrementam a versão, pois não alteram o conteúdo textual principal.

## Relacionamentos lógicos

O Firestore não impõe chaves estrangeiras — todas as referências abaixo
são lógicas e devem ser validadas na camada de aplicação (Zod + regras):

- `knowledgeItems.categoryId` → `categories/{id}`
- `knowledgeSources.knowledgeItemId` → `knowledgeItems/{id}`
- `favorites/{userId}/items/{id}.knowledgeItemId` → `knowledgeItems/{id}`
- `history/{userId}/items/{id}.knowledgeItemId` → `knowledgeItems/{id}`
- `knowledgeItems.createdBy` / `.reviewedBy` → `profiles/{uid}`
- `children/{userId}/profiles/{id}` → escopo lógico de `profiles/{userId}` (não referenciado por outras coleções)

## Índices compostos (`firebase/firestore.indexes.json`)

| Coleção          | Campos                                  | Consulta que depende deste índice                          |
| ----------------- | ---------------------------------------- | ------------------------------------------------------------ |
| `knowledgeItems`  | `reviewStatus ASC`, `publishedAt DESC`  | Listar conteúdos publicados, mais recentes primeiro          |
| `knowledgeItems`  | `categoryId ASC`, `reviewStatus ASC`    | Listar conteúdos publicados de uma categoria específica      |
| `categories`      | `status ASC`, `displayOrder ASC`        | Listar categorias publicadas, na ordem de exibição definida  |
| `items` (grupo)   | `createdAt DESC`                        | Consultas administrativas futuras sobre `favorites`/`history` entre usuários (collection group) |

Consultas simples dentro de uma única subcoleção de um usuário (ex.:
`history/{userId}/items` ordenado por `createdAt`) não exigem índice
composto — o Firestore já indexa campos únicos automaticamente.

## Estratégia de exclusão

- `profiles`, `categories`, `knowledgeSources`: exclusão física, restrita
  a administradores.
- `knowledgeItems`: exclusão lógica via `deletedAt`; exclusão física
  restrita a administradores e não exposta na interface desta fase.
- `children/{userId}/profiles`: exclusão física pelo próprio responsável
  (sem soft-delete — não há razão para reter o registro após remoção
  explícita pelo titular dos dados).
