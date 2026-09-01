-- ============================================================
-- QUALITY AUDITORIA
-- Migration 005 - Checklists e versionamento
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- CHECKLISTS
-- Checklist lógico associado a um setor.
-- ============================================================

CREATE TABLE checklists (
    id TEXT PRIMARY KEY,
    setor_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_checklists_setor
        FOREIGN KEY (setor_id)
        REFERENCES setores(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_checklists_ativo
        CHECK (ativo IN (0, 1))
);

-- ============================================================
-- CHECKLIST_VERSOES
-- Cada alteração estrutural gera uma nova versão.
-- ============================================================

CREATE TABLE checklist_versoes (
    id TEXT PRIMARY KEY,
    checklist_id TEXT NOT NULL,
    numero INTEGER NOT NULL,
    descricao TEXT,
    publicada INTEGER NOT NULL DEFAULT 0,
    criada_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_checklist_versoes_checklist
        FOREIGN KEY (checklist_id)
        REFERENCES checklists(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_checklist_versoes_numero
        CHECK (numero > 0),

    CONSTRAINT ck_checklist_versoes_publicada
        CHECK (publicada IN (0, 1)),

    CONSTRAINT uq_checklist_versoes_numero
        UNIQUE (checklist_id, numero)
);

-- ============================================================
-- CHECKLIST_SECOES
-- Organiza os itens dentro de uma versão do checklist.
-- ============================================================

CREATE TABLE checklist_secoes (
    id TEXT PRIMARY KEY,
    checklist_versao_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    descricao TEXT,
    ordem INTEGER NOT NULL,

    CONSTRAINT fk_checklist_secoes_versao
        FOREIGN KEY (checklist_versao_id)
        REFERENCES checklist_versoes(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_checklist_secoes_ordem
        CHECK (ordem > 0),

    CONSTRAINT uq_checklist_secoes_ordem
        UNIQUE (checklist_versao_id, ordem)
);

-- ============================================================
-- CHECKLIST_ITENS
-- Itens efetivamente avaliados durante a auditoria.
-- ============================================================

CREATE TABLE checklist_itens (
    id TEXT PRIMARY KEY,
    checklist_secao_id TEXT NOT NULL,
    texto TEXT NOT NULL,
    orientacao TEXT,
    ordem INTEGER NOT NULL,
    ativo INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT fk_checklist_itens_secao
        FOREIGN KEY (checklist_secao_id)
        REFERENCES checklist_secoes(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_checklist_itens_ordem
        CHECK (ordem > 0),

    CONSTRAINT ck_checklist_itens_ativo
        CHECK (ativo IN (0, 1)),

    CONSTRAINT uq_checklist_itens_ordem
        UNIQUE (checklist_secao_id, ordem)
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_checklists_setor
    ON checklists(setor_id);

CREATE INDEX idx_checklists_ativo
    ON checklists(ativo);

CREATE INDEX idx_checklist_versoes_checklist
    ON checklist_versoes(checklist_id);

CREATE INDEX idx_checklist_versoes_publicada
    ON checklist_versoes(publicada);

CREATE INDEX idx_checklist_secoes_versao
    ON checklist_secoes(checklist_versao_id);

CREATE INDEX idx_checklist_itens_secao
    ON checklist_itens(checklist_secao_id);

CREATE INDEX idx_checklist_itens_ativo
    ON checklist_itens(ativo);