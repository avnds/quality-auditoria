-- ============================================================
-- QUALITY AUDITORIA
-- Migration 007 - Respostas e evidências
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- AUDITORIA_RESPOSTAS
-- ============================================================

CREATE TABLE auditoria_respostas (
    id TEXT PRIMARY KEY,
    auditoria_setor_id TEXT NOT NULL,
    checklist_item_id TEXT NOT NULL,
    resultado TEXT NOT NULL,
    observacao TEXT,
    respondido_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auditoria_respostas_setor
        FOREIGN KEY (auditoria_setor_id)
        REFERENCES auditoria_setores(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_auditoria_respostas_item
        FOREIGN KEY (checklist_item_id)
        REFERENCES checklist_itens(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_auditoria_respostas_resultado
        CHECK (
            resultado IN (
                'CONFORME',
                'PARCIALMENTE_CONFORME',
                'NAO_CONFORME',
                'NAO_APLICAVEL'
            )
        ),

    CONSTRAINT uq_auditoria_respostas_item
        UNIQUE (auditoria_setor_id, checklist_item_id)
);

-- ============================================================
-- EVIDENCIAS
-- ============================================================

CREATE TABLE evidencias (
    id TEXT PRIMARY KEY,
    resposta_id TEXT NOT NULL,
    arquivo_uri TEXT NOT NULL,
    ordem INTEGER NOT NULL,
    capturada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    latitude REAL,
    longitude REAL,

    CONSTRAINT fk_evidencias_resposta
        FOREIGN KEY (resposta_id)
        REFERENCES auditoria_respostas(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_evidencias_ordem
        CHECK (ordem > 0),

    CONSTRAINT uq_evidencias_ordem
        UNIQUE (resposta_id, ordem)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_auditoria_respostas_setor
    ON auditoria_respostas(auditoria_setor_id);

CREATE INDEX idx_auditoria_respostas_item
    ON auditoria_respostas(checklist_item_id);

CREATE INDEX idx_auditoria_respostas_resultado
    ON auditoria_respostas(resultado);

CREATE INDEX idx_evidencias_resposta
    ON evidencias(resposta_id);