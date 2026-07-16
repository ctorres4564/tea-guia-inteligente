# Segurança

## Regras de acesso (Firestore e Storage)

As regras completas estão em `firebase/firestore.rules` e
`firebase/storage.rules`. Nenhuma regra usa `allow read, write: if true`.
Resumo:

- Usuários não autenticados: leitura apenas de `categories` e
  `knowledgeItems` com status `published` (e `deletedAt == null`), além
  de `knowledgeSources`.
- Usuários autenticados: podem ler e atualizar apenas o próprio
  `profiles/{uid}` (sem alterar `role`, `status`, `uid` ou `email`).
- `favorites/{userId}/**` e `history/{userId}/**`: acesso restrito ao
  próprio usuário (`request.auth.uid == userId`) e exige conta com
  `status == "active"`.
- Criação/edição de conteúdo (`categories`, `knowledgeItems`): restrita a
  papéis `professional`, `reviewer` e `administrator`.
- Submissão de conteúdo para revisão (`draft` → `in_review`): qualquer
  editor de conteúdo, inclusive o próprio autor (refinado na Fase 2 — ver
  ADR-003).
- Aprovação, rejeição e publicação de conteúdo (mudança de `reviewStatus`
  para `approved`, `rejected` ou `published`): restrita a `reviewer` e
  `administrator`.
- Exclusão lógica (`deletedAt`) e física de conteúdo: restritas a
  `administrator`, mesmo para outros editores de conteúdo (ADR-003).
- Upload de materiais em `/knowledge/{itemId}/**` (Storage): restrito a
  `professional`, `reviewer` e `administrator`, verificado via
  `firestore.get()` nas regras do Storage (autorização cruzada
  Storage↔Firestore — ver ADR-003).
- `children/{userId}/profiles/{childId}` (Fase 7): acesso restrito ao
  próprio responsável — **sem exceção para `administrator`**, diferente
  de todas as demais coleções desta seção. Dado de saúde de uma criança
  (ver ADR-005). Desde a Fase 8, também alimenta a busca de recomendações
  personalizadas — sem sair do servidor, sem exceção de acesso adicional
  (ver ADR-006, Decisão 1).
- `notifications/{notificationId}` (Fase 8): leitura liberada a qualquer
  conta com `status == "active"`; escrita bloqueada no cliente — apenas o
  Admin SDK grava, ao publicar um conteúdo. Contém só metadado público de
  conteúdo já publicado, nenhum dado pessoal (ver ADR-006, Decisão 2).

## Papéis (roles)

`family`, `educator`, `professional`, `reviewer`, `administrator`
(definidos em `src/lib/validation/profile.schema.ts`). Todo novo cadastro
recebe `family` — nenhuma interface permite ao usuário escolher seu
próprio papel.

## Estratégia de leitura de papel nas regras

Optou-se por **ler `profiles/{uid}.role` diretamente nas regras do
Firestore**, em vez de usar Firebase Auth Custom Claims, para manter o
modelo simples nesta fase do MVP. Isso implica uma leitura adicional do
Firestore por verificação de regra (custo aceitável no volume atual).
Ver `firebase/firestore.rules` para a implementação (`function hasRole`)
e `docs/decisions/ADR-002-auth-strategy.md` para a justificativa.

Melhoria futura recomendada: migrar para Custom Claims quando o custo de
leitura das regras se tornar relevante, sincronizando o claim via
Firebase Admin SDK sempre que `role` for alterado por um administrador.

## Proteção de rotas

Ver `docs/decisions/ADR-002-auth-strategy.md` para o detalhamento
completo. Resumo: cookie de sessão `httpOnly` emitido pelo Firebase Admin
SDK, verificado de forma leve no middleware (Edge) e de forma
criptográfica completa nos Server Components sob `/dashboard`.

## Tokens e credenciais

- **Firebase Client SDK (`NEXT_PUBLIC_FIREBASE_*`):** não são segredos —
  são identificadores públicos do projeto Firebase, mas ainda assim
  nunca devem conter valores fixos no código-fonte (sempre via variáveis
  de ambiente) e a segurança real depende das regras do Firestore/Storage.
- **Firebase Admin SDK (`FIREBASE_ADMIN_*`):** credenciais administrativas
  reais. Usadas exclusivamente em módulos marcados com `import
  "server-only"` (`src/lib/firebase/admin.ts`,
  `src/lib/security/session.ts`, rotas de API de sessão), nunca
  expostas ao navegador, nunca logadas.
- O arquivo de conta de serviço (JSON) **nunca é commitado** — apenas as
  três variáveis (`FIREBASE_ADMIN_PROJECT_ID`,
  `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY`) extraídas
  dele, definidas como variáveis de ambiente no ambiente de execução
  (local: `.env.local`; produção: variáveis de ambiente da Vercel).

## Tratamento de erros

Todo erro vindo do Firebase (Authentication, Firestore, Storage) é
convertido por `src/lib/errors/firebase-errors.ts` em uma mensagem segura
em português antes de chegar à interface. Mensagens técnicas, códigos
internos e stack traces nunca são exibidos ao usuário (ver
`src/app/error.tsx` para o error boundary global).

## LGPD

Dados pessoais tratados: nome completo, e-mail, papel e status de conta
(coleção `profiles`). Desde a Fase 7, também dado de saúde de uma criança
(status diagnóstico, nível de suporte) na coleção `children/{userId}/
profiles` — tratado com controles adicionais: acesso restrito ao titular
da conta sem exceção administrativa, uso para calibração de tom do
assistente de IA e, desde a Fase 8, para a busca vetorial de recomendações
personalizadas — em ambos os casos nunca usado para diagnóstico nem
enviado a serviços além do provedor do LLM já autorizado (ver ADR-005 e
ADR-006). Recomendações para fases futuras:

- Política de privacidade e termos de uso acessíveis publicamente antes
  do cadastro (nesta fase, o cadastro já exige aceite explícito de uma
  declaração de finalidade educacional — ver formulário de cadastro).
- Mecanismo de exclusão/anonimização de conta mediante solicitação do
  titular dos dados — deve incluir a exclusão de `children/{userId}/
  profiles/**` (pendência registrada em ADR-005).
- Registro de consentimento com timestamp (hoje, implícito no aceite do
  formulário; recomenda-se registrar explicitamente em fase futura).
- Criptografia em trânsito: garantida pelo HTTPS obrigatório da
  Vercel e do Firebase. Criptografia em repouso: garantida pela
  infraestrutura do Firebase/Google Cloud.

## Riscos conhecidos

- Leitura de `role` a partir do Firestore nas regras adiciona uma
  dependência de disponibilidade do Firestore para autorização — se o
  documento de perfil for corrompido/ausente, o acesso é negado por
  padrão (fail-safe), nunca liberado por padrão.
- O middleware não valida criptograficamente o cookie (ver ADR-002) —
  mitigado pela verificação obrigatória no servidor antes de qualquer
  renderização de dado sensível.
