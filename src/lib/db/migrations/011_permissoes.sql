-- ============================================================
-- QUALITY AUDITORIA
-- Migration 011 - Permissoes do sistema
-- ============================================================

INSERT INTO permissoes (id, nome, descricao) VALUES
('usuarios.visualizar', 'Visualizar usuários', 'Permite visualizar usuários do sistema.'),
('usuarios.consultor.criar', 'Criar consultor', 'Permite cadastrar usuários com perfil CONSULTOR.'),
('usuarios.consultor.editar', 'Editar consultor', 'Permite editar usuários com perfil CONSULTOR.'),
('usuarios.consultor.ativar', 'Ativar ou desativar consultor', 'Permite ativar ou desativar usuários com perfil CONSULTOR.'),
('usuarios.supervisora.criar', 'Criar supervisora', 'Permite cadastrar usuários com perfil SUPERVISORA.'),
('usuarios.supervisora.editar', 'Editar supervisora', 'Permite editar usuários com perfil SUPERVISORA.'),
('usuarios.supervisora.ativar', 'Ativar ou desativar supervisora', 'Permite ativar ou desativar usuários com perfil SUPERVISORA.'),

('clientes.visualizar', 'Visualizar clientes', 'Permite visualizar clientes.'),
('clientes.criar', 'Criar cliente', 'Permite cadastrar clientes.'),
('clientes.editar', 'Editar cliente', 'Permite editar clientes.'),
('clientes.ativar', 'Ativar ou desativar cliente', 'Permite ativar ou desativar clientes.'),

('lojas.visualizar', 'Visualizar lojas', 'Permite visualizar lojas conforme o nível de acesso.'),
('lojas.criar', 'Criar loja', 'Permite cadastrar lojas.'),
('lojas.editar', 'Editar loja', 'Permite editar lojas.'),
('lojas.ativar', 'Ativar ou desativar loja', 'Permite ativar ou desativar lojas.'),
('lojas.autorizar_consultor', 'Autorizar consultor na loja', 'Permite associar consultores às lojas autorizadas.'),

('setores.visualizar', 'Visualizar setores', 'Permite visualizar setores conforme o nível de acesso.'),
('setores.criar', 'Criar setor', 'Permite cadastrar setores.'),
('setores.editar', 'Editar setor', 'Permite editar setores.'),
('setores.ativar', 'Ativar ou desativar setor', 'Permite ativar ou desativar setores.'),
('setores.associar_loja', 'Associar setor à loja', 'Permite associar setores às lojas.'),

('checklists.visualizar', 'Visualizar checklists', 'Permite visualizar checklists.'),
('checklists.criar', 'Criar checklist', 'Permite cadastrar checklists.'),
('checklists.editar', 'Editar checklist', 'Permite editar checklists.'),
('checklists.criar_versao', 'Criar versão de checklist', 'Permite criar novas versões de checklists.'),
('checklists.ativar_versao', 'Ativar versão de checklist', 'Permite ativar uma versão de checklist.'),
('checklists.desativar', 'Desativar checklist', 'Permite desativar checklists.'),

('auditorias.visualizar', 'Visualizar auditorias', 'Permite visualizar auditorias conforme o nível de acesso.'),
('auditorias.iniciar', 'Iniciar auditoria', 'Permite iniciar auditorias autorizadas.'),
('auditorias.executar', 'Executar auditoria', 'Permite executar auditorias.'),
('auditorias.responder', 'Responder itens da auditoria', 'Permite registrar respostas nos itens da auditoria.'),
('auditorias.observar', 'Adicionar observações', 'Permite adicionar observações às respostas da auditoria.'),
('auditorias.adicionar_evidencia', 'Adicionar evidências', 'Permite adicionar evidências às respostas da auditoria.'),
('auditorias.finalizar', 'Finalizar auditoria', 'Permite finalizar auditorias.'),
('auditorias.corrigir', 'Corrigir auditoria', 'Permite criar uma nova versão para correção de uma auditoria.'),
('auditorias.cancelar', 'Cancelar auditoria', 'Permite cancelar auditorias.'),

('relatorios.visualizar', 'Visualizar relatórios', 'Permite visualizar relatórios conforme o nível de acesso.'),
('relatorios.gerar', 'Gerar relatório', 'Permite gerar relatórios de auditorias.'),
('relatorios.baixar', 'Baixar relatório', 'Permite baixar relatórios autorizados.'),

('sistema.configurar', 'Configurar sistema', 'Permite alterar configurações gerais do sistema.'),
('sistema.gerenciar_permissoes', 'Gerenciar permissões', 'Permite administrar as permissões do sistema.'),
('sistema.visualizar_logs', 'Visualizar logs', 'Permite visualizar registros de histórico e logs do sistema.');