-- ============================================================
-- QUALITY AUDITORIA
-- Migration 014 - Colaboradores, treinamentos e certificados
-- Certificados de Boas Praticas: fluxo independente das auditorias.
-- ============================================================

PRAGMA foreign_keys = ON;

CREATE TABLE colaboradores (
    id TEXT PRIMARY KEY,
    loja_id TEXT NOT NULL,
    nome TEXT NOT NULL,
    cargo TEXT,
    email TEXT,
    telefone TEXT,
    ativo INTEGER NOT NULL DEFAULT 1,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_colaboradores_loja
        FOREIGN KEY (loja_id)
        REFERENCES lojas(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_colaboradores_ativo
        CHECK (ativo IN (0, 1))
);

CREATE INDEX idx_colaboradores_loja
    ON colaboradores(loja_id);

CREATE INDEX idx_colaboradores_loja_ativo
    ON colaboradores(loja_id, ativo);

CREATE TABLE treinamentos (
    id TEXT PRIMARY KEY,
    loja_id TEXT NOT NULL,
    titulo TEXT NOT NULL,
    data_realizacao TEXT NOT NULL,
    carga_horaria_minutos INTEGER NOT NULL,
    conteudo_programatico TEXT,
    ministrante TEXT NOT NULL,
    criado_por TEXT NOT NULL,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_treinamentos_loja
        FOREIGN KEY (loja_id)
        REFERENCES lojas(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_treinamentos_criado_por
        FOREIGN KEY (criado_por)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_treinamentos_carga_horaria
        CHECK (carga_horaria_minutos > 0)
);

CREATE INDEX idx_treinamentos_loja
    ON treinamentos(loja_id);

CREATE INDEX idx_treinamentos_data
    ON treinamentos(data_realizacao);

CREATE TABLE treinamento_colaboradores (
    id TEXT PRIMARY KEY,
    treinamento_id TEXT NOT NULL,
    colaborador_id TEXT NOT NULL,
    nome_colaborador_snapshot TEXT NOT NULL,
    cargo_snapshot TEXT,
    criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_treinamento_colaboradores_treinamento
        FOREIGN KEY (treinamento_id)
        REFERENCES treinamentos(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_treinamento_colaboradores_colaborador
        FOREIGN KEY (colaborador_id)
        REFERENCES colaboradores(id)
        ON DELETE RESTRICT,

    CONSTRAINT uq_treinamento_colaborador
        UNIQUE (treinamento_id, colaborador_id)
);

CREATE INDEX idx_treinamento_colaboradores_treinamento
    ON treinamento_colaboradores(treinamento_id);

CREATE INDEX idx_treinamento_colaboradores_colaborador
    ON treinamento_colaboradores(colaborador_id);

CREATE TABLE certificados (
    id TEXT PRIMARY KEY,
    treinamento_colaborador_id TEXT NOT NULL UNIQUE,
    numero TEXT NOT NULL UNIQUE,
    nome_colaborador TEXT NOT NULL,
    cargo_colaborador TEXT,
    nome_loja TEXT NOT NULL,
    nome_cliente TEXT NOT NULL,
    titulo_treinamento TEXT NOT NULL,
    data_realizacao TEXT NOT NULL,
    carga_horaria_minutos INTEGER NOT NULL,
    conteudo_programatico TEXT,
    ministrante TEXT NOT NULL,
    emitido_por TEXT NOT NULL,
    emitido_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    arquivo_uri TEXT,

    CONSTRAINT fk_certificados_participante
        FOREIGN KEY (treinamento_colaborador_id)
        REFERENCES treinamento_colaboradores(id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_certificados_emitido_por
        FOREIGN KEY (emitido_por)
        REFERENCES usuarios(id)
        ON DELETE RESTRICT,

    CONSTRAINT ck_certificados_carga_horaria
        CHECK (carga_horaria_minutos > 0)
);

CREATE INDEX idx_certificados_emitido_em
    ON certificados(emitido_em);

-- Permissoes do modulo.
INSERT INTO permissoes (id, nome, descricao) VALUES
('colaboradores.visualizar', 'Visualizar colaboradores', 'Permite visualizar colaboradores das lojas autorizadas.'),
('colaboradores.gerenciar', 'Gerenciar colaboradores', 'Permite cadastrar, editar e inativar colaboradores.'),
('treinamentos.visualizar', 'Visualizar treinamentos', 'Permite visualizar treinamentos de Boas Praticas.'),
('treinamentos.gerenciar', 'Gerenciar treinamentos', 'Permite registrar treinamentos e seus participantes.'),
('certificados.visualizar', 'Visualizar certificados', 'Permite visualizar certificados emitidos.'),
('certificados.gerar', 'Gerar certificados', 'Permite emitir certificados de treinamentos.'),
('certificados.baixar', 'Baixar certificados', 'Permite baixar certificados emitidos.');

-- MASTER ja possui todas as permissoes automaticamente.
-- SUPERVISORA recebe as permissoes operacionais do modulo.
INSERT INTO usuario_permissao (usuario_id, permissao_id)
SELECT u.id, p.id
FROM usuarios u
CROSS JOIN permissoes p
WHERE u.perfil = 'SUPERVISORA'
  AND p.id IN (
    'colaboradores.visualizar',
    'colaboradores.gerenciar',
    'treinamentos.visualizar',
    'treinamentos.gerenciar',
    'certificados.visualizar',
    'certificados.gerar',
    'certificados.baixar'
  );
