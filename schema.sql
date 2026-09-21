-- Usuários (POs) e os squads que podem acessar
-- senha: SHA-256 em hex. Em produção, use bcrypt/argon2.
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  squads JSONB NOT NULL
);

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
  PRIMARY KEY (squad, numero)
);

-- Opções dos filtros, por squad (uma linha por squad com os 4 grupos em JSON)
CREATE TABLE IF NOT EXISTS app_options (
  squad TEXT PRIMARY KEY,
  data JSONB NOT NULL
);