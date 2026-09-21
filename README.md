# Backlog DEVOPS — deploy no Vercel com Supabase

Sistema de priorização de itens DEVOPS (número do item, PO, nome, urgência, prazo e ordem de execução), **com login para POs e backlogs separados por squad** (SED Pedagógico, SED Escola, SED Matrícula).

O app tem **duas formas de funcionar**:

- **No Vercel (produção)** → login real com banco **Supabase (Postgres)**. Cada PO entra com usuário/senha e acessa o backlog do(s) squad(s) ao qual tem permissão. Tudo fica salvo no banco.
- **Aberto como arquivo local** (sem servidor) → cai no **modo demonstração** (login simulado) e salva no navegador, separado por squad. Dá para ver na barra inferior qual modo está ativo.

---

## Como funciona a arquitetura

```
Navegador (priorizacao-devops.html)
   │  GET  /api/config  → recebe URL + chave anônima do Supabase
   │  POST /api/login   → usuário + senha → devolve token de sessão
   ├─ SELECT/INSERT/... → direto no Supabase (itens e opções do squad)
   └─ (login/usuários continuam via API; os dados do backlog vão direto ao banco)
                              │
              api/config.js · api/login.js · lib/auth.js · lib/db.js
                              │
                       Supabase (Postgres)
              tabela users · tabela items · tabela app_options
```

- **`users`** — usuários (POs), senha e a lista de squads que cada um pode acessar.
- **`items`** e **`app_options`** — guardam uma linha/coluna de `squad`, então cada squad tem seu próprio backlog e suas próprias opções de filtro.

O **backlog** é lido e gravado **direto no Supabase** pelo navegador (com a chave anônima, que é pública e segura para o front-end). O login continua validado pela API; o `schema.sql` precisa ser rodado uma vez no SQL Editor.

> **Segurança:** como o navegador acessa o Supabase direto com a chave anônima, o login **não protege os dados do backlog** — quem tiver a URL + chave anônima (visíveis no código da página) consegue ler/escrever as tabelas `items` e `app_options`. Para um time interno pequeno é aceitável; se precisar de controle por usuário, o próximo passo é habilitar **Row Level Security (RLS)** com policies por squad ou usar o Supabase Auth.

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

### 1. Conectar o banco (Supabase)

1. No **Vercel**, use a **integração oficial com o Supabase** (Add New → Marketplace/Supabase, ou Vercel → Integrations). Vincule o seu projeto `supabase-carmine-helmet`.
2. A integração já injeta no Vercel as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` automaticamente.
3. (Opcional) Se preferir outro Postgres, defina essas mesmas variáveis manualmente em Settings → Environment Variables apontando para ele.

### 2. Criar as tabelas

No **Supabase** → **SQL Editor** → cole o conteúdo do **`schema.sql`** → **Run**. Ele cria três tabelas: `users`, `items` e `app_options`.

> Sem isso a API responde erro 500. É o único passo manual.

### 3. Configurar a variável AUTH_SECRET

Em **Settings → Environment Variables** (Vercel), adicione `AUTH_SECRET` com uma chave aleatória longa (ex.: `openssl rand -hex 32`). Ela assina os tokens de login. Depois de adicionar, faça **Redeploy**.

### 4. Subir o projeto

**Opção A — com Git (recomendado):**
1. Suba os arquivos para um repositório (inclusive `api/`, `lib/`, `vercel.json`, `package.json`).
2. No Vercel → **Add New → Project** → importe o repositório.
3. **Deploy.**

**Opção B — linha de comando:**
```
npm install
npx vercel env pull   # puxa as variáveis do Supabase já configuradas no projeto
npx vercel --prod
```

### 5. Verificar

1. Abra o site publicado — deve aparecer a **tela de login**.
2. Entre com `aline` / `123456`.
3. Quem tem acesso a mais de um squad vê a tela **"Escolha o backlog"** — selecione o squad. (Usuários com um único squad entram direto.)
4. No rodapé deve aparecer **"Conectado ao banco de dados"** (ponto verde).
5. Adicione um item e recarregue — os dados permanecem.

> Se o banco tiver dados de um teste anterior, limpe-os uma vez no SQL Editor: `DELETE FROM items;`

---

## Arquivos deste projeto

| Arquivo | O que faz |
|---|---|
| `priorizacao-devops.html` | O app (front-end). Login, seleção de squad, e leitura/gravação do backlog direto no Supabase. |
| `api/config.js` | Entrega URL + chave anônima do Supabase para o navegador. |
| `api/login.js` | Login (`POST`) e validação de sessão (`GET`). Cria os usuários na primeira vez. |
| `api/state.js` | Caminho antigo (via API) — hoje o app grava direto no Supabase; mantido por compatibilidade. |
| `lib/auth.js` | Assina/verifica tokens (HMAC) e funções compartilhadas. |
| `lib/db.js` | Cliente do Supabase (lê `SUPABASE_URL` + chave de serviço, usado pela API). |
| `package.json` | Dependência `@supabase/supabase-js`. |
| `vercel.json` | Roteia `/` para o app e ativa URLs limpas. |
| `schema.sql` | Cria as tabelas `users`, `items`, `app_options` (rodar 1 vez no SQL Editor). |
| `.env.example` | Modelo das variáveis do Supabase e `AUTH_SECRET`. |

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