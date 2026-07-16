---
name: continuar-tea-guia
description: Continuar o desenvolvimento do TEA Guia Inteligente com Next.js, TypeScript, Firebase e Vercel. Usar quando o usuário pedir para implementar fases do ROADMAP, corrigir ou ampliar autenticação, painel administrativo, base de conhecimento, embeddings, busca semântica, RAG, favoritos, histórico, perfil, recomendações, observabilidade, regras Firebase, testes ou deploy deste repositório.
---

# Continuar o TEA Guia Inteligente

Desenvolver este repositório preservando a arquitetura, a segurança e o escopo já aprovados. Não iniciar várias fases do roadmap automaticamente; implementar somente a etapa solicitada e suas dependências indispensáveis.

## Orientação inicial obrigatória

1. Executar `git status --short --branch` e preservar alterações existentes.
2. Ler `../../../README.md` e `../../../ROADMAP.md`.
3. Ler somente as referências pertinentes à tarefa:
   - arquitetura: `../../../docs/architecture/overview.md`;
   - dados: `../../../docs/architecture/firestore-model.md`;
   - segurança: `../../../docs/architecture/security.md`;
   - decisões: `../../../docs/decisions/ADR-*.md`;
   - requisitos originais: `../../../prd.txt` e `../../../plano de aplicacao.txt`.
4. Inspecionar o código e os testes do domínio afetado antes de editar.
5. Confirmar a fase e os critérios de aceite implícitos na solicitação. Perguntar somente quando uma decisão de produto ou provedor mudar materialmente a solução.

## Estado e stack que devem ser preservados

- Fases 0/1 e 2 estão implementadas.
- Usar Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Firebase, Zod, React Hook Form e Vitest.
- Manter Vercel como destino do aplicativo web e Node.js 20 como runtime preferencial.
- Tratar `src/lib/validation/**` como fonte de verdade dos formatos de dados.
- Centralizar nomes de coleções em `src/types/firestore.ts`.
- Manter regras de negócio em `src/domains/**`; evitar chamadas Firebase dispersas em componentes.
- Usar Firebase Client SDK apenas no navegador e Firebase Admin apenas no servidor.
- Criar uma ADR antes de alterar stack, estratégia de autenticação, banco vetorial, provedor de IA ou modelo de autorização.

## Invariantes de segurança

- Nunca ler em voz alta, imprimir, copiar para documentação, commitar ou enviar ao chat valores de `.env*`, `serviceAccountKey.json`, tokens ou chaves privadas.
- Nunca remover do `.gitignore` `.env.local`, `.env.vercel`, `.env.production.local` ou `serviceAccountKey.json`.
- Nunca prefixar credenciais administrativas com `NEXT_PUBLIC_`.
- Preservar `server-only` nos módulos que usam Firebase Admin.
- Manter a autenticação em duas camadas: presença do cookie no middleware e validação criptográfica no servidor.
- Não confiar em controles da interface para autorização. Reforçar permissões nas regras do Firestore/Storage ou em Route Handlers com Admin SDK.
- Manter negação por padrão nas regras e impedir autopromoção de papel/status.
- Preservar os papéis `family`, `educator`, `professional`, `reviewer` e `administrator` e o fluxo de revisão documentado.
- Tratar o produto como educacional e informativo. Não gerar diagnóstico, prescrição ou substituição de atendimento profissional.
- Para RAG, exibir fontes e limitar respostas ao contexto recuperado; comunicar ausência ou baixa confiança de evidência.

## Fluxo de implementação

1. Definir uma fatia vertical pequena: dados/regras, serviço, interface e testes.
2. Atualizar schemas Zod e tipos antes ou junto das operações que os consomem.
3. Atualizar regras e índices Firebase sempre que uma nova consulta ou mutação exigir.
4. Usar `serverTimestamp()` para datas persistidas e operações atômicas do Firestore quando aplicável.
5. Mapear erros Firebase com os helpers existentes e apresentar mensagens seguras ao usuário.
6. Manter Client Components mínimos; preferir Server Components quando não houver estado, evento ou SDK cliente.
7. Preservar acessibilidade, responsividade e o disclaimer educacional.
8. Atualizar `README.md`, `ROADMAP.md`, `CHANGELOG.md` e ADRs somente na medida afetada pela entrega.

## Regras para as próximas fases

- **Fase 3 — embeddings:** não escolher banco/modelo silenciosamente. Criar ADR, definir dimensões, versionamento, reprocessamento e custo antes da implementação.
- **Fase 4 — busca:** medir relevância, suportar filtros documentados e evitar consultas Firestore que dependam de índices ausentes.
- **Fase 5 — RAG:** separar recuperação, montagem de contexto, geração e citações; proteger prompts e aplicar limites de uso.
- **Fase 6 — favoritos/histórico:** reutilizar as subcoleções e regras já modeladas; confirmar isolamento por usuário.
- **Fase 7 — perfil da criança:** minimizar dados sensíveis, obter consentimento explícito e documentar retenção/exclusão antes de persistir.
- **Fases 8/9:** tornar recomendações explicáveis; adicionar logs sem dados sensíveis, métricas, rate limiting, cache e filas com ADRs quando necessário.

## Validação obrigatória

Executar, no mínimo:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Adicionar testes do domínio alterado. Para Firebase:

- preferir Emulator Suite para testes de regras e fluxos destrutivos;
- usar `npm run test:firebase` somente com autorização explícita para acessar o projeto real;
- garantir limpeza de usuários, documentos e objetos temporários;
- nunca executar seed contra produção.

Se um comando falhar, corrigir a causa e repetir. Não declarar sucesso apenas porque artefatos parciais foram gerados.

## Auditoria antes de commit ou deploy

Executar:

```bash
git status --short
git diff --check
git check-ignore -v .env.local .env.vercel serviceAccountKey.json
git ls-files .env.local .env.vercel serviceAccountKey.json
```

Confirmar que o último comando não lista nenhum arquivo. Inspecionar o diff e procurar credenciais antes de stagear caminhos explícitos. Não fazer commit, push, deploy, publicar regras ou alterar dados reais sem solicitação do usuário.

## Entrega

Relatar:

- resultado implementado;
- arquivos alterados;
- decisões e trade-offs;
- regras/índices/variáveis novos;
- testes executados e resultados;
- migrações ou passos manuais;
- riscos e pendências da próxima fase.

Manter o working tree previsível e não misturar refatorações alheias à tarefa.
