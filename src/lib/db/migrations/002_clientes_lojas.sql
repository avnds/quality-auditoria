-- ============================================================
-- QUALITY AUDITORIA
-- Migration 002 - Clientes, lojas e telefones
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- CLIENTES
-- ============================================================

CREATE TABLE clientes (
    id TEXT PRIMARY KEY,
    razao_social TEXT NOT NULL,
    nome_fantasia TEXT NOT NULL,
    cnpj TEXT NOT NULL UNIQUE,
    email TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_clientes_ativo
        CHECK (ativo IN (0, 1))
);

-- ============================================================
-- LOJAS
-- ============================================================

CREATE TABLE lojas (
    id TEXT PRIMARY KEY,
    cliente_id TEXT NOT NULL,

    nome TEXT NOT NULL,
    cnpj TEXT,

    endereco TEXT NOT NULL,
    numero TEXT,
    complemento TEXT,
    bairro TEXT,
    cidade TEXT NOT NULL,
    estado TEXT NOT NULL,
    cep TEXT,

    ativo INTEGER NOT NULL DEFAULT 1,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_lojas_cliente
        FOREIGN KEY (cliente_id)
        REFERENCES clientes(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_lojas_ativo
        CHECK (ativo IN (0, 1))
);

-- ============================================================
-- TELEFONES
-- Um telefone pertence a um cliente OU a uma loja.
-- ============================================================

CREATE TABLE telefones (
    id TEXT PRIMARY KEY,

    cliente_id TEXT,
    loja_id TEXT,

    numero TEXT NOT NULL,
    tipo TEXT,
    principal INTEGER NOT NULL DEFAULT 0,

    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_telefones_cliente
        FOREIGN KEY (cliente_id)
        REFERENCES clientes(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_telefones_loja
        FOREIGN KEY (loja_id)
        REFERENCES lojas(id)
        ON DELETE CASCADE,

    CONSTRAINT ck_telefones_proprietario
        CHECK (
            (cliente_id IS NOT NULL AND loja_id IS NULL)
            OR
            (cliente_id IS NULL AND loja_id IS NOT NULL)
        ),

    CONSTRAINT ck_telefones_principal
        CHECK (principal IN (0, 1))
);

-- ============================================================
-- INDICES
-- ============================================================

CREATE INDEX idx_lojas_cliente
    ON lojas(cliente_id);

CREATE INDEX idx_lojas_ativo
    ON lojas(ativo);

CREATE INDEX idx_telefones_cliente
    ON telefones(cliente_id);

CREATE INDEX idx_telefones_loja
    ON telefones(loja_id);

CREATE INDEX idx_telefones_principal
    ON telefones(principal);