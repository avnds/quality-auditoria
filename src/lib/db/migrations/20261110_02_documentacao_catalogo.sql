-- Catalogo inicial aprovado, sem vinculacao automatica a lojas.
-- Periodicidades sao sugestoes operacionais configuraveis, nao prazos legais.
-- NULL indica prazo a informar conforme documento ou configuracao da loja.
INSERT OR IGNORE INTO documentos_catalogo (id,nome,tipo_controle,modalidade,periodicidade_meses,alerta_dias,ativo)
VALUES
 ('doc_controle_pragas','Certificados de Controle de Pragas','VALIDADE','LOJA',3,30,1),
 ('doc_lavagem_caixa_agua','Certificado de Lavagem da Caixa d''Água','VALIDADE','LOJA',6,30,1),
 ('doc_lavagem_bebedouros','Certificado de Lavagem dos Bebedouros','VALIDADE','LOJA',3,30,1),
 ('doc_alvara_funcionamento','Alvará de Funcionamento','VALIDADE','LOJA',NULL,30,1),
 ('doc_licenca_sanitaria','Licença Sanitária','VALIDADE','LOJA',12,30,1),
 ('doc_controle_temperatura','Controle de Temperatura','REVISAO','LOJA',NULL,30,1),
 ('doc_cronograma_limpeza','Cronograma de Limpeza','REVISAO','LOJA',NULL,30,1),
 ('doc_ordem_servico_terceirizadas','O.S. de Serviços de Empresas Terceirizadas','REVISAO','LOJA',1,30,1),
 ('doc_documentacao_sim_sie_sif','Documentação SIM/SIE/SIF dos Produtos','VALIDADE','LOJA',12,30,1),
 ('doc_ficha_tecnica_limpeza','Ficha Técnica dos Produtos de Limpeza','REVISAO','LOJA',NULL,30,1),
 ('doc_manual_boas_praticas','Manual de Boas Práticas','REVISAO','LOJA',NULL,30,1),
 ('doc_pop','POP','REVISAO','LOJA',12,30,1),
 ('doc_lista_presenca_bpf','Lista de Presença do Treinamento de BPF','REVISAO','LOJA',6,30,1),
 ('doc_certificados_treinamentos','Certificados dos Treinamentos','REVISAO','LOJA',6,30,1),
 ('doc_certificado_bombeiros','Certificado do Corpo de Bombeiros','VALIDADE','LOJA',NULL,30,1),
 ('doc_pgrs','PGRS','REVISAO','LOJA',NULL,30,1),
 ('doc_aso','ASOs','VALIDADE','COLABORADOR',NULL,30,1);
