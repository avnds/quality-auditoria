import { del, get, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import db from "@/lib/db";
import { requirePermission } from "@/lib/auth/require-permission";
import {
    forbiddenResponse,
    unauthorizedResponse,
} from "@/lib/auth/auth-response";

type RouteContext = {
    params: Promise<{
        id: string;
    }>;
};

const TIPOS_PERMITIDOS = [
    "image/jpeg",
    "image/png",
    "image/webp",
] as const;

const TAMANHO_MAXIMO = 10 * 1024 * 1024;

function obterExtensao(contentType: string) {
    switch (contentType) {
        case "image/jpeg":
            return "jpg";
        case "image/png":
            return "png";
        case "image/webp":
            return "webp";
        default:
            return null;
    }
}

export async function GET(
    request: Request,
    context: RouteContext
) {
    try {
        const resultadoPermissao =
            await requirePermission(
                "auditorias.adicionar_evidencia"
            );

        if (!resultadoPermissao.autorizado) {
            if (
                resultadoPermissao.motivo ===
                "NAO_AUTENTICADO"
            ) {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultadoPermissao.usuario;
        const { id: auditoriaId } =
            await context.params;

        const url = new URL(request.url);

        const evidenciaId =
            url.searchParams.get(
                "evidenciaId"
            )?.trim();

        if (!evidenciaId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Evidência não informada.",
                },
                { status: 400 }
            );
        }

        const auditoriaResult =
            await db.execute({
                sql: `
                    SELECT
                        a.id,
                        a.loja_id
                    FROM auditorias a
                    WHERE a.id = ?
                    LIMIT 1
                `,
                args: [auditoriaId],
            });

        if (
            auditoriaResult.rows.length ===
            0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Auditoria não encontrada.",
                },
                { status: 404 }
            );
        }

        const auditoria =
            auditoriaResult.rows[0];

        if (
            usuario.perfil !== "MASTER" &&
            usuario.perfil !== "SUPERVISORA"
        ) {
            const autorizacaoResult =
                await db.execute({
                    sql: `
                        SELECT 1
                        FROM usuario_lojas
                        WHERE usuario_id = ?
                          AND loja_id = ?
                        LIMIT 1
                    `,
                    args: [
                        usuario.id,
                        String(
                            auditoria.loja_id
                        ),
                    ],
                });

            if (
                autorizacaoResult.rows.length ===
                0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Você não possui autorização para esta auditoria.",
                    },
                    { status: 403 }
                );
            }
        }

        const evidenciaResult =
            await db.execute({
                sql: `
                    SELECT
                        e.id,
                        e.arquivo_uri,
                        e.ordem
                    FROM evidencias e

                    INNER JOIN auditoria_respostas ar
                        ON ar.id = e.resposta_id

                    INNER JOIN auditoria_setores aus
                        ON aus.id =
                           ar.auditoria_setor_id

                    INNER JOIN auditoria_versoes av
                        ON av.id =
                           aus.auditoria_versao_id

                    WHERE e.id = ?
                      AND av.auditoria_id = ?

                    LIMIT 1
                `,
                args: [
                    evidenciaId,
                    auditoriaId,
                ],
            });

        if (
            evidenciaResult.rows.length ===
            0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Evidência não encontrada para esta auditoria.",
                },
                { status: 404 }
            );
        }

        const evidencia =
            evidenciaResult.rows[0];

        const blob = await get(
            String(
                evidencia.arquivo_uri
            ),
            {
                access: "private",
            }
        );

        if (!blob) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Arquivo da evidência não encontrado.",
                },
                { status: 404 }
            );
        }

        return new Response(
            blob.stream,
            {
                status: 200,
                headers: {
                    "Content-Type":
                        blob.blob.contentType ??
                        "application/octet-stream",
                    "Content-Length":
                        String(
                            blob.blob.size
                        ),
                    "Cache-Control":
                        "private, no-store",
                },
            }
        );
    } catch (error) {
        console.error(
            "Erro ao visualizar evidência:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível visualizar a evidência.",
            },
            { status: 500 }
        );
    }
}

