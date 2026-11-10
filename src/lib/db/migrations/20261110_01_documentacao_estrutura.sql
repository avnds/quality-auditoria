-- Quality Documentacao - estrutura inicial (somente esquema, sem dados)
-- Compativel com o executor atual que separa instrucoes por ponto e virgula

CREATE TABLE IF NOT EXISTS documentos_catalogo (
 id TEXT PRIMARY KEY,
 nome TEXT NOT NULL,
 descricao TEXT,
 tipo_controle TEXT NOT NULL CHECK (tipo_controle IN ('VALIDADE','REVISAO')),
 modalidade TEXT NOT NULL DEFAULT 'LOJA' CHECK (modalidade IN ('LOJA','COLABORADOR')),
 periodicidade_meses INTEGER CHECK (periodicidade_meses IS NULL OR periodicidade_meses > 0),
 alerta_dias INTEGER NOT NULL DEFAULT 30 CHECK (alerta_dias >= 0),
 ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
 criado_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_documentos_catalogo_nome ON documentos_catalogo(nome COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS documentos_lojas (
 id TEXT PRIMARY KEY,
 loja_id TEXT NOT NULL REFERENCES lojas(id) ON DELETE RESTRICT,
 documento_id TEXT NOT NULL REFERENCES documentos_catalogo(id) ON DELETE RESTRICT,
 periodicidade_meses INTEGER CHECK (periodicidade_meses IS NULL OR periodicidade_meses > 0),
 alerta_dias INTEGER CHECK (alerta_dias IS NULL OR alerta_dias >= 0),
 ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
 ciclo_atual INTEGER NOT NULL DEFAULT 1 CHECK (ciclo_atual > 0),
 criado_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(loja_id,documento_id)
);

CREATE INDEX IF NOT EXISTS ix_documentos_lojas_loja_ativo ON documentos_lojas(loja_id,ativo);
CREATE INDEX IF NOT EXISTS ix_documentos_lojas_documento ON documentos_lojas(documento_id);

-- Instancias usadas somente para documentos por colaborador, inicialmente ASO
CREATE TABLE IF NOT EXISTS documentos_instancias (
 id TEXT PRIMARY KEY,
 documento_loja_id TEXT NOT NULL REFERENCES documentos_lojas(id) ON DELETE RESTRICT,
 colaborador_id TEXT NOT NULL REFERENCES colaboradores(id) ON DELETE RESTRICT,
 ativo INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0,1)),
 ciclo_atual INTEGER NOT NULL DEFAULT 1 CHECK (ciclo_atual > 0),
 criado_por TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(documento_loja_id,colaborador_id)
);

CREATE INDEX IF NOT EXISTS ix_documentos_instancias_colaborador ON documentos_instancias(colaborador_id,ativo);

