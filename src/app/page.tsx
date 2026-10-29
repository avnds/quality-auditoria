import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { temPermissao } from "@/lib/auth/authorization";
import db from "@/lib/db";

type AuditoriaResumo = {
    id: string;
    cliente_nome: string;
    loja_nome: string;
    auditor_nome: string;
    status: string;
    versao_numero: number;
    criada_em: string;
    motivo_devolucao: string | null;
};

type Indicador = {
    titulo: string;
    valor: number;
    descricao: string;
    href?: string;
};

const STATUS_LABELS: Record<string, string> = {
    ABERTA: "Aberta",
    EM_CORRECAO: "Em correção",
    ENVIADA: "Aguardando análise",
    FINALIZADA: "Finalizada",
    DEVOLVIDA: "Devolvida",
    CANCELADA: "Cancelada",
};

function formatarData(valor: string) {
    if (!valor) return "—";
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return valor;
    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
    }).format(data);
}

function CartaoIndicador({ indicador }: { indicador: Indicador }) {
    const conteudo = (
        <div className="h-full rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md">
            <p className="text-sm font-medium text-slate-500">{indicador.titulo}</p>
            <p className="mt-3 text-3xl font-bold text-[#12223f]">
                {indicador.valor.toLocaleString("pt-BR")}
            </p>
            <p className="mt-2 text-sm text-slate-500">{indicador.descricao}</p>
        </div>
    );

    return indicador.href ? (
        <Link href={indicador.href} className="block h-full">
            {conteudo}
        </Link>
    ) : conteudo;
}

function SecaoTitulo({
    titulo,
    descricao,
    href,
    linkTexto,
}: {
    titulo: string;
    descricao: string;
    href?: string;
    linkTexto?: string;
}) {
    return (
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
                <h2 className="text-xl font-bold text-[#12223f]">{titulo}</h2>
                <p className="mt-1 text-sm text-slate-600">{descricao}</p>
            </div>
            {href && linkTexto ? (
                <Link
                    href={href}
                    className="text-sm font-semibold text-[#c22a2e] hover:underline"
                >
                    {linkTexto}
                </Link>
            ) : null}
        </div>
    );
}

