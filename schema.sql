-- Usuários (POs) e os squads que podem acessar
-- senha: SHA-256 em hex. Em produção, use bcrypt/argon2.
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  squads JSONB NOT NULL,
  can_edit BOOLEAN NOT NULL DEFAULT true
);

-- Para bancos já criados antes desta coluna existir:
ALTER TABLE users ADD COLUMN IF NOT EXISTS can_edit BOOLEAN NOT NULL DEFAULT true;

-- Itens do backlog, separados por squad
CREATE TABLE IF NOT EXISTS items (
  squad TEXT NOT NULL,
  numero TEXT NOT NULL,
  nome TEXT NOT NULL,
  po TEXT NOT NULL,
  pri TEXT NOT NULL,
  status TEXT NOT NULL,
  area TEXT NOT NULL,
  prazo TEXT NOT NULL,
  ordem INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo TEXT NOT NULL DEFAULT 'User Story',
  PRIMARY KEY (squad, numero)
);

-- Opções dos filtros, por squad (uma linha por squad com os 4 grupos em JSON)
CREATE TABLE IF NOT EXISTS app_options (
  squad TEXT PRIMARY KEY,
  data JSONB NOT NULL
);

-- O navegador acessa o Supabase direto com a chave ANÔNIMA (pública). Sem estas
-- policies, a RLS bloqueia leitura/escrita de itens e opções. A tabela "users"
-- fica protegida (sem policy) — só o servidor a acessa via chave de serviço.
-- (DROP IF EXISTS torna o script re-executável sem erro.)
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS items_anon_all ON items;
CREATE POLICY items_anon_all ON items FOR ALL TO anon USING (true) WITH CHECK (true);

ALTER TABLE app_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS app_options_anon_all ON app_options;
CREATE POLICY app_options_anon_all ON app_options FOR ALL TO anon USING (true) WITH CHECK (true);