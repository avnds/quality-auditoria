-- ============================================================
-- QUALITY AUDITORIA
-- Migration 008 - Histórico e relatórios
-- ============================================================

PRAGMA foreign_keys = ON;

-- ============================================================
-- AUDITORIA_HISTORICO
-- ============================================================

CREATE TABLE auditoria_historico (
    id TEXT PRIMARY KEY,
    auditoria_id TEXT NOT NULL,
    usuario_id TEXT NOT NULL,
    acao TEXT NOT NULL,
    detalhes TEXT,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_auditoria_historico_auditoria
        FOREIGN KEY (auditoria_id)
        REFERENCES auditorias(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_auditoria_historico_usuario
        FOREIGN KEY (usuario_id)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_auditoria_historico_acao
        CHECK (
            acao IN (
                'CRIADA',
                'INICIADA',
                'RESPOSTA_ALTERADA',
                'EVIDENCIA_ADICIONADA',
                'ENVIADA_PARA_VALIDACAO',
                'DEVOLVIDA',
                'CORRIGIDA',
                'REENVIADA',
                'FINALIZADA',
                'NOVA_VERSAO_CRIADA'
            )
        )
);

-- ============================================================
-- RELATORIOS
-- ============================================================

CREATE TABLE relatorios (
    id TEXT PRIMARY KEY,
    auditoria_versao_id TEXT NOT NULL UNIQUE,
    arquivo_uri TEXT,
    gerado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gerado_por TEXT NOT NULL,

    CONSTRAINT fk_relatorios_auditoria_versao
        FOREIGN KEY (auditoria_versao_id)
        REFERENCES auditoria_versoes(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_relatorios_gerado_por
        FOREIGN KEY (gerado_por)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT
);

-- ============================================================
-- ÍNDICES
-- ============================================================

CREATE INDEX idx_auditoria_historico_auditoria
    ON auditoria_historico(auditoria_id);

CREATE INDEX idx_auditoria_historico_usuario
    ON auditoria_historico(usuario_id);

CREATE INDEX idx_auditoria_historico_acao
    ON auditoria_historico(acao);

CREATE INDEX idx_auditoria_historico_criado_em
    ON auditoria_historico(criado_em);

CREATE INDEX idx_relatorios_gerado_por
    ON relatorios(gerado_por);