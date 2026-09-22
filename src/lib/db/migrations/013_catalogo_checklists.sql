-- QUALITY AUDITORIA
-- Migration 013 - Catálogo reutilizável de seções e itens de checklists

PRAGMA foreign_keys = ON;

-- ============================================================
-- 1. CATÁLOGO DE SEÇÕES
-- ============================================================

CREATE TABLE IF NOT EXISTS catalogo_secoes (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL UNIQUE,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. CATÁLOGO DE ITENS
-- ============================================================

CREATE TABLE IF NOT EXISTS catalogo_itens (
    id TEXT PRIMARY KEY,
    texto TEXT NOT NULL UNIQUE,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. VÍNCULO DAS SEÇÕES COM O CATÁLOGO
-- ============================================================

ALTER TABLE checklist_secoes
ADD COLUMN catalogo_secao_id TEXT;

-- ============================================================
-- 4. VÍNCULO DOS ITENS COM O CATÁLOGO
-- ============================================================

ALTER TABLE checklist_itens
ADD COLUMN catalogo_item_id TEXT;

-- ============================================================
-- 5. POPULAR CATÁLOGO DE SEÇÕES
-- ============================================================

INSERT INTO catalogo_secoes (id, nome)
SELECT
    'cat-sec-' || upper(hex(randomblob(4))),
    origem.nome
FROM (
    SELECT DISTINCT nome
    FROM checklist_secoes
) AS origem
WHERE NOT EXISTS (
    SELECT 1
    FROM catalogo_secoes c
    WHERE c.nome = origem.nome
);

-- ============================================================
-- 6. POPULAR CATÁLOGO DE ITENS
-- ============================================================

INSERT INTO catalogo_itens (id, texto)
SELECT
    'cat-item-' || upper(hex(randomblob(4))),
    origem.texto
FROM (
    SELECT DISTINCT texto
    FROM checklist_itens
) AS origem
WHERE NOT EXISTS (
    SELECT 1
    FROM catalogo_itens c
    WHERE c.texto = origem.texto
);

-- ============================================================
-- 7. VINCULAR SEÇÕES EXISTENTES
-- ============================================================

UPDATE checklist_secoes
SET catalogo_secao_id = (
    SELECT c.id
    FROM catalogo_secoes c
    WHERE c.nome = checklist_secoes.nome
)
WHERE catalogo_secao_id IS NULL;

-- ============================================================
-- 8. VINCULAR ITENS EXISTENTES
-- ============================================================

UPDATE checklist_itens
SET catalogo_item_id = (
    SELECT c.id
    FROM catalogo_itens c
    WHERE c.texto = checklist_itens.texto
)
WHERE catalogo_item_id IS NULL;

-- ============================================================
-- 9. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_checklist_secoes_catalogo
    ON checklist_secoes(catalogo_secao_id);

CREATE INDEX IF NOT EXISTS idx_checklist_itens_catalogo
    ON checklist_itens(catalogo_item_id);