-- ============================================================
-- QUALITY AUDITORIA
-- Migration 006 - Auditorias e versionamento
-- ============================================================

PRAGMA foreign_keys = ON;




-- ============================================================
-- AUDITORIAS
-- ============================================================

CREATE TABLE auditorias (
    id TEXT PRIMARY KEY,
    loja_id TEXT NOT NULL,
    auditor_id TEXT NOT NULL,
    encarregado_nome TEXT,
    gerente_setor_nome TEXT,
    gerente_loja_nome TEXT,
    criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auditorias_loja
        FOREIGN KEY (loja_id)
        REFERENCES lojas(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_auditorias_auditor
        FOREIGN KEY (auditor_id)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT
);

-- ============================================================
-- AUDITORIA_VERSOES
-- ============================================================

CREATE TABLE auditoria_versoes (
    id TEXT PRIMARY KEY,
    auditoria_id TEXT NOT NULL,
    numero INTEGER NOT NULL,
    status TEXT NOT NULL,
    criada_por TEXT NOT NULL,
    criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enviada_em TEXT,
    finalizada_em TEXT,
    finalizada_por TEXT,
    motivo_devolucao TEXT,

    CONSTRAINT fk_auditoria_versoes_auditoria
        FOREIGN KEY (auditoria_id)
        REFERENCES auditorias(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_auditoria_versoes_criada_por
        FOREIGN KEY (criada_por)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_auditoria_versoes_finalizada_por
        FOREIGN KEY (finalizada_por)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_auditoria_versoes_numero
        CHECK (numero > 0),

    CONSTRAINT ck_auditoria_versoes_status
        CHECK (
            status IN (
                'ABERTA',
                'ENVIADA',
                'EM_CORRECAO',
                'FINALIZADA'
            )
        ),

    CONSTRAINT uq_auditoria_versoes_numero
        UNIQUE (auditoria_id, numero)
);

-- ============================================================
-- AUDITORIA_SETORES
-- Snapshot dos setores e checklists utilizados na auditoria.
-- ============================================================

CREATE TABLE auditoria_setores (
    id TEXT PRIMARY KEY,
    auditoria_versao_id TEXT NOT NULL,
    setor_id TEXT NOT NULL,
    checklist_versao_id TEXT NOT NULL,
    ordem INTEGER NOT NULL,

    CONSTRAINT fk_auditoria_setores_versao
        FOREIGN KEY (auditoria_versao_id)
        REFERENCES auditoria_versoes(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_auditoria_setores_setor
        FOREIGN KEY (setor_id)
        REFERENCES setores(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_auditoria_setores_checklist
        FOREIGN KEY (checklist_versao_id)
        REFERENCES checklist_versoes(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_auditoria_setores_ordem
        CHECK (ordem > 0),

    CONSTRAINT uq_auditoria_setores_setor
        UNIQUE (auditoria_versao_id, setor_id)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_auditorias_loja
    ON auditorias(loja_id);

CREATE INDEX idx_auditorias_auditor
    ON auditorias(auditor_id);

CREATE INDEX idx_auditoria_versoes_auditoria
    ON auditoria_versoes(auditoria_id);

CREATE INDEX idx_auditoria_versoes_status
    ON auditoria_versoes(status);

CREATE INDEX idx_auditoria_versoes_criada_por
    ON auditoria_versoes(criada_por);

CREATE INDEX idx_auditoria_setores_versao
    ON auditoria_setores(auditoria_versao_id);

CREATE INDEX idx_auditoria_setores_setor
    ON auditoria_setores(setor_id);

CREATE INDEX idx_auditoria_setores_checklist
    ON auditoria_setores(checklist_versao_id);