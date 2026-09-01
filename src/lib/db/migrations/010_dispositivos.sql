-- ============================================================
-- QUALITY AUDITORIA
-- Migration 010 - Dispositivos de acesso
-- ============================================================

CREATE TABLE dispositivos (
    id TEXT PRIMARY KEY,
    usuario_id TEXT NOT NULL,
    identificador TEXT NOT NULL,
    nome TEXT,
    tipo TEXT NOT NULL,
    ultimo_acesso_em TEXT,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ativo INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_dispositivos_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_dispositivos_tipo
        CHECK (tipo IN ('WEB', 'ANDROID')),

    CONSTRAINT ck_dispositivos_ativo
        CHECK (ativo IN (0, 1)),

    CONSTRAINT uq_dispositivo_usuario
        UNIQUE (usuario_id, identificador)
);

CREATE INDEX idx_dispositivos_usuario
    ON dispositivos(usuario_id);

CREATE INDEX idx_dispositivos_ativo
    ON dispositivos(ativo);