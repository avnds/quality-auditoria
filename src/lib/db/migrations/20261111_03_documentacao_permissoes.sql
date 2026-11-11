-- Permissoes do modulo Documentacao
-- Contas existentes recebem os acessos padrao, sem apagar permissoes personalizadas

INSERT OR IGNORE INTO permissoes (id,nome,descricao) VALUES
('documentos.visualizar','Visualizar documentos','Consultar documentos das lojas autorizadas'),
('documentos.verificar','Verificar documentos','Registrar verificacoes documentais nas lojas autorizadas'),
('documentos.corrigir','Corrigir verificacoes documentais','Corrigir verificacoes com justificativa'),
('documentos.gerenciar_catalogo','Gerenciar catalogo documental','Criar e configurar tipos documentais'),
('documentos.gerenciar_lojas','Gerenciar documentos por loja','Vincular e configurar documentos das lojas'),
('documentos.gerenciar_instancias','Gerenciar documentos por colaborador','Administrar instancias individuais como ASO');

INSERT OR IGNORE INTO usuario_permissao (usuario_id,permissao_id)
SELECT u.id,p.id FROM usuarios u CROSS JOIN permissoes p
WHERE u.perfil='SUPERVISORA'
AND p.id IN ('documentos.visualizar','documentos.verificar','documentos.corrigir','documentos.gerenciar_catalogo','documentos.gerenciar_lojas','documentos.gerenciar_instancias');

INSERT OR IGNORE INTO usuario_permissao (usuario_id,permissao_id)
SELECT u.id,p.id FROM usuarios u CROSS JOIN permissoes p
WHERE u.perfil='CONSULTOR'
AND p.id IN ('documentos.visualizar','documentos.verificar');
