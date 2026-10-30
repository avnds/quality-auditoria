import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type RouteContext = { params: Promise<{ id: string }> };

async function podeAcessarLoja(
    lojaId: string,
    usuario: { id: string; perfil: string }
) {
    if (usuario.perfil === "MASTER" || usuario.perfil === "SUPERVISORA") {
        const result = await db.execute({
            sql: "SELECT id FROM lojas WHERE id = ? LIMIT 1",
            args: [lojaId],
        });
        return result.rows.length > 0;
    }

    const result = await db.execute({
        sql: `
            SELECT 1 FROM usuario_lojas
            WHERE loja_id = ? AND usuario_id = ? LIMIT 1
        `,
        args: [lojaId, usuario.id],
    });
    return result.rows.length > 0;
}

export async function GET(_request: Request, context: RouteContext) {
    try {
        const auth = await requirePermission("treinamentos.visualizar");
        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        const { id: lojaId } = await context.params;
        if (!(await podeAcessarLoja(lojaId, auth.usuario))) {
            return forbiddenResponse();
        }

        const result = await db.execute({
            sql: `
                SELECT
                    t.id,
                    t.loja_id,
                    t.titulo,
                    t.data_realizacao,
                    t.carga_horaria_minutos,
                    t.conteudo_programatico,
                    t.ministrante,
                    t.criado_em,
                    COUNT(tc.id) AS total_participantes,
                    GROUP_CONCAT(tc.nome_colaborador_snapshot, ' | ') AS participantes
                FROM treinamentos t
                LEFT JOIN treinamento_colaboradores tc
                    ON tc.treinamento_id = t.id
                WHERE t.loja_id = ?
                GROUP BY t.id
                ORDER BY t.data_realizacao DESC, t.criado_em DESC
            `,
            args: [lojaId],
        });

        return NextResponse.json({ success: true, treinamentos: result.rows });
    } catch (error) {
        console.error("Erro ao consultar treinamentos:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível consultar os treinamentos." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request, context: RouteContext) {
    try {
        const auth = await requirePermission("treinamentos.gerenciar");
        if (!auth.autorizado) {
            return auth.motivo === "NAO_AUTENTICADO"
                ? unauthorizedResponse()
                : forbiddenResponse();
        }

        if (auth.usuario.perfil !== "MASTER" && auth.usuario.perfil !== "SUPERVISORA") {
            return forbiddenResponse();
        }

        const { id: lojaId } = await context.params;
        if (!(await podeAcessarLoja(lojaId, auth.usuario))) {
            return forbiddenResponse();
        }

        const body = await request.json();
        const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
        const dataRealizacao = typeof body.dataRealizacao === "string" ? body.dataRealizacao : "";
        const cargaHorariaMinutos = Number(body.cargaHorariaMinutos);
        const conteudoProgramatico =
            typeof body.conteudoProgramatico === "string"
                ? body.conteudoProgramatico.trim()
                : "";
        const ministrante = typeof body.ministrante === "string" ? body.ministrante.trim() : "";
        const colaboradorIds = Array.isArray(body.colaboradorIds)
            ? [...new Set(body.colaboradorIds.filter((id: unknown) => typeof id === "string" && id.trim()).map((id: string) => id.trim()))]
            : [];

        if (!titulo || titulo.length > 180) {
            return NextResponse.json(
                { success: false, message: "Informe um título válido para o treinamento." },
                { status: 400 }
            );
        }

        if (!/^\d{4}-\d{2}-\d{2}$/.test(dataRealizacao) || Number.isNaN(Date.parse(dataRealizacao))) {
            return NextResponse.json(
                { success: false, message: "Informe uma data de realização válida." },
                { status: 400 }
            );
        }

        if (!Number.isInteger(cargaHorariaMinutos) || cargaHorariaMinutos <= 0 || cargaHorariaMinutos > 1440) {
            return NextResponse.json(
                { success: false, message: "A carga horária deve ser maior que zero e não ultrapassar 24 horas." },
                { status: 400 }
            );
        }

        if (!ministrante || ministrante.length > 180) {
            return NextResponse.json(
                { success: false, message: "Informe o nome do ministrante." },
                { status: 400 }
            );
        }

        if (colaboradorIds.length === 0) {
            return NextResponse.json(
                { success: false, message: "Selecione pelo menos um colaborador participante." },
                { status: 400 }
            );
        }

        const placeholders = colaboradorIds.map(() => "?").join(", ");
        const colaboradoresResult = await db.execute({
            sql: `
                SELECT id, nome, cargo
                FROM colaboradores
                WHERE loja_id = ?
                  AND ativo = 1
                  AND id IN (${placeholders})
            `,
            args: [lojaId, ...colaboradorIds],
        });

        if (colaboradoresResult.rows.length !== colaboradorIds.length) {
            return NextResponse.json(
                { success: false, message: "Um ou mais colaboradores não estão ativos ou não pertencem a esta loja." },
                { status: 400 }
            );
        }

        const treinamentoId = crypto.randomUUID();
        const statements = [
            {
                sql: `
                    INSERT INTO treinamentos (
                        id, loja_id, titulo, data_realizacao,
                        carga_horaria_minutos, conteudo_programatico,
                        ministrante, criado_por
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `,
                args: [
                    treinamentoId,
                    lojaId,
                    titulo,
                    dataRealizacao,
                    cargaHorariaMinutos,
                    conteudoProgramatico || null,
                    ministrante,
                    auth.usuario.id,
                ],
            },
            ...colaboradoresResult.rows.map((colaborador) => ({
                sql: `
                    INSERT INTO treinamento_colaboradores (
                        id, treinamento_id, colaborador_id,
                        nome_colaborador_snapshot, cargo_snapshot
                    ) VALUES (?, ?, ?, ?, ?)
                `,
                args: [
                    crypto.randomUUID(),
                    treinamentoId,
                    String(colaborador.id),
                    String(colaborador.nome),
                    colaborador.cargo === null ? null : String(colaborador.cargo),
                ],
            })),
        ];

        await db.batch(statements, "write");

        return NextResponse.json(
            {
                success: true,
                message: "Treinamento registrado com sucesso.",
                treinamentoId,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao registrar treinamento:", error);
        return NextResponse.json(
            { success: false, message: "Não foi possível registrar o treinamento." },
            { status: 500 }
        );
    }
}
