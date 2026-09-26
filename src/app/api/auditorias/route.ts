import { NextRequest, NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import { temPermissao } from "@/lib/auth/authorization";

type SetorInput = {
    setorId: string;
    checklistVersaoId: string;
};

function texto(valor: unknown): string {
    return typeof valor === "string" ? valor.trim() : "";
}

export async function GET() {
    const auth = await requirePermission("auditorias.visualizar");

    if (!auth.autorizado) {
        return NextResponse.json(
            {
                success: false,
                message:
                    auth.motivo === "NAO_AUTENTICADO"
                        ? "Usuário não autenticado."
                        : "Você não possui permissão para visualizar auditorias.",
            },
            { status: auth.motivo === "NAO_AUTENTICADO" ? 401 : 403 }
        );
    }

    const usuario = auth.usuario;

    try {
        let result;

        if (
            usuario.perfil === "MASTER" ||
            usuario.perfil === "SUPERVISORA"
        ) {
            result = await db.execute({
                sql: `
                    SELECT
                        a.id,
                        a.loja_id,
                        a.auditor_id,
                        a.encarregado_nome,
                        a.gerente_setor_nome,
                        a.gerente_loja_nome,
                        a.criada_em,
                        av.id AS auditoria_versao_id,
                        av.numero AS versao_numero,
                        av.status,
                        av.criada_em AS versao_criada_em,
                        l.nome AS loja_nome,
                        c.id AS cliente_id,
                        c.nome_fantasia AS cliente_nome,
                        u.nome AS auditor_nome
                    FROM auditorias a
                    INNER JOIN lojas l
                        ON l.id = a.loja_id
                    INNER JOIN clientes c
                        ON c.id = l.cliente_id
                    INNER JOIN usuarios u
                        ON u.id = a.auditor_id
                    INNER JOIN auditoria_versoes av
                        ON av.auditoria_id = a.id
                    WHERE av.numero = (
                        SELECT MAX(av2.numero)
                        FROM auditoria_versoes av2
                        WHERE av2.auditoria_id = a.id
                    )
                    ORDER BY a.criada_em DESC
                `,
                args: [],
            });
        } else {
            result = await db.execute({
                sql: `
                    SELECT
                        a.id,
                        a.loja_id,
                        a.auditor_id,
                        a.encarregado_nome,
                        a.gerente_setor_nome,
                        a.gerente_loja_nome,
                        a.criada_em,
                        av.id AS auditoria_versao_id,
                        av.numero AS versao_numero,
                        av.status,
                        av.criada_em AS versao_criada_em,
                        l.nome AS loja_nome,
                        c.id AS cliente_id,
                        c.nome_fantasia AS cliente_nome,
                        u.nome AS auditor_nome
                    FROM auditorias a
                    INNER JOIN lojas l
                        ON l.id = a.loja_id
                    INNER JOIN clientes c
                        ON c.id = l.cliente_id
                    INNER JOIN usuarios u
                        ON u.id = a.auditor_id
                    INNER JOIN auditoria_versoes av
                        ON av.auditoria_id = a.id
                    INNER JOIN usuario_lojas ul
                        ON ul.loja_id = a.loja_id
                       AND ul.usuario_id = ?
                    WHERE av.numero = (
                        SELECT MAX(av2.numero)
                        FROM auditoria_versoes av2
                        WHERE av2.auditoria_id = a.id
                    )
                    ORDER BY a.criada_em DESC
                `,
                args: [usuario.id],
            });
        }

        return NextResponse.json({
            success: true,
            auditorias: result.rows,
        });
    } catch (error) {
        console.error("Erro ao listar auditorias:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Erro interno ao listar auditorias.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const auth = await requirePermission("auditorias.iniciar");

    if (!auth.autorizado) {
        return NextResponse.json(
            {
                success: false,
                message:
                    auth.motivo === "NAO_AUTENTICADO"
                        ? "Usuário não autenticado."
                        : "Você não possui permissão para iniciar auditorias.",
            },
            { status: auth.motivo === "NAO_AUTENTICADO" ? 401 : 403 }
        );
    }

    const usuario = auth.usuario;

    try {
        const body = await request.json();

        const lojaId = texto(body.lojaId);
        const gerenteLojaNome = texto(body.gerenteLojaNome);

        const setores: SetorInput[] = Array.isArray(body.setores)
            ? body.setores
            : [];

        if (!lojaId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A loja é obrigatória.",
                },
                { status: 400 }
            );
        }

        

        if (!gerenteLojaNome) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O gerente da loja é obrigatório.",
                },
                { status: 400 }
            );
        }

        if (setores.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Selecione pelo menos um setor.",
                },
                { status: 400 }
            );
        }

        const setoresNormalizados = setores.map((item) => ({
            setorId: texto(item?.setorId),
            checklistVersaoId: texto(item?.checklistVersaoId),
        }));

        if (
            setoresNormalizados.some(
                (item) => !item.setorId || !item.checklistVersaoId
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Cada setor deve possuir setorId e checklistVersaoId.",
                },
                { status: 400 }
            );
        }

        const idsSetores = setoresNormalizados.map((item) => item.setorId);

        if (new Set(idsSetores).size !== idsSetores.length) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O mesmo setor não pode ser selecionado duas vezes.",
                },
                { status: 400 }
            );
        }

        /*
         * 1. Valida a loja.
         */
        const lojaResult = await db.execute({
            sql: `
                SELECT
                    l.id,
                    l.nome,
                    l.cliente_id,
                    l.ativo,
                    c.nome_fantasia AS cliente_nome
                FROM lojas l
                INNER JOIN clientes c
                    ON c.id = l.cliente_id
                WHERE l.id = ?
                LIMIT 1
            `,
            args: [lojaId],
        });

        if (lojaResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Loja não encontrada.",
                },
                { status: 404 }
            );
        }

        const loja = lojaResult.rows[0];

        if (Number(loja.ativo) !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A loja selecionada está inativa.",
                },
                { status: 400 }
            );
        }

        /*
         * 2. CONSULTOR só pode auditar lojas autorizadas.
         */
        if (usuario.perfil === "CONSULTOR") {
            const autorizacaoResult = await db.execute({
                sql: `
                    SELECT 1
                    FROM usuario_lojas
                    WHERE usuario_id = ?
                      AND loja_id = ?
                    LIMIT 1
                `,
                args: [usuario.id, lojaId],
            });

            if (autorizacaoResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Você não possui autorização para realizar auditorias nesta loja.",
                    },
                    { status: 403 }
                );
            }
        }

        /*
         * 3. Define o auditor.
         *
         * CONSULTOR:
         *   sempre o próprio usuário.
         *
         * SUPERVISORA / MASTER:
         *   precisa informar o auditor.
         */
        let auditorId = "";

        if (usuario.perfil === "CONSULTOR") {
            auditorId = usuario.id;
        } else {
            auditorId = texto(body.auditorId);

            if (!auditorId) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Selecione o auditor responsável.",
                    },
                    { status: 400 }
                );
            }
        }

        /*
         * 4. Valida o auditor.
         */
        const auditorResult = await db.execute({
            sql: `
                SELECT
                    id,
                    nome,
                    perfil,
                    ativo
                FROM usuarios
                WHERE id = ?
                LIMIT 1
            `,
            args: [auditorId],
        });

        if (auditorResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Auditor não encontrado.",
                },
                { status: 404 }
            );
        }

        const auditor = auditorResult.rows[0];

        if (Number(auditor.ativo) !== 1) {
            return NextResponse.json(
                {
                    success: false,
                    message: "O auditor selecionado está inativo.",
                },
                { status: 400 }
            );
        }

        const auditorPodeExecutar = await temPermissao(
            auditorId,
            "auditorias.executar"
        );

        if (!auditorPodeExecutar) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "O usuário selecionado não possui permissão para executar auditorias.",
                },
                { status: 400 }
            );
        }

        /*
 * 4.1. Valida a autorização do auditor para a loja.
 *
 * CONSULTOR:
 *   precisa estar autorizado à loja.
 *
 * SUPERVISORA / MASTER:
 *   podem atuar como auditor sem vínculo em usuario_lojas.
 */
        if (String(auditor.perfil) === "CONSULTOR") {
            const auditorAutorizadoResult = await db.execute({
                sql: `
            SELECT 1
            FROM usuario_lojas
            WHERE usuario_id = ?
              AND loja_id = ?
            LIMIT 1
        `,
                args: [auditorId, lojaId],
            });

            if (auditorAutorizadoResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "O consultor selecionado não possui autorização para realizar auditorias nesta loja.",
                    },
                    { status: 400 }
                );
            }
        }

        /*
         * 5. Valida todos os setores.
         *
         * O setor precisa:
         * - existir e estar ativo;
         * - estar associado à loja;
         * - possuir a versão de checklist informada;
         * - a versão precisa estar publicada;
         * - o checklist precisa pertencer ao setor.
         */
        const setoresValidados: {
            setorId: string;
            checklistVersaoId: string;
            ordem: number;
        }[] = [];

        for (let index = 0; index < setoresNormalizados.length; index++) {
            const item = setoresNormalizados[index];

            const setorResult = await db.execute({
                sql: `
                    SELECT
                        s.id,
                        s.nome,
                        s.ativo
                    FROM setores s
                    WHERE s.id = ?
                    LIMIT 1
                `,
                args: [item.setorId],
            });

            if (setorResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Setor não encontrado: ${item.setorId}.`,
                    },
                    { status: 404 }
                );
            }

            const setor = setorResult.rows[0];

            if (Number(setor.ativo) !== 1) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `O setor "${setor.nome}" está inativo.`,
                    },
                    { status: 400 }
                );
            }

            const associacaoResult = await db.execute({
                sql: `
                    SELECT 1
                    FROM loja_setores
                    WHERE loja_id = ?
                      AND setor_id = ?
                      AND ativo = 1
                    LIMIT 1
                `,
                args: [lojaId, item.setorId],
            });

            if (associacaoResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            `O setor "${setor.nome}" não está configurado para esta loja.`,
                    },
                    { status: 400 }
                );
            }

            const checklistResult = await db.execute({
                sql: `
                    SELECT
                        cv.id,
                        cv.numero,
                        cv.publicada,
                        c.id AS checklist_id,
                        c.setor_id,
                        c.nome AS checklist_nome,
                        s.nome AS setor_nome
                    FROM checklist_versoes cv
                    INNER JOIN checklists c
                        ON c.id = cv.checklist_id
                    INNER JOIN setores s
                        ON s.id = c.setor_id
                    WHERE cv.id = ?
                    LIMIT 1
                `,
                args: [item.checklistVersaoId],
            });

            if (checklistResult.rows.length === 0) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            `Versão de checklist não encontrada: ${item.checklistVersaoId}.`,
                    },
                    { status: 404 }
                );
            }

            const checklist = checklistResult.rows[0];

            if (String(checklist.setor_id) !== item.setorId) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            `A versão "${checklist.checklist_nome} v${checklist.numero}" não pertence ao setor "${setor.nome}".`,
                    },
                    { status: 400 }
                );
            }

            if (Number(checklist.publicada) !== 1) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            `A versão "${checklist.checklist_nome} v${checklist.numero}" não está publicada.`,
                    },
                    { status: 400 }
                );
            }

            setoresValidados.push({
                setorId: item.setorId,
                checklistVersaoId: item.checklistVersaoId,
                ordem: index + 1,
            });
        }

        /*
         * 6. Cria a auditoria.
         */
        const auditoriaId = crypto.randomUUID();
        const auditoriaVersaoId = crypto.randomUUID();

        await db.batch(
            [
                {
                    sql: `
                        INSERT INTO auditorias (
                            id,
                            loja_id,
                            auditor_id,
                            encarregado_nome,
                            gerente_setor_nome,
                            gerente_loja_nome
                        )
                        VALUES (?, ?, ?, ?, ?, ?)
                    `,
                    args: [
                        auditoriaId,
                        lojaId,
                        auditorId,
                        null,
                        null,
                        gerenteLojaNome,
                    ],
                },
                {
                    sql: `
                        INSERT INTO auditoria_versoes (
                            id,
                            auditoria_id,
                            numero,
                            status,
                            criada_por
                        )
                        VALUES (?, ?, 1, 'ABERTA', ?)
                    `,
                    args: [
                        auditoriaVersaoId,
                        auditoriaId,
                        usuario.id,
                    ],
                },
                ...setoresValidados.map((item) => ({
                    sql: `
                        INSERT INTO auditoria_setores (
                            id,
                            auditoria_versao_id,
                            setor_id,
                            checklist_versao_id,
                            ordem
                        )
                        VALUES (?, ?, ?, ?, ?)
                    `,
                    args: [
                        crypto.randomUUID(),
                        auditoriaVersaoId,
                        item.setorId,
                        item.checklistVersaoId,
                        item.ordem,
                    ],
                })),
                {
                    sql: `
                        INSERT INTO auditoria_historico (
                            id,
                            auditoria_id,
                            usuario_id,
                            acao,
                            detalhes
                        )
                        VALUES (?, ?, ?, 'CRIADA', ?)
                    `,
                    args: [
                        crypto.randomUUID(),
                        auditoriaId,
                        usuario.id,
                        JSON.stringify({
                            auditorId,
                            lojaId,
                            setores: setoresValidados,
                        }),
                    ],
                },
            ],
            "write"
        );

        return NextResponse.json(
            {
                success: true,
                message: "Auditoria criada com sucesso.",
                auditoria: {
                    id: auditoriaId,
                    auditoriaVersaoId,
                    numero: 1,
                    status: "ABERTA",
                    lojaId,
                    auditorId,
                    setores: setoresValidados,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("Erro ao criar auditoria:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Erro interno ao criar auditoria.",
            },
            { status: 500 }
        );
    }
}