-- Uma linha por versao imutavel. A primeira versao tem raiz NULL e versao 1
-- Correcoes referenciam a verificacao original e a versao imediatamente anterior
CREATE TABLE IF NOT EXISTS documentos_verificacoes (
 id TEXT PRIMARY KEY,
 documento_loja_id TEXT NOT NULL REFERENCES documentos_lojas(id) ON DELETE RESTRICT,
 instancia_id TEXT REFERENCES documentos_instancias(id) ON DELETE RESTRICT,
 ciclo_documento INTEGER NOT NULL CHECK (ciclo_documento > 0),
 ciclo_instancia INTEGER CHECK (ciclo_instancia IS NULL OR ciclo_instancia > 0),
 verificacao_raiz_id TEXT REFERENCES documentos_verificacoes(id) ON DELETE RESTRICT,
 versao_anterior_id TEXT REFERENCES documentos_verificacoes(id) ON DELETE RESTRICT,
 versao INTEGER NOT NULL DEFAULT 1 CHECK (versao > 0),
 resultado TEXT NOT NULL CHECK (resultado IN ('APRESENTADO','NAO_APRESENTADO')),
 data_verificacao TEXT NOT NULL,
 data_prazo TEXT,
 observacao TEXT,
 periodicidade_meses_snapshot INTEGER CHECK (periodicidade_meses_snapshot IS NULL OR periodicidade_meses_snapshot > 0),
 alerta_dias_snapshot INTEGER NOT NULL CHECK (alerta_dias_snapshot >= 0),
 tipo_controle_snapshot TEXT NOT NULL CHECK (tipo_controle_snapshot IN ('VALIDADE','REVISAO')),
 prazo_informado_manualmente INTEGER NOT NULL DEFAULT 0 CHECK (prazo_informado_manualmente IN (0,1)),
 motivo_correcao TEXT,
 registrado_por TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 registrado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ((versao = 1 AND verificacao_raiz_id IS NULL AND versao_anterior_id IS NULL AND motivo_correcao IS NULL) OR (versao > 1 AND verificacao_raiz_id IS NOT NULL AND versao_anterior_id IS NOT NULL AND length(trim(coalesce(motivo_correcao,''))) > 0)),
 CHECK (resultado <> 'NAO_APRESENTADO' OR length(trim(coalesce(observacao,''))) > 0),
 CHECK (resultado <> 'APRESENTADO' OR data_prazo IS NOT NULL OR length(trim(coalesce(observacao,''))) > 0),
 CHECK ((instancia_id IS NULL AND ciclo_instancia IS NULL) OR (instancia_id IS NOT NULL AND ciclo_instancia IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_documentos_verificacoes_versao ON documentos_verificacoes(COALESCE(verificacao_raiz_id,id),versao);
CREATE INDEX IF NOT EXISTS ix_documentos_verificacoes_loja_ciclo_data ON documentos_verificacoes(documento_loja_id,ciclo_documento,data_verificacao,registrado_em);
CREATE INDEX IF NOT EXISTS ix_documentos_verificacoes_instancia ON documentos_verificacoes(instancia_id,ciclo_instancia,data_verificacao);
CREATE INDEX IF NOT EXISTS ix_documentos_verificacoes_raiz ON documentos_verificacoes(verificacao_raiz_id);

-- Rascunhos privados, independentes por usuario, alvo e ciclo
CREATE TABLE IF NOT EXISTS documentos_rascunhos (
 id TEXT PRIMARY KEY,
 usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 documento_loja_id TEXT NOT NULL REFERENCES documentos_lojas(id) ON DELETE RESTRICT,
 instancia_id TEXT REFERENCES documentos_instancias(id) ON DELETE RESTRICT,
 ciclo_documento INTEGER NOT NULL CHECK (ciclo_documento > 0),
 ciclo_instancia INTEGER CHECK (ciclo_instancia IS NULL OR ciclo_instancia > 0),
 resultado TEXT CHECK (resultado IN ('APRESENTADO','NAO_APRESENTADO')),
 data_verificacao TEXT,
 data_prazo TEXT,
 observacao TEXT,
 prazo_informado_manualmente INTEGER NOT NULL DEFAULT 0 CHECK (prazo_informado_manualmente IN (0,1)),
 configuracao_revisada_em TEXT,
 ultima_verificacao_vista_id TEXT REFERENCES documentos_verificacoes(id) ON DELETE SET NULL,
 status TEXT NOT NULL DEFAULT 'EM_EDICAO' CHECK (status IN ('EM_EDICAO','BLOQUEADO','CONFIRMADO')),
 motivo_bloqueio TEXT,
 verificacao_confirmada_id TEXT REFERENCES documentos_verificacoes(id) ON DELETE SET NULL,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 atualizado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ((instancia_id IS NULL AND ciclo_instancia IS NULL) OR (instancia_id IS NOT NULL AND ciclo_instancia IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_documentos_rascunhos_loja_usuario_ciclo ON documentos_rascunhos(usuario_id,documento_loja_id,ciclo_documento) WHERE instancia_id IS NULL AND status = 'EM_EDICAO';
CREATE UNIQUE INDEX IF NOT EXISTS ux_documentos_rascunhos_instancia_usuario_ciclo ON documentos_rascunhos(usuario_id,instancia_id,ciclo_documento,ciclo_instancia) WHERE instancia_id IS NOT NULL AND status = 'EM_EDICAO';
CREATE INDEX IF NOT EXISTS ix_documentos_rascunhos_usuario_status ON documentos_rascunhos(usuario_id,status);

CREATE TABLE IF NOT EXISTS documentos_alteracoes (
 id TEXT PRIMARY KEY,
 entidade_tipo TEXT NOT NULL CHECK (entidade_tipo IN ('CATALOGO','DOCUMENTO_LOJA','INSTANCIA','CONFIGURACAO')),
 entidade_id TEXT NOT NULL,
 acao TEXT NOT NULL,
 dados_anteriores TEXT,
 dados_novos TEXT,
 justificativa TEXT,
 usuario_id TEXT NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_documentos_alteracoes_entidade ON documentos_alteracoes(entidade_tipo,entidade_id,criado_em);
CREATE INDEX IF NOT EXISTS ix_documentos_alteracoes_usuario ON documentos_alteracoes(usuario_id,criado_em);
