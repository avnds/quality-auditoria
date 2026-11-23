-- Permite visualizar, cadastrar e editar colaboradores de lojas autorizadas.
-- O acesso de escrita e limitado nas rotas ao perfil CONSULTOR e a loja vinculada.
-- A permissao colaboradores.gerenciar permanece exclusiva da supervisao.
INSERT OR IGNORE INTO usuario_permissao (usuario_id, permissao_id)
SELECT u.id, p.id
FROM usuarios u
INNER JOIN permissoes p ON p.id = 'colaboradores.visualizar'
WHERE u.perfil = 'CONSULTOR';
