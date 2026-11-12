/**
 * Proposta de tabela de controle de exportações online.
 * NÃO executa DDL: requer migração revisada e exclusão da tabela
 * dos backups lógicos antes de qualquer ativação em produção.
 *
 * Não armazena cookies, tokens de autenticação ou credenciais Blob/Turso.
 */
export const NOME_TABELA_SESSOES_EXPORTACAO = "desktop_export_sessions" as const;

export const SQL_CRIAR_TABELA_SESSOES_EXPORTACAO = `
CREATE TABLE IF NOT EXISTS desktop_export_sessions (
    sessao_id TEXT PRIMARY KEY NOT NULL,
    usuario_id TEXT NOT NULL,
    perfil_criacao TEXT NOT NULL CHECK (perfil_criacao IN ('MASTER', 'SUPERVISORA')),
    manifesto_sha256 TEXT NOT NULL CHECK (length(manifesto_sha256) = 64),
    criada_em TEXT NOT NULL,
    expira_em TEXT NOT NULL,
    revogada_em TEXT,
    criada_em_unix INTEGER NOT NULL,
    expira_em_unix INTEGER NOT NULL,
    CHECK (expira_em_unix > criada_em_unix)
);
`.trim();

export const SQL_BUSCAR_SESSAO_EXPORTACAO = `
SELECT sessao_id, usuario_id, perfil_criacao, manifesto_sha256,
       criada_em, expira_em, revogada_em
FROM desktop_export_sessions
WHERE sessao_id = ?
  AND usuario_id = ?
  AND revogada_em IS NULL
  AND expira_em_unix > ?
LIMIT 1
`.trim();

export const SQL_REVOGAR_SESSAO_EXPORTACAO = `
UPDATE desktop_export_sessions
SET revogada_em = ?
WHERE sessao_id = ?
  AND usuario_id = ?
  AND revogada_em IS NULL
`.trim();

/**
 * Uma sessão deve ser criada somente após a autorização atual do usuário.
 * O manifesto completo e seus arquivos ainda precisam de armazenamento
 * consistente próprio antes de habilitar a exportação por sessão.
 */
