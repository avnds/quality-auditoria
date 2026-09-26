"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

type Item = {
    id: string;
    texto: string;
    orientacao: string | null;
    ordem: number;
    ativo: boolean;
};

type Secao = {
    id: string;
    nome: string;
    descricao: string | null;
    ordem: number;
    itens: Item[];
};

type Setor = {
    auditoria_setor_id: string;
    setor_id: string;
    setor_nome: string;
    checklist_versao_id: string;
    checklist_versao_numero: number;
    checklist_id: string;
    checklist_nome: string;
    ordem: number;
    secoes: Secao[];
};

type Auditoria = {
    id: string;
    loja_id: string;
    loja_nome: string;
    cliente_nome: string;
    auditor_id: string;
    auditor_nome: string;
    auditor_perfil: string;
    encarregado_nome: string | null;
    gerente_setor_nome: string | null;
    gerente_loja_nome: string | null;
    criada_em: string;
    versao: {
        id: string;
        numero: number;
        status: string;
        criada_em: string;
    };
    setores: Setor[];
};

export default function ExecucaoAuditoriaPage() {
    const params = useParams();
    const id = String(params.id);

    const [auditoria, setAuditoria] = useState<Auditoria | null>(null);
    const [carregando, setCarregando] = useState(true);
    const [erro, setErro] = useState("");

    useEffect(() => {
        async function carregarAuditoria() {
            try {
                setCarregando(true);
                setErro("");

                const response = await fetch(`/api/auditorias/${id}`);

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message ||
                            "Não foi possível carregar a auditoria."
                    );
                }

                setAuditoria(data.auditoria);
            } catch (error) {
                console.error(error);

                setErro(
                    error instanceof Error
                        ? error.message
                        : "Não foi possível carregar a auditoria."
                );
            } finally {
                setCarregando(false);
            }
        }

        if (id) {
            carregarAuditoria();
        }
    }, [id]);

    if (carregando) {
        return (
            <main className="min-h-screen bg-gray-50 p-6">
                <div className="mx-auto max-w-7xl">
                    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                        <p className="text-gray-600">
                            Carregando auditoria...
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    if (erro || !auditoria) {
        return (
            <main className="min-h-screen bg-gray-50 p-6">
                <div className="mx-auto max-w-7xl">
                    <Link
                        href="/auditorias"
                        className="mb-6 inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                        ← Voltar para auditorias
                    </Link>

                    <div className="rounded-xl border border-red-200 bg-white p-8 text-center shadow-sm">
                        <h1 className="text-lg font-semibold text-red-700">
                            Não foi possível carregar a auditoria
                        </h1>

                        <p className="mt-2 text-sm text-gray-600">
                            {erro || "Auditoria não encontrada."}
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="mx-auto max-w-7xl">
                <div className="mb-6">
                    <Link
                        href="/auditorias"
                        className="inline-flex min-h-[44px] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                        ← Voltar para auditorias
                    </Link>
                </div>

                <div className="mb-8">
                    <h1
                        className="text-3xl font-bold"
                        style={{ color: "#12223f" }}
                    >
                        Execução da Auditoria
                    </h1>

                    <div
                        className="mt-2 h-1 w-16 rounded"
                        style={{ backgroundColor: "#c22a2e" }}
                    />

                    <p className="mt-3 text-gray-600">
                        Visualização dos setores e itens desta auditoria.
                    </p>
                </div>

                {/* DADOS DA AUDITORIA */}
                <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                    <div className="mb-5">
                        <h2 className="text-xl font-bold text-gray-800">
                            Dados da Auditoria
                        </h2>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Cliente
                            </p>
                            <p className="mt-1 font-semibold text-gray-800">
                                {auditoria.cliente_nome}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Loja
                            </p>
                            <p className="mt-1 font-semibold text-gray-800">
                                {auditoria.loja_nome}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Auditor
                            </p>
                            <p className="mt-1 font-semibold text-gray-800">
                                {auditoria.auditor_nome}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Gerente da Loja
                            </p>
                            <p className="mt-1 font-semibold text-gray-800">
                                {auditoria.gerente_loja_nome || "—"}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Encarregado do Setor
                            </p>
                            <p className="mt-1 font-semibold text-gray-800">
                                {auditoria.encarregado_nome || "—"}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Gerente do Setor
                            </p>
                            <p className="mt-1 font-semibold text-gray-800">
                                {auditoria.gerente_setor_nome || "—"}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Versão da Auditoria
                            </p>
                            <p className="mt-1 font-semibold text-gray-800">
                                {auditoria.versao.numero}
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Status
                            </p>
                            <span className="mt-1 inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-700">
                                {auditoria.versao.status}
                            </span>
                        </div>
                    </div>
                </section>

                {/* SETORES */}
                <div className="space-y-8">
                    {auditoria.setores.length === 0 ? (
                        <section className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                            <p className="text-gray-600">
                                Nenhum setor foi associado a esta auditoria.
                            </p>
                        </section>
                    ) : (
                        auditoria.setores.map((setor) => (
                            <section
                                key={setor.auditoria_setor_id}
                                className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                            >
                                {/* CABEÇALHO DO SETOR */}
                                <div
                                    className="border-b border-gray-200 px-6 py-5"
                                    style={{
                                        backgroundColor: "#f8fafc",
                                    }}
                                >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-gray-500">
                                                Setor {setor.ordem}
                                            </p>

                                            <h2 className="text-2xl font-bold text-gray-800">
                                                {setor.setor_nome}
                                            </h2>
                                        </div>

                                        <div className="text-left sm:text-right">
                                            <p className="text-sm text-gray-500">
                                                Checklist
                                            </p>

                                            <p className="font-semibold text-gray-800">
                                                {setor.checklist_nome}
                                            </p>

                                            <p className="text-sm text-gray-500">
                                                Versão{" "}
                                                {
                                                    setor.checklist_versao_numero
                                                }
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* SEÇÕES */}
                                <div className="divide-y divide-gray-200">
                                    {setor.secoes.length === 0 ? (
                                        <div className="p-6">
                                            <p className="text-gray-500">
                                                Este checklist não possui
                                                seções.
                                            </p>
                                        </div>
                                    ) : (
                                        setor.secoes.map((secao) => (
                                            <div
                                                key={secao.id}
                                                className="p-6"
                                            >
                                                <div className="mb-5">
                                                    <h3 className="text-lg font-bold text-gray-800">
                                                        {secao.nome}
                                                    </h3>

                                                    {secao.descricao && (
                                                        <p className="mt-1 text-sm text-gray-500">
                                                            {secao.descricao}
                                                        </p>
                                                    )}
                                                </div>

                                                {/* ITENS */}
                                                <div className="space-y-3">
                                                    {secao.itens.length ===
                                                    0 ? (
                                                        <p className="text-sm text-gray-500">
                                                            Nenhum item
                                                            cadastrado nesta
                                                            seção.
                                                        </p>
                                                    ) : (
                                                        secao.itens.map(
                                                            (item) => (
                                                                <div
                                                                    key={
                                                                        item.id
                                                                    }
                                                                    className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                                                                >
                                                                    <div className="flex gap-3">
                                                                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-700">
                                                                            {
                                                                                item.ordem
                                                                            }
                                                                        </div>

                                                                        <div className="min-w-0">
                                                                            <p className="font-medium leading-relaxed text-gray-800">
                                                                                {
                                                                                    item.texto
                                                                                }
                                                                            </p>

                                                                            {item.orientacao && (
                                                                                <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-3">
                                                                                    <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                                                                        Orientação
                                                                                    </p>

                                                                                    <p className="mt-1 text-sm text-blue-900">
                                                                                        {
                                                                                            item.orientacao
                                                                                        }
                                                                                    </p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )
                                                        )
                                                    )}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </section>
                        ))
                    )}
                </div>
            </div>
        </main>
    );
}