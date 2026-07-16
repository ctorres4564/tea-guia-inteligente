# ADR-006 — Recomendações Personalizadas e Notificações (Fase 8)

**Status:** Aceito
**Data:** 2026-07-16

## Contexto

A Fase 8 introduziu três recursos sobre a base de conhecimento já existente
(Fases 3–5): recomendações personalizadas no dashboard, conteúdos
relacionados automáticos na leitura de um artigo, e notificações de novos
conteúdos publicados. Três decisões de arquitetura precisam de registro
explícito.

## Decisão 1 — Uso do perfil da criança na busca de recomendações

`/api/knowledge/recommendations` usa `interests`, `sensitivities` e
`supportLevel` do(s) perfil(is) de criança cadastrado(s)
(`children/{userId}/profiles`) para montar uma consulta textual, gerar um
embedding (Gemini `text-embedding-004`) e rodar uma busca vetorial KNN nos
`knowledgeItems` publicados.

Isso **amplia diretamente o ponto 4 da
[[ADR-005-child-profile-privacy]]**, que previa uso do perfil da criança
exclusivamente para calibração de tom no chat, e listava como rejeitada
qualquer expansão que usasse o perfil para "filtrar a busca semântica" —
citando textualmente esta fase como gatilho de reavaliação.

Reavaliação: mantém-se aceitável porque (a) o dado enviado para geração de
embedding é derivado — interesses, sensibilidades e um nível de suporte em
linguagem leiga — nunca o campo `diagnosisStatus` bruto nem `notes`; (b) o
destino é o mesmo provedor de LLM já autorizado pela ADR-005 para o chat
(Google Gemini), não um novo serviço externo; (c) o resultado devolvido ao
cliente é só a lista de artigos recomendados e uma frase de justificativa
com o nome da criança — nunca o perfil em si, e a resposta só é visível ao
próprio dono da conta (rota exige `getActiveSession()`); (d) nada disso é
persistido em `notifications` (coleção global) nem em qualquer log.

Caso uma fase futura precise enviar dado do perfil da criança a um serviço
diferente do provedor de LLM atual, ou incluir o campo de diagnóstico bruto
na consulta, este ponto deve ser reavaliado novamente.

## Decisão 2 — Coleção `notifications`

Coleção global e rasa (`notifications/{id}`), sem escopo por usuário: leitura
liberada a qualquer conta com `status == "active"`, escrita bloqueada no
cliente (`allow write: if false` — só o Admin SDK grava, ao publicar um
conteúdo). Alternativa descartada: subcoleção por usuário
(`notifications/{userId}/items`), que permitiria estado de leitura por
usuário no servidor, mas exigiria fan-out de escrita (uma gravação por
usuário ativo a cada publicação) — desproporcional ao volume de conteúdo
publicado nesta fase do produto. Os documentos armazenam apenas metadado
público do conteúdo (`title`, `summary`, `contentId`, `contentSlug`,
`createdAt`) — nenhum dado pessoal ou de perfil de criança.

## Decisão 3 — Estado de leitura em `localStorage`

O controle de "lida"/"não lida" de cada notificação é mantido no
`localStorage` do navegador (`read_notifs_{uid}`), não no Firestore.

**Limitação conhecida:** o estado não sincroniza entre dispositivos ou
navegadores — um usuário que ler uma notificação no celular a verá como não
lida no computador. Aceitável para o volume e a natureza informativa deste
recurso nesta fase; deve ser reavaliado (migrando para uma subcoleção por
usuário) caso o produto passe a depender de notificações críticas ou
acionáveis.

## Decisão 4 — Limiares de similaridade distintos por rota

| Rota | Limiar | Motivo |
| ----- | ------ | ------ |
| `/api/knowledge/chat` | 0.65 | Precisão alta: o conteúdo recuperado é citado como fonte de uma resposta direta ao usuário — falso positivo aqui é o pior caso (informação incorreta atribuída à base clínica). |
| `/api/knowledge/recommendations` | 0.55 | Descoberta: melhor errar por mostrar algo próximo do que não recomendar nada; o usuário decide se o conteúdo é relevante. |
| `/api/knowledge/related` | 0.50 | Descoberta mais ampla ainda: contexto é um artigo que o usuário já está lendo, risco de irrelevância é menor. |

Os valores não estavam documentados nem eram consistentes entre as três
rotas antes desta ADR; a tabela acima formaliza a intenção retroativamente.
Ajustes futuros de limiar devem atualizar esta tabela.

## Consequências

- Recomendações e relacionados têm maior recall (mais resultados, menos
  precisos) que o chat, por design.
- A ADR-005 permanece válida em todos os demais pontos; apenas o ponto 4 é
  superado por esta ADR nesta fase específica.
- Pendência registrada: se o produto adicionar notificações por push/e-mail
  no futuro, a coleção `notifications` global precisará de um mecanismo de
  entrega por usuário — reavaliar a Decisão 2.
