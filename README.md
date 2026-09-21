, # Backlog DEVOPS — deploy no Vercel com banco de dados

Sistema de priorização de itens DEVOPS (número do item, PO, nome, urgência, prazo e ordem de execução), **com login para POs e backlogs separados por squad** (SED Pedagógico, SED Escola, SED Matrícula).

O app tem **duas formas de funcionar**:

- **No Vercel (produção)** → login real com banco **Postgres**. Cada PO entra com usuário/senha e acessa o backlog do(s) squad(s) ao qual tem permissão. Tudo fica salvo no banco.
- **Aberto como arquivo local** (sem servidor) → cai no **modo demonstração** (login simulado) e salva no navegador, separado por squad. Dá para ver na barra inferior qual modo está ativo.

---

## Como funciona a arquitetura

```
Navegador (priorizacao-devops.html)
   │  POST /api/login        → usuário + senha → devolve token de sessão
   │  GET  /api/state?squad= → carrega itens + opções do squad (com token)
   └─ PUT  /api/state        → salva itens + opções do squad (a cada mudança)
                              │
              api/login.js · api/state.js · lib/auth.js (serverless Vercel)
                              │
                          Banco Postgres
              tabela users · tabela items · tabela app_options
```

- **`users`** — usuários (POs), senha e a lista de squads que cada um pode acessar.
- **`items`** e **`app_options`** — guardam uma linha/coluna de `squad`, então cada squad tem seu próprio backlog e suas próprias opções de filtro.

A página sempre tenta falar com a API. Se não conseguir (arquivo aberto direto, etc.), ela avisa **"Modo local (navegador)"** no rodapé e segue funcionando em modo demonstração.

---

## Usuários e squads

Os usuários são criados automaticamente a cada deploy (o seed é idempotente — não sobrescreve senhas já alteradas) e **as contas de demonstração são removidas automaticamente** (pedagogico, escola, matricula, admin). Contas atuais:

| Usuário | Senha | Acesso |
|---|---|---|
| `aline` | `123456` | Todos os squads |
| `nairlla` | `123456` | Todos os squads |
| `louise` | `123456` | Todos os squads |
| `juliana` | `123456` | Todos os squads |
| `kathiane` | `123456` | Todos os squads |

> **Por que não um botão de "cadastrar"?** Como o grupo de POs é uma lista fechada e conhecida, criar as contas direto no banco (seed) é mais seguro — um cadastro aberto permitiria *qualquer* pessoa criar conta no sistema em produção. Para adicionar um usuário novo no futuro, basta acrescentar uma linha em `lib/auth.js` (array `USERS`) e fazer deploy, ou inserir direto no banco:
> ```sql
> INSERT INTO users (username, name, password, squads)
> VALUES ('usuario', 'Nome Completo', '<sha256 da senha>', '["SED Escola"]'::jsonb);
> ```
>
> **Em produção, troque essas senhas.** A senha é guardada como SHA-256 (hex) — o ideal em produção é bcrypt/argon2 (veja Limitações). Para trocar a senha de um usuário:
> ```sql
> UPDATE users SET password = '<sha256 da nova senha>' WHERE username = 'aline';
> ```

---

## Passo a passo para colocar em produção

### 1. Criar o banco de dados (Vercel Storage)

1. Entre no **Vercel** → **Storage** → **Create Database** → escolha **Postgres**.
2. Vincule o banco ao seu projeto.
3. O Vercel já injeta a variável `POSTGRES_URL` automaticamente. (Funciona com qualquer Postgres — Neon, Supabase, Render — basta adicionar `POSTGRES_URL` em Settings → Environment Variables.)

### 2. Criar as tabelas

Abra o banco (**Storage → seu banco → Query**) e rode o conteúdo do **`schema.sql`**. Ele cria três tabelas: `users`, `items` e `app_options`.

> Sem isso a API responde erro 500. É o único passo manual.

### 3. Configurar a variável AUTH_SECRET

Em **Settings → Environment Variables**, adicione `AUTH_SECRET` com uma chave aleatória longa (ex.: gere em https://cryptotools.net/random ou `openssl rand -hex 32`). Ela assina os tokens de login. Depois de adicionar, faça **Redeploy**.

### 4. Subir o projeto

**Opção A — com Git (recomendado):**
1. Suba os arquivos para um repositório (inclusive `api/`, `lib/`, `vercel.json`, `package.json`).
2. No Vercel → **Add New → Project** → importe o repositório.
3. **Deploy.**

**Opção B — linha de comando:**
```
npm install
npx vercel env add POSTGRES_URL
npx vercel env add AUTH_SECRET
npx vercel --prod
```

### 5. Verificar

1. Abra o site publicado — deve aparecer a **tela de login**.
2. Entre com `aline` / `123456`.
3. Quem tem acesso a mais de um squad vê a tela **"Escolha o backlog"** — selecione o squad. (Usuários com um único squad entram direto.)
4. No rodapé deve aparecer **"Conectado ao banco de dados"** (ponto verde).
5. Adicione um item e recarregue — os dados permanecem.

> Se o banco tiver dados de um teste anterior, limpe-os uma vez na aba Query: `DELETE FROM items;`

---

## Arquivos deste projeto

| Arquivo | O que faz |
|---|---|
| `priorizacao-devops.html` | O app (front-end). Login, seleção de squad, chamadas à API com fallback para modo local. |
| `api/login.js` | Login (`POST`) e validação de sessão (`GET`). Cria os usuários de demonstração na primeira vez. |
| `api/state.js` | Lê/grava itens e opções **do squad** da sessão, com controle de acesso. |
| `lib/auth.js` | Assina/verifica tokens (HMAC) e funções compartilhadas. |
| `package.json` | Dependência `@vercel/postgres`. |
| `vercel.json` | Roteia `/` para o app e ativa URLs limpas. |
| `schema.sql` | Cria as tabelas `users`, `items`, `app_options` (rodar 1 vez). |
| `.env.example` | Modelo das variáveis `POSTGRES_URL` e `AUTH_SECRET`. |

---

## Limitações conhecidas

- **Senhas com SHA-256:** suficiente para um sistema interno em início de uso, mas o ideal é bcrypt/argon2 (time de dev pode trocar).
- **Edição simultânea:** o `PUT` salva o estado inteiro do squad (estratégia "substitui tudo"). Duas pessoas editando o mesmo squad ao mesmo tempo podem sobrescrever uma à outra. Para um time pequeno é aceitável; o próximo passo é escrita item-a-item com versões.
- **Tokens sem expiração por renovação:** a sessão dura 7 dias; depois, é preciso entrar de novo.

## Rodar localmente (teste com banco)

```
npm install
npx vercel env pull   # puxa as variáveis de ambiente do projeto
npx vercel dev        # sobe em http://localhost:3000
```