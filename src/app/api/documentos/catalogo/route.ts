import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

export async function GET() {
    try {
        const acesso = await requirePermission("documentos.visualizar");

        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const resultado = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    descricao,
                    tipo_controle,
                    modalidade,
                    periodicidade_meses,
                    alerta_dias,
                    ativo,
                    criado_em,
                    atualizado_em
                FROM documentos_catalogo
                ORDER BY nome COLLATE NOCASE, id
            `,
            args: [],
        });

        return NextResponse.json({
            success: true,
            documentos: resultado.rows,
        });
    } catch (error) {
        console.error("Erro ao consultar catalogo documental:", error);
        return NextResponse.json(
            {
                success: false,
                message: "Não foi possível consultar o catálogo documental.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const acesso = await requirePermission("documentos.gerenciar_catalogo");
        if (!acesso.autorizado) {
            return acesso.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }
        if (!["MASTER", "SUPERVISORA"].includes(acesso.usuario.perfil)) {
            return forbiddenResponse();
        }

        const body: unknown = await request.json();
        if (!body || typeof body !== "object" || Array.isArray(body)) {
            return NextResponse.json({ success: false, message: "Dados inválidos." }, { status: 400 });
        }
        const dados = body as Record<string, unknown>;
        const nome = typeof dados.nome === "string" ? dados.nome.trim() : "";
        const descricao = dados.descricao === null || dados.descricao === undefined
            ? null : typeof dados.descricao === "string" ? dados.descricao.trim() || null : undefined;
        const tipo = dados.tipo_controle;
        const modalidade = dados.modalidade;
        const periodicidade = dados.periodicidade_meses;
        const alerta = dados.alerta_dias;
        if (
            !nome || nome.length > 200 || descricao === undefined ||
            (descricao !== null && descricao.length > 2000) ||
            !["VALIDADE", "REVISAO"].includes(String(tipo)) ||
            !["LOJA", "COLABORADOR"].includes(String(modalidade)) ||
            !(periodicidade === null || (typeof periodicidade === "number" && Number.isInteger(periodicidade) && periodicidade > 0 && periodicidade <= 1200)) ||
            typeof alerta !== "number" || !Number.isInteger(alerta) || alerta < 0 || alerta > 3650
        ) {
            return NextResponse.json({ success: false, message: "Confira nome, descrição, tipo, modalidade, periodicidade e alerta." }, { status: 400 });
        }

        const existente = await db.execute({
            sql: "SELECT id FROM documentos_catalogo WHERE nome = ? COLLATE NOCASE LIMIT 1",
            args: [nome],
        });
        if (existente.rows.length) {
            return NextResponse.json({ success: false, message: "Já existe um documento com esse nome." }, { status: 409 });
        }

        const id = crypto.randomUUID();
        const alteracaoId = crypto.randomUUID();
        const novo = { id, nome, descricao, tipo_controle: tipo, modalidade, periodicidade_meses: periodicidade, alerta_dias: alerta, ativo: 1 };
        await db.batch([
            {
                sql: `INSERT INTO documentos_catalogo
                    (id, nome, descricao, tipo_controle, modalidade, periodicidade_meses, alerta_dias, ativo, criado_por)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
                args: [id, nome, descricao, String(tipo), String(modalidade), periodicidade as number | null, alerta as number, acesso.usuario.id],
            },
            {
                sql: `INSERT INTO documentos_alteracoes
                    (id, entidade_tipo, entidade_id, acao, dados_novos, usuario_id)
                    VALUES (?, 'CATALOGO', ?, 'CRIAR', ?, ?)`,
                args: [alteracaoId, id, JSON.stringify(novo), acesso.usuario.id],
            },
        ], "write");
        return NextResponse.json({ success: true, documento: novo }, { status: 201 });
    } catch (error) {
        console.error("Erro ao cadastrar documento:", error);
        return NextResponse.json({ success: false, message: "Não foi possível cadastrar o documento." }, { status: 500 });
    }
}
