import { redirect } from "next/navigation";

import db from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import CertificadosManager from "./CertificadosManager";

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
    const podeGerar = acessoAmplo && await temPermissao(usuario.id, "certificados.gerar");
    const result = await db.execute({
        sql: `
            SELECT
                tc.id AS participante_id,
                t.id AS treinamento_id,
                tc.nome_colaborador_snapshot AS nome_colaborador,
                tc.cargo_snapshot AS cargo_colaborador,
                l.nome AS nome_loja,
                c.nome_fantasia AS nome_cliente,
                t.titulo AS titulo_treinamento,
                t.data_realizacao,
                t.carga_horaria_minutos,
                cert.id AS certificado_id,
                cert.numero AS certificado_numero,
                cert.emitido_em
            FROM treinamento_colaboradores tc
            INNER JOIN treinamentos t ON t.id = tc.treinamento_id
            INNER JOIN lojas l ON l.id = t.loja_id
            INNER JOIN clientes c ON c.id = l.cliente_id
            LEFT JOIN certificados cert ON cert.treinamento_colaborador_id = tc.id
            WHERE (
                ? = 1
                OR EXISTS (
                    SELECT 1 FROM usuario_lojas ul
                    WHERE ul.loja_id = t.loja_id AND ul.usuario_id = ?
                )
            )
            ORDER BY t.data_realizacao DESC, tc.nome_colaborador_snapshot
        `,
        args: [acessoAmplo ? 1 : 0, usuario.id],
    });

    const certificados = result.rows.map((cert) => ({
        participanteId: String(cert.participante_id),
        treinamentoId: String(cert.treinamento_id),
        nomeColaborador: String(cert.nome_colaborador),
        cargoColaborador: cert.cargo_colaborador == null ? null : String(cert.cargo_colaborador),
        nomeLoja: String(cert.nome_loja),
        nomeCliente: String(cert.nome_cliente),
        tituloTreinamento: String(cert.titulo_treinamento),
        dataRealizacao: String(cert.data_realizacao),
        cargaHorariaMinutos: Number(cert.carga_horaria_minutos),
        certificadoId: cert.certificado_id == null ? null : String(cert.certificado_id),
        certificadoNumero: cert.certificado_numero == null ? null : String(cert.certificado_numero),
        emitidoEm: cert.emitido_em == null ? null : String(cert.emitido_em),
    }));

    return (
        <main className="min-h-screen bg-slate-50 p-6 sm:p-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-[#12223f]">Certificados</h1>
                    <div className="mt-2 h-1 w-20 rounded-full bg-[#c22a2e]" />
                    <p className="mt-3 text-slate-600">
                        Consulte e emita certificados individuais dos participantes dos treinamentos.
                    </p>
                </div>
                <CertificadosManager certificados={certificados} podeGerar={podeGerar} />
            </div>
        </main>
    );
}
