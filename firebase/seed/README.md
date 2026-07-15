# Seed de dados (Firebase Emulator Suite)

`seed.mjs` popula um conjunto mínimo de categorias e conteúdos de exemplo
**apenas no Firestore Emulator**, útil para testar o painel administrativo
e o fluxo de revisão sem depender de um projeto Firebase real.

## Uso

```bash
# Terminal 1
npm run firebase:emulators

# Terminal 2 (com o emulador já rodando)
npm run firebase:seed
```

O script força `FIRESTORE_EMULATOR_HOST` e usa um `projectId` de
demonstração (`demo-tea-guia-inteligente`) antes de inicializar o Admin
SDK — mesmo que variáveis de credenciais reais estejam definidas no
ambiente, a escrita nunca alcança um projeto Firebase real.

O script é idempotente: rodar mais de uma vez não duplica categorias nem
conteúdos (verifica por `slug` antes de criar).

A importação em massa da base de conhecimento clínica completa (dezenas/
centenas de fichas revisadas por especialistas) continua fora do escopo
desta fase — este seed é apenas para desenvolvimento e testes.