function ListaAuditorias({
    auditorias,
    vazio,
    textoAcao,
}: {
    auditorias: AuditoriaResumo[];
    vazio: string;
    textoAcao: string;
}) {
    if (auditorias.length === 0) {
        return (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
                {vazio}
            </div>
        );
    }

    return (
        <div className="divide-y divide-slate-100">
            {auditorias.map((auditoria) => (
                <div
                    key={auditoria.id}
                    className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="min-w-0">
                        <p className="font-semibold text-[#12223f]">
                            {auditoria.loja_nome}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                            {auditoria.cliente_nome}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                            Auditor: {auditoria.auditor_nome} · v{auditoria.versao_numero} · {formatarData(auditoria.criada_em)}
                        </p>
                        {auditoria.motivo_devolucao ? (
                            <p className="mt-2 text-sm text-[#c22a2e]">
                                Motivo da devolução: {auditoria.motivo_devolucao}
                            </p>
                        ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                            {STATUS_LABELS[auditoria.status] ?? auditoria.status}
                        </span>
                        <Link
                            href={`/auditorias/${auditoria.id}`}
                            className="inline-flex min-h-10 items-center justify-center rounded-lg bg-[#22365b] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
                        >
                            {textoAcao}
                        </Link>
                    </div>
                </div>
            ))}
        </div>
    );
}

export default async function Home() {
    const usuario = await getCurrentUser();

    if (!usuario) {
        redirect("/login");
    }

    const ehMaster = usuario.perfil === "MASTER";
    const ehSupervisora = usuario.perfil === "SUPERVISORA";
    const ehConsultor = usuario.perfil === "CONSULTOR";

    const podeVerAuditorias = await temPermissao(usuario.id, "auditorias.visualizar");
    const podeVerClientes = await temPermissao(usuario.id, "clientes.visualizar");
    const podeVerUsuarios = await temPermissao(usuario.id, "usuarios.visualizar");

    const indicadoresMaster: Indicador[] = [];
    let auditoriasRecentes: AuditoriaResumo[] = [];
    let totalAguardando = 0;
    let totalCorrecao = 0;
    let totalAbertas = 0;

    if (ehMaster) {
        const [clientes, lojas, usuariosAtivos, auditoriasStatus] = await Promise.all([
            podeVerClientes
                ? db.execute("SELECT COUNT(*) AS total FROM clientes WHERE ativo = 1")
                : Promise.resolve({ rows: [{ total: 0 }] }),
            podeVerClientes
                ? db.execute("SELECT COUNT(*) AS total FROM lojas WHERE ativo = 1")
                : Promise.resolve({ rows: [{ total: 0 }] }),
            podeVerUsuarios
                ? db.execute("SELECT COUNT(*) AS total FROM usuarios WHERE ativo = 1")
                : Promise.resolve({ rows: [{ total: 0 }] }),
            podeVerAuditorias
                ? db.execute(`
                    SELECT av.status, COUNT(*) AS total
                    FROM auditorias a
                    INNER JOIN auditoria_versoes av ON av.auditoria_id = a.id
                    WHERE av.numero = (
                        SELECT MAX(av2.numero)
                        FROM auditoria_versoes av2
                        WHERE av2.auditoria_id = a.id
                    )
                    GROUP BY av.status
                `)
                : Promise.resolve({ rows: [] }),
        ]);

        const totaisStatus = new Map(
            auditoriasStatus.rows.map((linha) => [String(linha.status), Number(linha.total)])
        );

        indicadoresMaster.push(
            { titulo: "Clientes ativos", valor: Number(clientes.rows[0]?.total ?? 0), descricao: "Clientes cadastrados", href: podeVerClientes ? "/clientes" : undefined },
            { titulo: "Lojas ativas", valor: Number(lojas.rows[0]?.total ?? 0), descricao: "Estabelecimentos cadastrados", href: podeVerClientes ? "/clientes" : undefined },
            { titulo: "Usuários ativos", valor: Number(usuariosAtivos.rows[0]?.total ?? 0), descricao: "Contas habilitadas", href: podeVerUsuarios ? "/usuarios" : undefined },
            { titulo: "Auditorias", valor: [...totaisStatus.values()].reduce((soma, total) => soma + total, 0), descricao: "Total de auditorias registradas", href: podeVerAuditorias ? "/auditorias" : undefined },
        );

        totalAguardando = totaisStatus.get("ENVIADA") ?? 0;
        totalCorrecao = totaisStatus.get("EM_CORRECAO") ?? 0;
        totalAbertas = totaisStatus.get("ABERTA") ?? 0;
    }

    if (podeVerAuditorias) {
        const filtroPerfil = ehConsultor ? "AND a.auditor_id = ?" : "";
        const args = ehConsultor ? [usuario.id] : [];
        const limite = ehSupervisora ? 8 : 6;

        const result = await db.execute({
            sql: `
                SELECT
                    a.id,
                    c.nome_fantasia AS cliente_nome,
                    l.nome AS loja_nome,
                    u.nome AS auditor_nome,
                    av.status,
                    av.numero AS versao_numero,
                    a.criada_em,
                    av.motivo_devolucao
                FROM auditorias a
                INNER JOIN lojas l ON l.id = a.loja_id
                INNER JOIN clientes c ON c.id = l.cliente_id
                INNER JOIN usuarios u ON u.id = a.auditor_id
                INNER JOIN auditoria_versoes av ON av.auditoria_id = a.id
                WHERE av.numero = (
                    SELECT MAX(av2.numero)
                    FROM auditoria_versoes av2
                    WHERE av2.auditoria_id = a.id
                )
                ${filtroPerfil}
                ${ehSupervisora ? "AND av.status IN ('ENVIADA', 'EM_CORRECAO')" : ""}
                ${ehConsultor ? "AND av.status IN ('ABERTA', 'EM_CORRECAO', 'FINALIZADA', 'DEVOLVIDA')" : ""}
                ORDER BY a.criada_em DESC
                LIMIT ${limite}
            `,
            args,
        });

        auditoriasRecentes = result.rows.map((linha) => ({
            id: String(linha.id),
            cliente_nome: String(linha.cliente_nome),
            loja_nome: String(linha.loja_nome),
            auditor_nome: String(linha.auditor_nome),
            status: String(linha.status),
            versao_numero: Number(linha.versao_numero),
            criada_em: String(linha.criada_em),
            motivo_devolucao: linha.motivo_devolucao == null ? null : String(linha.motivo_devolucao),
        }));

        if (ehSupervisora || ehConsultor) {
            const contagens = await db.execute({
                sql: `
                    SELECT av.status, COUNT(*) AS total
                    FROM auditorias a
                    INNER JOIN auditoria_versoes av ON av.auditoria_id = a.id
                    WHERE av.numero = (
                        SELECT MAX(av2.numero)
                        FROM auditoria_versoes av2
                        WHERE av2.auditoria_id = a.id
                    )
                    ${filtroPerfil}
                    GROUP BY av.status
                `,
                args,
            });

            const totais = new Map(
                contagens.rows.map((linha) => [String(linha.status), Number(linha.total)])
            );

            totalAguardando = totais.get("ENVIADA") ?? 0;
            totalCorrecao = totais.get("EM_CORRECAO") ?? 0;
            totalAbertas = totais.get("ABERTA") ?? 0;
        }
    }

    const nomePrimeiro = usuario.nome.trim().split(/\s+/)[0] || "usuário";

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">
                <section className="mb-8 rounded-2xl bg-white p-6 shadow-sm sm:p-8">
                    <p className="text-sm font-semibold uppercase tracking-wide text-[#c22a2e]">
                        Quality Consultoria em Alimentos
                    </p>
                    <h1 className="mt-2 text-3xl font-bold text-[#12223f] sm:text-4xl">
                        Olá, {nomePrimeiro}!
                    </h1>
                    <div className="mt-3 h-1 w-20 rounded-full bg-[#c22a2e]" />
                    <p className="mt-4 max-w-3xl text-slate-600">
                        {ehMaster
                            ? "Acompanhe os principais indicadores e a operação do sistema."
                            : ehSupervisora
                                ? "Acompanhe as auditorias que precisam de análise e as que estão em correção."
                                : "Acesse suas auditorias, continue o trabalho em andamento e consulte o histórico."}
                    </p>
                </section>

                {ehMaster ? (
                    <>
                        <section className="mb-8">
                            <SecaoTitulo
                                titulo="Visão geral"
                                descricao="Indicadores atuais do sistema."
                            />
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                {indicadoresMaster.map((indicador) => (
                                    <CartaoIndicador key={indicador.titulo} indicador={indicador} />
                                ))}
                            </div>
                        </section>

                        <section className="mb-8">
                            <SecaoTitulo
                                titulo="Auditorias por situação"
                                descricao="Quantidade de auditorias na situação atual."
                                href={podeVerAuditorias ? "/auditorias" : undefined}
                                linkTexto="Abrir auditorias"
                            />
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                <CartaoIndicador indicador={{ titulo: "Aguardando análise", valor: totalAguardando, descricao: "Enviadas à supervisão", href: podeVerAuditorias ? "/auditorias" : undefined }} />
                                <CartaoIndicador indicador={{ titulo: "Em correção", valor: totalCorrecao, descricao: "Devolvidas para ajustes", href: podeVerAuditorias ? "/auditorias" : undefined }} />
                                <CartaoIndicador indicador={{ titulo: "Em andamento", valor: totalAbertas, descricao: "Auditorias ainda abertas", href: podeVerAuditorias ? "/auditorias" : undefined }} />
                            </div>
                        </section>

                        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                            <SecaoTitulo
                                titulo="Consumo da infraestrutura"
                                descricao="Área reservada para indicadores oficiais dos serviços."
                            />
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                {[
                                    { titulo: "Turso", descricao: "Uso do banco de dados e armazenamento" },
                                    { titulo: "Vercel", descricao: "Uso mensal e consumo do projeto" },
                                    { titulo: "Blob", descricao: "Armazenamento de evidências e arquivos" },
                                ].map((item) => (
                                    <div key={item.titulo} className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4">
                                        <p className="font-semibold text-[#12223f]">{item.titulo}</p>
                                        <p className="mt-2 text-sm text-slate-600">{item.descricao}</p>
                                        <p className="mt-3 text-xs font-semibold text-slate-500">Integração de métricas pendente</p>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-4 text-xs text-slate-500">
                                Os valores serão exibidos após integração com fontes oficiais; nenhum consumo é estimado nesta tela.
                            </p>
                        </section>
                    </>
                ) : null}

                {ehSupervisora ? (
                    <section className="mb-8">
                        <SecaoTitulo
                            titulo="Fila de supervisão"
                            descricao="Auditorias enviadas para análise ou devolvidas para correção."
                            href="/auditorias"
                            linkTexto="Ver todas"
                        />
                        <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <CartaoIndicador indicador={{ titulo: "Aguardando análise", valor: totalAguardando, descricao: "Auditorias enviadas", href: "/auditorias" }} />
                            <CartaoIndicador indicador={{ titulo: "Em correção", valor: totalCorrecao, descricao: "Auditorias que precisam de ajustes", href: "/auditorias" }} />
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                            <ListaAuditorias
                                auditorias={auditoriasRecentes}
                                vazio="Não há auditorias aguardando análise ou em correção."
                                textoAcao="Analisar"
                            />
                        </div>
                    </section>
                ) : null}

                {ehConsultor ? (
                    <>
                        <section className="mb-8">
                            <SecaoTitulo
                                titulo="Acesso rápido"
                                descricao="Atalhos para as tarefas mais frequentes."
                            />
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Link href="/auditorias/nova" className="rounded-2xl bg-[#22365b] p-6 text-white shadow-sm transition hover:opacity-95">
                                    <p className="text-lg font-bold">Iniciar auditoria</p>
                                    <p className="mt-2 text-sm text-white/80">Comece uma nova auditoria em uma loja autorizada.</p>
                                </Link>
                                <Link href="/auditorias" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                                    <p className="text-lg font-bold text-[#12223f]">Minhas auditorias</p>
                                    <p className="mt-2 text-sm text-slate-600">Continue uma auditoria ou consulte as anteriores.</p>
                                </Link>
                            </div>
                        </section>
                        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                            <SecaoTitulo
                                titulo="Minhas auditorias recentes"
                                descricao="Auditorias abertas, em correção e registros recentes."
                                href="/auditorias"
                                linkTexto="Ver histórico"
                            />
                            <ListaAuditorias
                                auditorias={auditoriasRecentes}
                                vazio="Nenhuma auditoria recente encontrada."
                                textoAcao="Abrir"
                            />
                        </section>
                    </>
                ) : null}

                {!ehMaster && !ehSupervisora && !ehConsultor ? (
                    <section className="rounded-2xl border border-red-200 bg-white p-6">
                        <h2 className="text-lg font-semibold text-[#c22a2e]">Perfil não reconhecido</h2>
                        <p className="mt-2 text-sm text-slate-600">
                            Não foi possível identificar um painel para este perfil. Entre em contato com o administrador.
                        </p>
                    </section>
                ) : null}
            </div>
        </main>
    );
}
