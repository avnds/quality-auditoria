-- ============================================================
-- QUALITY AUDITORIA
-- Migration 004 - Setores e setores por loja
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- SETORES
-- Cadastro geral dos setores disponíveis no sistema.
-- ============================================================

CREATE TABLE setores (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    descricao TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT ck_setores_ativo
        CHECK (ativo IN (0, 1))
);

-- ============================================================
-- LOJA_SETORES
-- Define quais setores estão disponíveis em cada loja.
-- ============================================================

CREATE TABLE loja_setores (
    loja_id TEXT NOT NULL,
    setor_id TEXT NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,
    configurado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (loja_id, setor_id),

    CONSTRAINT fk_loja_setores_loja
        FOREIGN KEY (loja_id)
        REFERENCES lojas(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_loja_setores_setor
        FOREIGN KEY (setor_id)
        REFERENCES setores(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_loja_setores_ativo
        CHECK (ativo IN (0, 1))
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_loja_setores_setor
    ON loja_setores(setor_id);

CREATE INDEX idx_loja_setores_ativo
    ON loja_setores(ativo);

CREATE INDEX idx_setores_ativo
    ON setores(ativo);