export async function POST(
    request: Request,
    context: RouteContext
) {
    let blobCriado: {
        url: string;
    } | null = null;

    try {
        const resultadoPermissao =
            await requirePermission(
                "auditorias.adicionar_evidencia"
            );

        if (!resultadoPermissao.autorizado) {
            if (
                resultadoPermissao.motivo ===
                "NAO_AUTENTICADO"
            ) {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultadoPermissao.usuario;
        const { id: auditoriaId } =
            await context.params;

        const formData = await request.formData();

        const respostaId = String(
            formData.get("respostaId") ?? ""
        ).trim();

        const arquivo = formData.get("arquivo");

        if (!respostaId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Resposta da auditoria não informada.",
                },
                { status: 400 }
            );
        }

        if (!(arquivo instanceof File)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Arquivo de evidência não informado.",
                },
                { status: 400 }
            );
        }

        if (arquivo.size <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "O arquivo de evidência está vazio.",
                },
                { status: 400 }
            );
        }

        if (arquivo.size > TAMANHO_MAXIMO) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A imagem deve ter no máximo 10 MB.",
                },
                { status: 400 }
            );
        }

        if (
            !TIPOS_PERMITIDOS.includes(
                arquivo.type as (typeof TIPOS_PERMITIDOS)[number]
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Formato de imagem não permitido. Use JPG, PNG ou WEBP.",
                },
                { status: 400 }
            );
        }

        const extensao = obterExtensao(
            arquivo.type
        );

        if (!extensao) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Não foi possível identificar o formato da imagem.",
                },
                { status: 400 }
            );
        }

        const auditoriaResult = await db.execute({
            sql: `
                SELECT
                    a.id,
                    a.loja_id,
                    av.id AS auditoria_versao_id,
                    av.status AS auditoria_status
                FROM auditorias a

                INNER JOIN auditoria_versoes av
                    ON av.auditoria_id = a.id

                WHERE a.id = ?

                  AND av.numero = (
                      SELECT MAX(av2.numero)
                      FROM auditoria_versoes av2
                      WHERE av2.auditoria_id = a.id
                  )

                LIMIT 1
            `,
            args: [auditoriaId],
        });

        if (auditoriaResult.rows.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Auditoria não encontrada.",
                },
                { status: 404 }
            );
        }

        const auditoria =
            auditoriaResult.rows[0];

        if (
            usuario.perfil !== "MASTER" &&
            usuario.perfil !== "SUPERVISORA"
        ) {
            const autorizacaoResult =
                await db.execute({
                    sql: `
                        SELECT 1
                        FROM usuario_lojas
                        WHERE usuario_id = ?
                          AND loja_id = ?
                        LIMIT 1
                    `,
                    args: [
                        usuario.id,
                        String(
                            auditoria.loja_id
                        ),
                    ],
                });

            if (
                autorizacaoResult.rows.length ===
                0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Você não possui autorização para esta auditoria.",
                    },
                    { status: 403 }
                );
            }
        }

        if (
            String(auditoria.auditoria_status) !== "ABERTA" &&
            String(auditoria.auditoria_status) !== "EM_CORRECAO"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Esta auditoria não está aberta para receber evidências.",
                },
                { status: 409 }
            );
        }

        const respostaResult =
            await db.execute({
                sql: `
                    SELECT
                        ar.id,
                        ar.resultado,
                        ar.auditoria_setor_id
                    FROM auditoria_respostas ar

                    INNER JOIN auditoria_setores aus
                        ON aus.id =
                           ar.auditoria_setor_id

                    WHERE ar.id = ?
                      AND aus.auditoria_versao_id = ?

                    LIMIT 1
                `,
                args: [
                    respostaId,
                    String(
                        auditoria.auditoria_versao_id
                    ),
                ],
            });

        if (
            respostaResult.rows.length ===
            0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Resposta não encontrada para esta auditoria.",
                },
                { status: 404 }
            );
        }

        const resposta =
            respostaResult.rows[0];

        const resultadoResposta = String(
            resposta.resultado
        );

        if (
            resultadoResposta !==
            "NAO_CONFORME" &&
            resultadoResposta !==
            "PARCIALMENTE_CONFORME"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Este resultado não permite adicionar evidências.",
                },
                { status: 409 }
            );
        }

        const evidenciasResult =
            await db.execute({
                sql: `
                    SELECT COUNT(*) AS total
                    FROM evidencias
                    WHERE resposta_id = ?
                `,
                args: [respostaId],
            });

        const totalEvidencias = Number(
            evidenciasResult.rows[0]?.total ?? 0
        );

        if (totalEvidencias >= 2) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Esta resposta já possui o máximo de 2 evidências.",
                },
                { status: 409 }
            );
        }

        const ordem = totalEvidencias + 1;

        const pathname =
            `auditorias/${auditoriaId}/respostas/${respostaId}/${Date.now()}.${extensao}`;

        const blob = await put(
            pathname,
            arquivo,
            {
                access: "private",
                addRandomSuffix: true,
                contentType: arquivo.type,

            }
        );

        blobCriado = {
            url: blob.url,
        };

        const evidenciaId =
            crypto.randomUUID();

        await db.execute({
            sql: `
                INSERT INTO evidencias (
                    id,
                    resposta_id,
                    arquivo_uri,
                    ordem,
                    capturada_em
                )
                VALUES (
                    ?,
                    ?,
                    ?,
                    ?,
                    CURRENT_TIMESTAMP
                )
            `,
            args: [
                evidenciaId,
                respostaId,
                blob.url,
                ordem,
            ],
        });

        return NextResponse.json({
            success: true,
            evidencia: {
                id: evidenciaId,
                respostaId,
                arquivoUri: blob.url,
                ordem,
                capturadaEm:
                    new Date().toISOString(),
            },
        });
    } catch (error) {
        console.error(
            "Erro ao salvar evidência:",
            error
        );

        if (blobCriado) {
            try {
                await del(blobCriado.url);
            } catch (erroRemocao) {
                console.error(
                    "Erro ao remover Blob após falha no salvamento:",
                    erroRemocao
                );
            }
        }

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível salvar a evidência.",
            },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: Request,
    context: RouteContext
) {
    let blobCriado: {
        url: string;
    } | null = null;

    try {
        const resultadoPermissao =
            await requirePermission(
                "auditorias.adicionar_evidencia"
            );

        if (!resultadoPermissao.autorizado) {
            if (
                resultadoPermissao.motivo ===
                "NAO_AUTENTICADO"
            ) {
                return unauthorizedResponse();
            }

            return forbiddenResponse();
        }

        const usuario = resultadoPermissao.usuario;
        const { id: auditoriaId } =
            await context.params;

        const formData = await request.formData();

        const evidenciaId = String(
            formData.get("evidenciaId") ?? ""
        ).trim();

        const arquivo = formData.get("arquivo");

        if (!evidenciaId) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Evidência não informada.",
                },
                { status: 400 }
            );
        }

        if (!(arquivo instanceof File)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Arquivo de evidência não informado.",
                },
                { status: 400 }
            );
        }

        if (arquivo.size <= 0) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "O arquivo de evidência está vazio.",
                },
                { status: 400 }
            );
        }

        if (arquivo.size > TAMANHO_MAXIMO) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "A imagem deve ter no máximo 10 MB.",
                },
                { status: 400 }
            );
        }

        if (
            !TIPOS_PERMITIDOS.includes(
                arquivo.type as (typeof TIPOS_PERMITIDOS)[number]
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Formato de imagem não permitido. Use JPG, PNG ou WEBP.",
                },
                { status: 400 }
            );
        }

        const extensao = obterExtensao(
            arquivo.type
        );

        if (!extensao) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Não foi possível identificar o formato da imagem.",
                },
                { status: 400 }
            );
        }

        const auditoriaResult =
            await db.execute({
                sql: `
                    SELECT
                        a.id,
                        a.loja_id,
                        av.id AS auditoria_versao_id,
                        av.status AS auditoria_status
                    FROM auditorias a

                    INNER JOIN auditoria_versoes av
                        ON av.auditoria_id = a.id

                    WHERE a.id = ?

                      AND av.numero = (
                          SELECT MAX(av2.numero)
                          FROM auditoria_versoes av2
                          WHERE av2.auditoria_id = a.id
                      )

                    LIMIT 1
                `,
                args: [auditoriaId],
            });

        if (
            auditoriaResult.rows.length === 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Auditoria não encontrada.",
                },
                { status: 404 }
            );
        }

        const auditoria =
            auditoriaResult.rows[0];

        if (
            usuario.perfil !== "MASTER" &&
            usuario.perfil !== "SUPERVISORA"
        ) {
            const autorizacaoResult =
                await db.execute({
                    sql: `
                        SELECT 1
                        FROM usuario_lojas
                        WHERE usuario_id = ?
                          AND loja_id = ?
                        LIMIT 1
                    `,
                    args: [
                        usuario.id,
                        String(
                            auditoria.loja_id
                        ),
                    ],
                });

            if (
                autorizacaoResult.rows.length ===
                0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Você não possui autorização para esta auditoria.",
                    },
                    { status: 403 }
                );
            }
        }

        if (
            String(auditoria.auditoria_status) !== "ABERTA" &&
            String(auditoria.auditoria_status) !== "EM_CORRECAO"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Esta auditoria não está aberta para substituir evidências.",
                },
                { status: 409 }
            );
        }

        const evidenciaResult =
            await db.execute({
                sql: `
                    SELECT
                        e.id,
                        e.resposta_id,
                        e.arquivo_uri,
                        e.ordem,
                        ar.resultado
                    FROM evidencias e

                    INNER JOIN auditoria_respostas ar
                        ON ar.id = e.resposta_id

                    INNER JOIN auditoria_setores aus
                        ON aus.id =
                           ar.auditoria_setor_id

                    WHERE e.id = ?
                      AND aus.auditoria_versao_id = ?

                    LIMIT 1
                `,
                args: [
                    evidenciaId,
                    String(
                        auditoria.auditoria_versao_id
                    ),
                ],
            });

        if (
            evidenciaResult.rows.length === 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Evidência não encontrada para esta auditoria.",
                },
                { status: 404 }
            );
        }

        const evidencia =
            evidenciaResult.rows[0];

        const resultadoResposta =
            String(evidencia.resultado);

        if (
            resultadoResposta !==
            "NAO_CONFORME" &&
            resultadoResposta !==
            "PARCIALMENTE_CONFORME"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Esta resposta não permite substituir evidências.",
                },
                { status: 409 }
            );
        }

        const pathname =
            `auditorias/${auditoriaId}/respostas/${evidencia.resposta_id}/${Date.now()}.${extensao}`;

        const blob = await put(
            pathname,
            arquivo,
            {
                access: "private",
                addRandomSuffix: true,
                contentType: arquivo.type,
            }
        );

        blobCriado = {
            url: blob.url,
        };

        await db.execute({
            sql: `
                UPDATE evidencias
                SET
                    arquivo_uri = ?,
                    capturada_em = CURRENT_TIMESTAMP
                WHERE id = ?
            `,
            args: [
                blob.url,
                evidenciaId,
            ],
        });

        try {
            await del(
                String(evidencia.arquivo_uri)
            );
        } catch (erroRemocao) {
            console.error(
                "Erro ao remover evidência anterior do Blob:",
                erroRemocao
            );
        }

        return NextResponse.json({
            success: true,
            evidencia: {
                id: evidenciaId,
                respostaId:
                    String(
                        evidencia.resposta_id
                    ),
                arquivoUri: blob.url,
                ordem: Number(
                    evidencia.ordem
                ),
            },
        });
    } catch (error) {
        console.error(
            "Erro ao substituir evidência:",
            error
        );

        if (blobCriado) {
            try {
                await del(blobCriado.url);
            } catch (erroRemocao) {
                console.error(
                    "Erro ao remover novo Blob após falha na substituição:",
                    erroRemocao
                );
            }
        }

        return NextResponse.json(
            {
                success: false,
                message:
                    "Não foi possível substituir a evidência.",
            },
            { status: 500 }
        );
    }
}