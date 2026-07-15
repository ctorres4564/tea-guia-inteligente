# ADR-003 — Fluxo de Revisão nas Regras e Autorização Cruzada no Storage

**Status:** Aceito
**Data:** 2026-07-15

## Contexto

Ao implementar o CRUD de conteúdos (Fase 2), duas lacunas nas regras
definidas na Fase 0/1 precisaram ser resolvidas:

1. A regra original de `knowledgeItems` exigia `isReviewer()` para
   **qualquer** mudança de `reviewStatus`, inclusive a submissão de um
   rascunho para revisão (`draft` → `in_review`) feita pelo próprio autor
   (`professional`). Isso impedia o fluxo básico de submissão descrito no
   PRD ("profissionais... possam criar ou editar conteúdos").
2. Não havia regra para exclusão lógica (`deletedAt`) — um editor de
   conteúdo comum poderia, sem querer, "excluir" (via `deletedAt`) um
   conteúdo de outro autor, contrariando "somente administradores possam
   excluir conteúdos".
3. O upload de materiais (Storage) precisa ser restrito a editores de
   conteúdo, mas o papel do usuário só existe no Firestore
   (`profiles/{uid}.role`), não no token de autenticação nem no próprio
   Storage.

## Decisão

1. **Regra de `knowledgeItems.update` refinada:** qualquer editor de
   conteúdo pode mover o `reviewStatus` livremente entre `draft` e
   `in_review`; apenas transições para `approved`, `published` ou
   `rejected` exigem `isReviewer()`. Alterar `deletedAt` exige
   `isAdmin()`, independentemente do restante da edição. Ver
   `firebase/firestore.rules`.
2. **Autorização cruzada no Storage:** `firebase/storage.rules` usa as
   funções `firestore.get()`/`firestore.exists()` (Storage Security Rules
   v2) para ler `profiles/{uid}.role` diretamente do Firestore do mesmo
   projeto, replicando a mesma fonte única de verdade de papéis já usada
   nas regras do Firestore (ver ADR-002). O caminho `/knowledge/{itemId}/*`
   permite leitura pública (materiais de conteúdo publicado são de
   interesse público) e escrita restrita a `professional`/`reviewer`/
   `administrator`.

## Alternativas consideradas

- **Custom Claims para papéis, também usados no Storage:** resolveria o
  problema de forma mais performática (sem leitura cruzada ao Firestore a
  cada upload), mas exigiria sincronização adicional via Admin SDK sempre
  que um papel mudasse. Mantido como melhoria futura (ver
  `docs/architecture/security.md`).
- **Rota de servidor (Route Handler) para mediar uploads, usando Admin
  SDK:** adicionaria uma camada extra de indireção sem ganho de segurança
  relevante, já que as regras do Storage já validam tamanho, tipo e papel
  diretamente. Não adotada nesta fase.

## Consequências

- O fluxo de submissão para revisão funciona sem exigir papel de revisor,
  como esperado pelo PRD.
- Exclusão (lógica ou física) de conteúdos é, em todos os casos, restrita
  a administradores.
- Uploads dependem da disponibilidade do Firestore no momento da escrita
  no Storage (mesma limitação já aceita para as regras do Firestore desde
  a Fase 0/1 — fail-safe: nega por padrão se o perfil não puder ser lido).
