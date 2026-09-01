-- ============================================================
-- QUALITY AUDITORIA
-- Migration 003 - Vínculos de usuários com clientes e lojas
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- USUARIO_CLIENTES
-- Define quais clientes um usuário pode acessar.
-- ============================================================

CREATE TABLE usuario_clientes (
    usuario_id TEXT NOT NULL,
    cliente_id TEXT NOT NULL,
    vinculado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (usuario_id, cliente_id),

    CONSTRAINT fk_usuario_clientes_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_clientes_cliente
        FOREIGN KEY (cliente_id)
        REFERENCES clientes(id)
        ON DELETE CASCADE
);

-- ============================================================
-- USUARIO_LOJAS
-- Permite restringir o acesso do usuário a lojas específicas.
-- ============================================================

CREATE TABLE usuario_lojas (
    usuario_id TEXT NOT NULL,
    loja_id TEXT NOT NULL,
    vinculado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (usuario_id, loja_id),

    CONSTRAINT fk_usuario_lojas_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_usuario_lojas_loja
        FOREIGN KEY (loja_id)
        REFERENCES lojas(id)
        ON DELETE CASCADE
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_usuario_clientes_cliente
    ON usuario_clientes(cliente_id);

CREATE INDEX idx_usuario_lojas_loja
    ON usuario_lojas(loja_id);