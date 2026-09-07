-- ============================================================
-- QUALITY AUDITORIA
-- Migration 012 - Permissoes padrao por perfil
-- ============================================================

-- ============================================================
-- PERMISSOES DA SUPERVISORA
-- ============================================================

INSERT INTO usuario_permissao (usuario_id, permissao_id)
SELECT u.id, p.id
FROM usuarios u
CROSS JOIN permissoes p
WHERE u.perfil = 'SUPERVISORA'
  AND p.id IN (
    'usuarios.visualizar',
    'usuarios.consultor.criar',
    'usuarios.consultor.editar',
    'usuarios.consultor.ativar',

    'clientes.visualizar',
    'clientes.criar',
    'clientes.editar',
    'clientes.ativar',

    'lojas.visualizar',
    'lojas.criar',
    'lojas.editar',
    'lojas.ativar',
    'lojas.autorizar_consultor',

    'setores.visualizar',
    'setores.criar',
    'setores.editar',
    'setores.ativar',
    'setores.associar_loja',

    'checklists.visualizar',
    'checklists.criar',
    'checklists.editar',
    'checklists.criar_versao',
    'checklists.ativar_versao',
    'checklists.desativar',

    'auditorias.visualizar',
    'auditorias.iniciar',
    'auditorias.executar',
    'auditorias.responder',
    'auditorias.observar',
    'auditorias.adicionar_evidencia',
    'auditorias.finalizar',
    'auditorias.corrigir',
    'auditorias.cancelar',

    'relatorios.visualizar',
    'relatorios.gerar',
    'relatorios.baixar',

    'sistema.visualizar_logs'
  );

-- ============================================================
-- PERMISSOES DO CONSULTOR
-- ============================================================

INSERT INTO usuario_permissao (usuario_id, permissao_id)
SELECT u.id, p.id
FROM usuarios u
CROSS JOIN permissoes p
WHERE u.perfil = 'CONSULTOR'
  AND p.id IN (
    'lojas.visualizar',

    'setores.visualizar',

    'auditorias.visualizar',
    'auditorias.iniciar',
    'auditorias.executar',
    'auditorias.responder',
    'auditorias.observar',
    'auditorias.adicionar_evidencia',
    'auditorias.finalizar',

    'relatorios.visualizar',
    'relatorios.baixar'
  );