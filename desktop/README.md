# Quality Desktop — empacotamento Windows

Este diretório contém a base do aplicativo Electron para executar o servidor Next.js
localmente, sem depender de Node.js instalado no computador do usuário.

O instalador NSIS é gerado por `npm run desktop:dist` em um ambiente Windows.
O artefato ainda **não deve ser distribuído**: falta integrar o fluxo de
autenticação/importação dentro da interface instalada, impedir o uso antes da
primeira instalação e validar a execução empacotada. A geração de um EXE
não significa que a instalação offline esteja concluída.

Nunca copie .env.local ou credenciais de produção para o pacote.
O servidor local usa QUALITY_RUNTIME=desktop.
