-- ============================================================
-- QUALITY AUDITORIA
-- Migration 001 - Estrutura inicial
-- Parte 1: Usuarios e permissoes
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- USUARIOS
-- ============================================================

CREATE TABLE usuarios (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    senha_hash TEXT NOT NULL,
    perfil TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_usuarios_perfil
        CHECK (perfil IN ('MASTER', 'SUPERVISORA', 'CONSULTOR')),

    CONSTRAINT ck_usuarios_ativo
        CHECK (ativo IN (0, 1))
);

-- ============================================================
-- PERMISSOES
-- ============================================================

CREATE TABLE permissoes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT
);

-- ============================================================
-- USUARIO_PERMISSAO
-- Relação N:N entre usuários e permissões
-- ============================================================

CREATE TABLE usuario_permissao (
    usuario_id TEXT NOT NULL,
    permissao_id TEXT NOT NULL,

    PRIMARY KEY (usuario_id, permissao_id),

    CONSTRAINT fk_usuario_permissao_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_permissao_permissao
        FOREIGN KEY (permissao_id)
        REFERENCES permissoes(id)
        ON DELETE CASCADE
);

-- ============================================================
-- INDICES
-- ============================================================

CREATE INDEX idx_usuarios_perfil
    ON usuarios(perfil);

CREATE INDEX idx_usuarios_ativo
    ON usuarios(ativo);

CREATE INDEX idx_usuario_permissao_permissao
    ON usuario_permissao(permissao_id);