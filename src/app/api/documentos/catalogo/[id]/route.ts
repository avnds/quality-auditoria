import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { forbiddenResponse, unauthorizedResponse } from "@/lib/auth/auth-response";

type Contexto = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Contexto) {
    try {
        const acesso = await requirePermission("documentos.gerenciar_catalogo");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO" ? unauthorizedResponse() : forbiddenResponse();
        }
        if (!["MASTER", "SUPERVISORA"].includes(acesso.usuario.perfil)) {
            return forbiddenResponse();
        }

        const { id } = await context.params;
        const anteriorResult = await db.execute({
            sql: `SELECT id, nome, descricao, tipo_controle, modalidade, periodicidade_meses,
                         alerta_dias, ativo FROM documentos_catalogo WHERE id = ? LIMIT 1`,
            args: [id],
        });
        if (!anteriorResult.rows.length) {
            return NextResponse.json({ success: false, message: "Documento não encontrado." }, { status: 404 });
        }
        const anterior = anteriorResult.rows[0];

        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        }
        const dados = body as Record<string, unknown>;
        const permitidos = ["nome", "descricao", "tipo_controle", "modalidade", "periodicidade_meses", "alerta_dias", "ativo"];
        const camposInformados = Object.keys(dados);
        if (!camposInformados.length || camposInformados.some((campo) => !permitidos.includes(campo))) {
            return NextResponse.json({ success: false, message: "Informe campos válidos para edição." }, { status: 400 });
        }

        const novo: Record<string, string | number | null> = {
            nome: String(anterior.nome),
            descricao: anterior.descricao === null ? null : String(anterior.descricao),
            tipo_controle: String(anterior.tipo_controle),
            modalidade: String(anterior.modalidade),
            periodicidade_meses: anterior.periodicidade_meses === null ? null : Number(anterior.periodicidade_meses),
            alerta_dias: Number(anterior.alerta_dias),
            ativo: Number(anterior.ativo),
        };

        for (const campo of camposInformados) {
            const valor = dados[campo];
            if (campo === "nome") {
                if (typeof valor !== "string" || !valor.trim() || valor.trim().length > 200) {
                    return NextResponse.json({ success: false, message: "Nome inválido." }, { status: 400 });
                }
                novo.nome = valor.trim();
            } else if (campo === "descricao") {
                if (valor !== null && (typeof valor !== "string" || valor.trim().length > 2000)) {
                    return NextResponse.json({ success: false, message: "Descrição inválida." }, { status: 400 });
                }
                novo.descricao = typeof valor === "string" ? valor.trim() || null : null;
            } else if (campo === "tipo_controle") {
                if (valor !== "VALIDADE" && valor !== "REVISAO") {
                    return NextResponse.json({ success: false, message: "Tipo de controle inválido." }, { status: 400 });
                }
                novo.tipo_controle = valor;
            } else if (campo === "modalidade") {
                if (valor !== "LOJA" && valor !== "COLABORADOR") {
                    return NextResponse.json({ success: false, message: "Modalidade inválida." }, { status: 400 });
                }
                novo.modalidade = valor;
            } else if (campo === "periodicidade_meses") {
                if (valor !== null && (typeof valor !== "number" || !Number.isInteger(valor) || valor < 1 || valor > 1200)) {
                    return NextResponse.json({ success: false, message: "Periodicidade inválida." }, { status: 400 });
                }
                novo.periodicidade_meses = valor as number | null;
            } else if (campo === "alerta_dias") {
                if (typeof valor !== "number" || !Number.isInteger(valor) || valor < 0 || valor > 3650) {
                    return NextResponse.json({ success: false, message: "Prazo de alerta inválido." }, { status: 400 });
                }
                novo.alerta_dias = valor;
            } else if (campo === "ativo") {
                if (valor !== 0 && valor !== 1) {
                    return NextResponse.json({ success: false, message: "Situação inválida." }, { status: 400 });
                }
                novo.ativo = valor;
            }
        }

        if (novo.modalidade !== String(anterior.modalidade)) {
            const vinculos = await db.execute({
                sql: "SELECT id FROM documentos_lojas WHERE documento_id = ? LIMIT 1",
                args: [id],
            });
            if (vinculos.rows.length) {
                return NextResponse.json({
                    success: false,
                    message: "A modalidade não pode ser alterada após vincular o documento a uma loja.",
                }, { status: 409 });
            }
        }

        if (novo.nome !== String(anterior.nome)) {
            const duplicado = await db.execute({
                sql: "SELECT id FROM documentos_catalogo WHERE nome = ? COLLATE NOCASE AND id <> ? LIMIT 1",
                args: [novo.nome, id],
            });
            if (duplicado.rows.length) {
                return NextResponse.json({ success: false, message: "Já existe um documento com esse nome." }, { status: 409 });
            }
        }

        const mudou = Object.keys(novo).some((campo) => novo[campo] !== anterior[campo]);
        if (!mudou) {
            return NextResponse.json({ success: true, message: "Nenhuma alteração necessária.", documento: { id, ...novo } });
        }

        const acao = novo.ativo !== Number(anterior.ativo)
            ? (novo.ativo === 1 ? "ATIVAR" : "DESATIVAR") : "EDITAR";
        const alteracaoId = crypto.randomUUID();

        await db.batch([
            {
                sql: `UPDATE documentos_catalogo SET nome = ?, descricao = ?, tipo_controle = ?,
                    modalidade = ?, periodicidade_meses = ?, alerta_dias = ?, ativo = ?,
                    atualizado_em = CURRENT_TIMESTAMP WHERE id = ?`,
                args: [novo.nome, novo.descricao, novo.tipo_controle, novo.modalidade,
                    novo.periodicidade_meses, novo.alerta_dias, novo.ativo, id],
            },
            {
                sql: `INSERT INTO documentos_alteracoes
                    (id, entidade_tipo, entidade_id, acao, dados_anteriores, dados_novos, usuario_id)
                    VALUES (?, 'CATALOGO', ?, ?, ?, ?, ?)`,
                args: [alteracaoId, id, acao, JSON.stringify(anterior), JSON.stringify(novo), acesso.usuario.id],
            },
        ], "write");

        return NextResponse.json({ success: true, message: "Documento atualizado com sucesso.", documento: { id, ...novo } });
    } catch (error) {
        console.error("Erro ao editar catalogo documental:", error);
        return NextResponse.json({ success: false, message: "Não foi possível atualizar o documento." }, { status: 500 });
    }
}
