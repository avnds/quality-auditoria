-- ============================================================
-- QUALITY AUDITORIA
-- Migration 009 - Sessoes de autenticacao
-- ============================================================

CREATE TABLE sessoes (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expira_em TEXT NOT NULL,
    encerrada_em TEXT,

    CONSTRAINT fk_sessoes_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE
);

CREATE INDEX idx_sessoes_usuario
    ON sessoes(usuario_id);

CREATE INDEX idx_sessoes_token
    ON sessoes(token_hash);

CREATE INDEX idx_sessoes_expira
    ON sessoes(expira_em);

CREATE UNIQUE INDEX idx_sessoes_usuario_ativa
    ON sessoes(usuario_id)
    WHERE encerrada_em IS NULL;