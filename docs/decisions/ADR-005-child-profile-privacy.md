# ADR-005 — Privacidade do Perfil da Criança (Fase 7)

**Status:** Aceito
**Data:** 2026-07-16

## Contexto

A Fase 7 do ROADMAP prevê cadastro de perfil da criança (idade, diagnóstico,
preferências) para personalizar as respostas do assistente de IA. Diferença
importante em relação a todos os dados tratados até aqui: `diagnosisStatus`
e `supportLevel` são dados de saúde de uma criança — categoria
particularmente sensível, tanto pela natureza do dado quanto pela idade do
titular.

## Decisão

1. **Modelagem isolada por conta:** `children/{userId}/profiles/{childId}`
   — mesmo padrão de subcoleção já usado em `favorites`/`history`. Nunca
   existe um documento de criança fora do escopo de um responsável.
2. **Acesso restrito ao próprio responsável, sem exceção administrativa:**
   diferentemente de `profiles` (que administradores podem ler para
   suporte), `children/**` só pode ser lido pelo próprio dono da conta —
   nem mesmo `administrator` tem `allow read` nesta coleção (ver
   `firebase/firestore.rules`). Não há caso de uso de suporte que
   justifique acesso administrativo a dado de saúde de uma criança nesta
   fase.
3. **Uso exclusivo para personalização de tom, nunca para diagnóstico:**
   o perfil da criança é injetado no `systemInstruction` do endpoint de
   chat (`/api/knowledge/chat`) apenas como contexto de calibração (idade,
   nível de suporte, interesses, sensibilidades). O prompt reforça
   explicitamente que essa informação NUNCA deve ser usada para
   diagnosticar ou avaliar clinicamente, reiterando a proibição de
   diagnósticos já presente na instrução base do assistente.
4. **Nenhum uso além do próprio chat nesta fase:** o perfil da criança não
   é usado para filtrar a busca semântica, não é enviado a nenhum serviço
   externo além do provedor do LLM (Google Gemini, como já ocorre com a
   pergunta do usuário), e não é persistido em nenhum log de aplicação.
5. **Campo de diagnóstico como enum de status, não como taxonomia
   clínica:** optou-se por um campo simples (`not_diagnosed` /
   `in_evaluation` / `diagnosed`) e um nível de suporte alinhado à
   linguagem leiga do DSM-5 (Nível 1/2/3), em vez de códigos CID ou campos
   de texto livre para "diagnóstico" — reduz o risco de o campo virar um
   registro clínico de fato, mantendo o produto no seu escopo declarado de
   ferramenta educacional (nunca clínica).

## Alternativas consideradas

- **Permitir leitura administrativa do perfil da criança para suporte ao
  usuário:** rejeitada nesta fase — não há funcionalidade administrativa
  que precise disso, e a superfície de exposição de dado de saúde de menor
  deve ser a menor possível.
- **Campo de diagnóstico como texto livre:** rejeitada — texto livre
  tende a acumular informação clínica detalhada (nomes de condições
  associadas, medicações, relatórios), ampliando o escopo sensível do
  dado sem necessidade para a personalização pretendida.
- **Enviar o perfil da criança para geração de embeddings/busca:**
  rejeitada nesta fase — manter o perfil fora do pipeline de busca evita
  que informação sensível influencie o ranking de resultados ou apareça
  indiretamente em `sources` retornadas ao cliente.

## Consequências

- Famílias com mais de uma criança no espectro conseguem manter perfis
  separados e alternar entre eles na conversa (seletor no Chat).
- Qualquer expansão futura que use o perfil da criança para fins além de
  calibração de tom (ex.: recomendações de conteúdo filtradas por perfil —
  Fase 8) deve reavaliar esta ADR, especialmente o ponto 4.
- Exclusão de conta (funcionalidade ainda não implementada) deve remover
  também as subcoleções `children/{userId}/profiles/**` — registrado como
  pendência para quando o fluxo de exclusão de conta for implementado.

## Atualização — Fase 8

O ponto 4 desta ADR foi reavaliado e amplamente superado pela
[[ADR-006-recommendations-and-notifications]]: o perfil da criança agora
também alimenta a busca vetorial de recomendações personalizadas (não
apenas a calibração de tom do chat). Os demais pontos desta ADR
permanecem em vigor. Ver ADR-006, Decisão 1, para a justificativa
detalhada.
