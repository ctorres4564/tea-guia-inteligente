# ADR-002 — Estratégia de Autenticação e Proteção de Rotas

**Status:** Aceito
**Data:** 2026-07-15

## Contexto

O Firebase Authentication mantém o estado de sessão principalmente no
cliente (SDK JavaScript, `IndexedDB`/memória). O App Router do Next.js,
porém, renderiza Server Components e Route Handlers no servidor, onde o
SDK cliente do Firebase não está disponível. Isso cria uma lacuna: como
proteger rotas privadas (`/dashboard`) sem depender apenas de
redirecionamento no cliente, que pode ser contornado ou causar "flash" de
conteúdo protegido antes do redirecionamento?

## Decisão

Adotar uma estratégia **híbrida em duas camadas**, combinando cookies de
sessão do Firebase Admin SDK com verificação em middleware e em Server
Components:

### 1. Emissão do cookie de sessão (servidor)

Após login/cadastro bem-sucedido no cliente, o front-end obtém o
`idToken` do Firebase Auth e o envia para `POST /api/auth/session`
(`src/app/api/auth/session/route.ts`). Esse Route Handler roda em runtime
Node.js e usa `getAdminAuth().createSessionCookie()` para gerar um cookie
`__session`, `httpOnly`, `secure` em produção, `sameSite=lax`, válido por
5 dias.

O logout (`POST /api/auth/logout`) limpa esse cookie no servidor.

### 2. Camada 1 — Middleware (Edge Runtime, verificação leve)

`middleware.ts` verifica apenas a **presença** do cookie `__session` para
decidir redirecionamentos rápidos:
- sem cookie tentando acessar `/dashboard/*` → redireciona para `/login`;
- com cookie tentando acessar `/login`, `/cadastro` ou
  `/recuperar-senha` → redireciona para `/dashboard`.

**Limitação importante:** o middleware roda no Edge Runtime, que não
suporta as APIs Node.js exigidas pelo `firebase-admin` (criptografia,
`fs`, etc.). Portanto, o middleware **não verifica a assinatura nem a
validade real do cookie** — apenas sua presença. Um cookie forjado ou
expirado passaria por esta camada.

### 3. Camada 2 — Verificação no servidor (segurança real)

Todo layout/página sob `/dashboard` (Server Component) chama
`getSessionUser()` (`src/lib/security/session.ts`), que usa
`getAdminAuth().verifySessionCookie()` para validar criptograficamente o
cookie (assinatura, expiração, revogação) antes de renderizar qualquer
dado. Se inválido, a página redireciona para `/login`.

Ou seja: **o middleware cuida da experiência (evitar flash de conteúdo e
navegações desnecessárias); a verificação no servidor, com Admin SDK, é
a barreira de segurança que efetivamente protege os dados.**

### 4. Autorização (papéis)

Autenticação (quem é o usuário) é tratada como descrito acima.
Autorização (o que o usuário pode fazer) é resolvida consultando o
documento `profiles/{uid}` no Firestore — tanto nas regras de segurança
do Firestore (`firebase/firestore.rules`) quanto, quando necessário, em
Route Handlers no servidor. Custom Claims do Firebase Auth não foram
adotados nesta fase (ver comentário em `firebase/firestore.rules` e em
`docs/architecture/security.md`) para manter o modelo mais simples no
MVP; a migração para Custom Claims é uma melhoria futura recomendada caso
o custo de leituras extras no Firestore se torne relevante.

## Consequências

- Rotas privadas nunca dependem exclusivamente do estado do cliente.
- Existe uma pequena janela em que o middleware confia apenas na presença
  do cookie — mitigada pela verificação criptográfica obrigatória no
  Server Component antes de qualquer renderização de dado sensível.
- Toda alteração de papel/status de um usuário exige nova leitura do
  Firestore (sem cache de claims), o que é aceitável no volume esperado
  do MVP.

## Alternativas consideradas

- **Somente client-side (onAuthStateChanged + redirecionamento no
  cliente):** rejeitada — não protege dados renderizados no servidor nem
  chamadas de API sensíveis, e permite flash de conteúdo.
- **Custom Claims para papéis, verificados no middleware via
  `jose`/JWT decoding manual:** considerada para uma fase futura; hoje
  adicionaria complexidade desnecessária para o MVP.
