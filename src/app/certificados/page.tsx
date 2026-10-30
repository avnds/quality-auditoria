import Link from "next/link";
import { redirect } from "next/navigation";

import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";

function formatarData(valor: unknown) {
    if (valor == null) return "Não informada";
    const data = new Date(String(valor));
    if (Number.isNaN(data.getTime())) return String(valor);
    return data.toLocaleDateString("pt-BR", { timeZone: "America/Fortaleza" });
}

export default async function CertificadosPage() {
    const usuario = await getCurrentUser();
    if (!usuario) redirect("/login");

    const permitido = await temPermissao(usuario.id, "certificados.visualizar");
    if (!permitido) {
        return (
            <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
                <div className="mx-auto max-w-6xl rounded-2xl border border-red-200 bg-white p-8 shadow-sm">
                    <h1 className="text-xl font-semibold text-[#c22a2e]">Acesso não permitido</h1>
                    <p className="mt-2 text-slate-600">Você não possui permissão para visualizar certificados.</p>
                </div>
            </main>
        );
    }

    const acessoAmplo = usuario.perfil === "MASTER" || usuario.perfil === "SUPERVISORA";
    const result = await db.execute({
        sql: `
            SELECT
                cert.id,
                cert.numero,
                cert.nome_colaborador,
                cert.cargo_colaborador,
                cert.nome_loja,
                cert.nome_cliente,
                cert.titulo_treinamento,
                cert.data_realizacao,
                cert.carga_horaria_minutos,
                cert.emitido_em,
                cert.arquivo_uri
            FROM certificados cert
            INNER JOIN treinamento_colaboradores tc
                ON tc.id = cert.treinamento_colaborador_id
            INNER JOIN treinamentos t
                ON t.id = tc.treinamento_id
            WHERE (
                ? = 1
                OR EXISTS (
                    SELECT 1 FROM usuario_lojas ul
                    WHERE ul.loja_id = t.loja_id
                      AND ul.usuario_id = ?
                )
            )
            ORDER BY cert.emitido_em DESC
        `,
        args: [acessoAmplo ? 1 : 0, usuario.id],
    });

    const certificados = result.rows;

    return (
        <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-[#12223f]">Certificados</h1>
                    <div className="mt-2 h-1 w-20 rounded-full bg-[#c22a2e]" />
                    <p className="mt-3 text-slate-600">
                        Consulte e baixe os certificados individuais emitidos para os participantes dos treinamentos.
                    </p>
                </div>

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-4">
                        <div>
                            <h2 className="text-lg font-semibold text-[#12223f]">Certificados emitidos</h2>
                            <p className="mt-1 text-sm text-slate-500">{certificados.length} registro(s)</p>
                        </div>
                        <Link
                            href="/treinamentos"
                            className="inline-flex items-center justify-center rounded-lg bg-[#22365b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#182947]"
                        >
                            Gerar certificados
                        </Link>
                    </div>

                    {certificados.length === 0 ? (
                        <div className="px-6 py-12 text-center">
                            <p className="font-medium text-slate-700">Nenhum certificado emitido ainda.</p>
                            <p className="mt-2 text-sm text-slate-500">Clique em Gerar certificados para selecionar uma loja, acessar o histórico de treinamentos e emitir os PDFs dos participantes.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100">
                            {certificados.map((cert) => (
                                <article key={String(cert.id)} className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-800">{String(cert.nome_colaborador)}</p>
                                        <p className="mt-1 text-sm text-slate-600">{String(cert.titulo_treinamento)}</p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            {String(cert.nome_cliente)} · {String(cert.nome_loja)}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                            Realizado em {formatarData(cert.data_realizacao)} · {Math.floor(Number(cert.carga_horaria_minutos) / 60)}h {Number(cert.carga_horaria_minutos) % 60}min
                                        </p>
                                        <p className="mt-1 text-xs font-medium text-slate-500">
                                            Nº {String(cert.numero)} · Emitido em {formatarData(cert.emitido_em)}
                                        </p>
                                    </div>
                                    {cert.arquivo_uri ? (
                                        <a
                                            href={`/api/certificados/${encodeURIComponent(String(cert.id))}/pdf`}
                                            className="inline-flex shrink-0 items-center justify-center rounded-lg bg-[#22365b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#182947]"
                                        >
                                            Baixar PDF
                                        </a>
                                    ) : (
                                        <span className="max-w-xs text-xs text-slate-500">PDF não armazenado. Para baixar, gere novamente pelo histórico do treinamento.</span>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
