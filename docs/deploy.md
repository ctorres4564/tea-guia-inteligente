# Guia de Deploy e Manutenção de Produção

Este guia descreve os passos operacionais para realizar o deploy em produção do **TEA Guia Inteligente** e manter a infraestrutura saudável.

---

## 1. Configuração e Provisionamento do Firebase

No Console do Firebase:
1. **Projeto**: Crie um novo projeto Firebase (ex.: `tea-guia-prod`).
2. **Authentication**: Habilite o provedor de Email/Senha.
3. **Firestore Database**:
   - Crie a base de dados em modo de produção na região mais próxima dos seus usuários.
   - **Busca Vetorial**: Garanta que o Firestore esteja na versão padrão atualizada que suporta o método de consulta `findNearest` (suporte a vetores nativo no Firestore).
4. **Cloud Storage**:
   - Crie o bucket de armazenamento padrão para anexos e imagens de fichas clínicas.
5. **Políticas de TTL (Time-To-Live)**:
   - Para evitar custos elevados com armazenamento progressivo de cache no Firestore:
     - Vá em **Firestore > Settings > TTL**.
     - Crie uma regra de TTL para a coleção `chatResponseCache` utilizando o atributo `createdAt`.
     - Configure o tempo de expiração dos documentos para **24 horas** (após esse período, o Firestore deletará os caches expirados de forma transparente e sem custo).

---

## 2. Configurações no Painel da Vercel

Crie o projeto no painel da Vercel a partir do repositório conectado. Configure as seguintes **Variáveis de Ambiente** (`Environment Variables`):

| Variável | Descrição | Exemplo |
|---|---|---|
| `GEMINI_API_KEY` | Chave de API de produção do Google AI Studio para IA e Embeddings. | `AIzaSy...` |
| `FIREBASE_PROJECT_ID` | ID do projeto Firebase de produção. | `tea-guia-prod` |
| `FIREBASE_CLIENT_EMAIL` | Email da conta de serviço de produção. | `firebase-adminsdk-...@tea-guia-prod.iam.gserviceaccount.com` |
| `FIREBASE_PRIVATE_KEY` | Chave privada da conta de serviço (com as quebras de linha `\n` preservadas). | `-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqh...` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Chave de API pública do Firebase Client. | `AIzaSy...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Domínio de autenticação do cliente. | `tea-guia-prod.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ID do projeto no cliente. | `tea-guia-prod` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Nome do bucket de Storage. | `tea-guia-prod.appspot.com` |

---

## 3. GitHub Secrets para Integração e Deploy Contínuo (CD)

No repositório do GitHub, navegue em **Settings > Secrets and variables > Actions** e adicione os seguintes segredos para habilitar o deploy automático:

1. **`FIREBASE_TOKEN`**:
   - Obtenha rodando em sua máquina local o comando: `npx firebase login:ci`.
   - Copie o token de autenticação impresso no terminal e salve como secret.
2. **`VERCEL_TOKEN`**:
   - Crie um token de acesso pessoal nas configurações de sua conta Vercel (**Vercel Account > Tokens**).
3. **`VERCEL_ORG_ID`**:
   - ID da sua organização na Vercel (pode ser obtido no arquivo local `.vercel/project.json` após rodar `vercel link`).
4. **`VERCEL_PROJECT_ID`**:
   - ID do projeto na Vercel (pode ser obtido no arquivo local `.vercel/project.json` após rodar `vercel link`).

---

## 4. Manutenção de Rotina

### Conciliação de Embeddings Pendentes
Se por algum motivo de rede ou limite de cota a geração assíncrona do embedding do Gemini falhar durante a publicação, o artigo clínico correspondente ficará marcado com `embeddingVersion: 0` e não aparecerá nas buscas/chat/recomendações.

Para resolver:
1. Acesse o painel administrativo de conteúdos em `/dashboard/admin/conteudos` (autenticado como administrador).
2. Clique no botão **"Sincronizar Embeddings"** no cabeçalho.
3. O sistema varrerá o Firestore localizando itens desatualizados e gerará os vetores em lote de forma transparente.
