"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type UsuarioAtual = {
    id: string;
    nome: string;
    perfil: string;
};

type NovaAuditoriaFormProps = {
    usuario: UsuarioAtual;
};
type Cliente = {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
};

type Loja = {
    id: string;
    nome: string;
    cliente_id: string;
    ativo: number;
};

type Setor = {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: number;
    associado: boolean;
};

type Checklist = {
    id: string;
    nome: string;
    descricao: string | null;
    ativo: number;
    setor_id: string;
};

type VersaoChecklist = {
    id: string;
    numero: number;
    descricao: string | null;
    publicada: boolean;
};

type ChecklistDoSetor = {
    setorId: string;
    checklist: Checklist | null;
    versoes: VersaoChecklist[];
};

export default function NovaAuditoriaForm({
    usuario,
}: NovaAuditoriaFormProps) {
    const [clientes, setClientes] = useState<Cliente[]>([]);
    const [lojas, setLojas] = useState<Loja[]>([]);
    const [setores, setSetores] = useState<Setor[]>([]);

    const [clienteId, setClienteId] = useState("");
    const [lojaId, setLojaId] = useState("");
    const [setoresSelecionados, setSetoresSelecionados] = useState<string[]>(
        []
    );

    const [checklistsPorSetor, setChecklistsPorSetor] = useState<
        Record<string, ChecklistDoSetor>
    >({});

    const [versoesSelecionadas, setVersoesSelecionadas] = useState<
        Record<string, string>
    >({});

    const [carregandoChecklists, setCarregandoChecklists] = useState<
        Record<string, boolean>
    >({});

    const [carregandoClientes, setCarregandoClientes] = useState(true);
    const [carregandoLojas, setCarregandoLojas] = useState(false);
    const [carregandoSetores, setCarregandoSetores] = useState(false);
    const [auditores, setAuditores] = useState<
        { id: string; nome: string; perfil: string; ativo: number }[]
    >([]);
    const [auditorId, setAuditorId] = useState("");
    const [carregandoAuditores, setCarregandoAuditores] = useState(false);
    const [responsavelLojaNome, setResponsavelLojaNome] = useState("");

    const [erro, setErro] = useState("");

    useEffect(() => {
        async function carregarClientes() {
            try {
                setErro("");

                const response = await fetch("/api/clientes");
                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message || "Não foi possível carregar os clientes."
                    );
                }

                setClientes(data.clientes ?? []);
            } catch (error) {
                console.error(error);

                setErro(
                    error instanceof Error
                        ? error.message
                        : "Erro ao carregar clientes."
                );
            } finally {
                setCarregandoClientes(false);
            }
        }

        carregarClientes();
    }, []);
    useEffect(() => {
        async function carregarAuditores() {
            setAuditores([]);
            setAuditorId("");

            if (!lojaId) {
                if (usuario.perfil === "CONSULTOR") {
                    setAuditorId(usuario.id);
                }
                return;
            }

            if (usuario.perfil === "CONSULTOR") {
                setAuditorId(usuario.id);
                return;
            }

            try {
                setCarregandoAuditores(true);
                setErro("");

                const response = await fetch(
                    `/api/auditorias/auditores?loja_id=${encodeURIComponent(
                        lojaId
                    )}`
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message ||
                        "Não foi possível carregar os auditores."
                    );
                }

                setAuditores(data.auditores ?? []);
            } catch (error) {
                console.error(error);

                setErro(
                    error instanceof Error
                        ? error.message
                        : "Erro ao carregar auditores."
                );
            } finally {
                setCarregandoAuditores(false);
            }
        }

        carregarAuditores();
    }, [lojaId, usuario.id, usuario.perfil]);

    async function handleClienteChange(
        event: React.ChangeEvent<HTMLSelectElement>
    ) {
        const novoClienteId = event.target.value;

        setClienteId(novoClienteId);
        setLojaId("");
        setLojas([]);
        setSetores([]);
        setSetoresSelecionados([]);
        setChecklistsPorSetor({});
        setCarregandoChecklists({});

        if (!novoClienteId) {
            return;
        }

        try {
            setErro("");
            setCarregandoLojas(true);

            const response = await fetch(
                `/api/lojas?cliente_id=${encodeURIComponent(
                    novoClienteId
                )}`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Não foi possível carregar as lojas."
                );
            }

            setLojas(data.lojas ?? []);
        } catch (error) {
            console.error(error);

            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao carregar lojas."
            );
        } finally {
            setCarregandoLojas(false);
        }
    }

    async function handleLojaChange(
        event: React.ChangeEvent<HTMLSelectElement>
    ) {
        const novaLojaId = event.target.value;

        setLojaId(novaLojaId);
        setSetores([]);
        setSetoresSelecionados([]);
        setAuditores([]);
        setAuditorId("");

        if (!novaLojaId) {
            return;
        }

        try {
            setErro("");
            setCarregandoSetores(true);

            const response = await fetch(
                `/api/lojas/${encodeURIComponent(novaLojaId)}/setores`
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Não foi possível carregar os setores da loja."
                );
            }

            const setoresDisponiveis = (data.setores ?? []).filter(
                (setor: Setor) =>
                    Number(setor.ativo) === 1 &&
                    (setor.associado === true || Number(setor.associado) === 1)
            );

            setSetores(setoresDisponiveis);
        } catch (error) {
            console.error(error);

            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao carregar setores."
            );
        } finally {
            setCarregandoSetores(false);
        }
    }

    async function alternarSetor(setorId: string) {
        const jaSelecionado = setoresSelecionados.includes(setorId);

        if (jaSelecionado) {
            setSetoresSelecionados((atual) =>
                atual.filter((id) => id !== setorId)
            );

            setChecklistsPorSetor((atual) => {
                const novo = { ...atual };
                delete novo[setorId];
                return novo;
            });

            setVersoesSelecionadas((atual) => {
                const novo = { ...atual };
                delete novo[setorId];
                return novo;
            });

            return;
        }

        setSetoresSelecionados((atual) => [...atual, setorId]);

        try {
            setErro("");

            setCarregandoChecklists((atual) => ({
                ...atual,
                [setorId]: true,
            }));

            const checklistsResponse = await fetch("/api/checklists");
            const checklistsData = await checklistsResponse.json();

            if (!checklistsResponse.ok || !checklistsData.success) {
                throw new Error(
                    checklistsData.message ||
                    "Não foi possível carregar os checklists."
                );
            }

            const checklistsDoSetor = (checklistsData.checklists ?? []).filter(
                (checklist: Checklist) =>
                    checklist.setor_id === setorId &&
                    Number(checklist.ativo) === 1
            );

            if (checklistsDoSetor.length === 0) {
                setChecklistsPorSetor((atual) => ({
                    ...atual,
                    [setorId]: {
                        setorId,
                        checklist: null,
                        versoes: [],
                    },
                }));

                return;
            }

            // Regra atual: um setor possui um checklist para a auditoria.
            const checklist = checklistsDoSetor[0];

            const versoesResponse = await fetch(
                `/api/checklists/${encodeURIComponent(
                    checklist.id
                )}/versoes`
            );

            const versoesData = await versoesResponse.json();

            if (!versoesResponse.ok || !versoesData.success) {
                throw new Error(
                    versoesData.message ||
                    "Não foi possível carregar as versões do checklist."
                );
            }

            const versoesPublicadas = (versoesData.versoes ?? []).filter(
                (versao: VersaoChecklist) => versao.publicada === true
            );

            setChecklistsPorSetor((atual) => ({
                ...atual,
                [setorId]: {
                    setorId,
                    checklist,
                    versoes: versoesPublicadas,
                },
            }));
        } catch (error) {
            console.error(error);

            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao carregar checklist."
            );
        } finally {
            setCarregandoChecklists((atual) => ({
                ...atual,
                [setorId]: false,
            }));
        }
    }
    async function criarAuditoria() {
        try {
            setErro("");

            if (!lojaId) {
                setErro("Selecione uma loja.");
                return;
            }

            if (!auditorId) {
                setErro("Selecione o auditor.");
                return;
            }

            if (!responsavelLojaNome.trim()) {
                setErro("Informe o responsável / gerente da loja.");
                return;
            }

            if (setoresSelecionados.length === 0) {
                setErro("Selecione pelo menos um setor.");
                return;
            }

            const setoresPayload = [];

            for (const setorId of setoresSelecionados) {
                const checklistDoSetor = checklistsPorSetor[setorId];

                if (!checklistDoSetor?.checklist) {
                    setErro(
                        "Todos os setores selecionados precisam possuir um checklist."
                    );
                    return;
                }

                const checklistVersaoId = versoesSelecionadas[setorId];

                if (!checklistVersaoId) {
                    const setor = setores.find((item) => item.id === setorId);

                    setErro(
                        `Selecione a versão do checklist para o setor ${setor?.nome ?? setorId
                        }.`
                    );

                    return;
                }

                setoresPayload.push({
                    setorId,
                    checklistVersaoId,
                });
            }

            const response = await fetch("/api/auditorias", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    lojaId,
                    auditorId,
                    gerenteLojaNome: responsavelLojaNome.trim(),
                    setores: setoresPayload,
                }),
            });

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message || "Não foi possível criar a auditoria."
                );
            }

            window.location.href = "/auditorias";
        } catch (error) {
            console.error(error);

            setErro(
                error instanceof Error
                    ? error.message
                    : "Erro ao criar auditoria."
            );
        }
    }
    return (
        <main className="min-h-screen bg-gray-50 p-8">
            <div className="mx-auto max-w-5xl">
                <div className="mb-8">
                    <div className="mb-4">
                        <Link
                            href="/auditorias"
                            className="text-sm font-medium text-gray-500 hover:text-gray-700"
                        >
                            ← Voltar para Auditorias
                        </Link>
                    </div>

                    <h1
                        className="text-3xl font-bold"
                        style={{ color: "#12223f" }}
                    >
                        Nova Auditoria
                    </h1>

                    <div
                        className="mt-2 h-1 w-16 rounded"
                        style={{ backgroundColor: "#c22a2e" }}
                    />

                    <p className="mt-3 text-gray-600">
                        Preencha os dados para iniciar uma nova auditoria.
                    </p>
                </div>

                {erro && (
                    <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {erro}
                    </div>
                )}

                <div className="space-y-6">
                    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold text-gray-800">
                                1. Estabelecimento
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Selecione o cliente e a loja onde a auditoria
                                será realizada.
                            </p>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="cliente"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Cliente
                                </label>

                                <select
                                    id="cliente"
                                    value={clienteId}
                                    onChange={handleClienteChange}
                                    disabled={carregandoClientes}
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 outline-none focus:border-[#c22a2e] focus:ring-1 focus:ring-[#c22a2e]"
                                >
                                    <option value="">
                                        {carregandoClientes
                                            ? "Carregando clientes..."
                                            : "Selecione o cliente"}
                                    </option>

                                    {clientes.map((cliente) => (
                                        <option
                                            key={cliente.id}
                                            value={cliente.id}
                                        >
                                            {cliente.nome_fantasia ||
                                                cliente.razao_social}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label
                                    htmlFor="loja"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Loja
                                </label>

                                <select
                                    id="loja"
                                    value={lojaId}
                                    onChange={handleLojaChange}
                                    disabled={
                                        !clienteId ||
                                        carregandoLojas ||
                                        lojas.length === 0
                                    }
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 outline-none focus:border-[#c22a2e] focus:ring-1 focus:ring-[#c22a2e] disabled:bg-gray-100 disabled:text-gray-500"
                                >
                                    <option value="">
                                        {!clienteId
                                            ? "Selecione primeiro o cliente"
                                            : carregandoLojas
                                                ? "Carregando lojas..."
                                                : lojas.length === 0
                                                    ? "Nenhuma loja disponível"
                                                    : "Selecione a loja"}
                                    </option>

                                    {lojas.map((loja) => (
                                        <option
                                            key={loja.id}
                                            value={loja.id}
                                        >
                                            {loja.nome}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold text-gray-800">
                                2. Responsáveis
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Informe os responsáveis pela auditoria.
                            </p>
                        </div>

                        <div className="grid gap-5 md:grid-cols-2">
                            <div>
                                <label
                                    htmlFor="auditor"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Auditor
                                </label>

                                <select
                                    id="auditor"
                                    value={auditorId}
                                    onChange={(event) => setAuditorId(event.target.value)}
                                    disabled={
                                        usuario.perfil === "CONSULTOR" ||
                                        carregandoAuditores
                                    }
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 outline-none focus:border-[#c22a2e] focus:ring-1 focus:ring-[#c22a2e] disabled:bg-gray-100 disabled:text-gray-500"
                                >
                                    {usuario.perfil === "CONSULTOR" ? (
                                        <option value={usuario.id}>
                                            {usuario.nome}
                                        </option>
                                    ) : (
                                        <>
                                            <option value="">
                                                {carregandoAuditores
                                                    ? "Carregando auditores..."
                                                    : "Selecione o auditor"}
                                            </option>

                                            {auditores.map((auditor) => (
                                                <option key={auditor.id} value={auditor.id}>
                                                    {auditor.nome} — {auditor.perfil}
                                                </option>
                                            ))}
                                        </>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label
                                    htmlFor="responsavel-loja"
                                    className="mb-2 block text-sm font-medium text-gray-700"
                                >
                                    Responsável / Gerente da Loja
                                </label>

                                <input
                                    id="responsavel-loja"
                                    type="text"
                                    value={responsavelLojaNome}
                                    onChange={(event) =>
                                        setResponsavelLojaNome(event.target.value)
                                    }
                                    placeholder="Nome do responsável ou gerente da loja"
                                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-700 outline-none focus:border-[#c22a2e] focus:ring-1 focus:ring-[#c22a2e]"
                                />
                            </div>
                        </div>
                    </section>

                    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                        <div className="mb-5">
                            <h2 className="text-lg font-semibold text-gray-800">
                                3. Setores e Checklists
                            </h2>

                            <p className="mt-1 text-sm text-gray-500">
                                Selecione os setores que farão parte desta
                                auditoria.
                            </p>
                        </div>

                        {!lojaId && (
                            <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
                                <p className="text-sm text-gray-500">
                                    Selecione uma loja para carregar os
                                    setores.
                                </p>
                            </div>
                        )}

                        {lojaId && carregandoSetores && (
                            <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                                <p className="text-sm text-gray-500">
                                    Carregando setores...
                                </p>
                            </div>
                        )}

                        {lojaId &&
                            !carregandoSetores &&
                            setores.length === 0 && (
                                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
                                    <p className="text-sm text-yellow-800">
                                        Esta loja não possui setores
                                        configurados para auditoria.
                                    </p>
                                </div>
                            )}

                        {lojaId &&
                            !carregandoSetores &&
                            setores.length > 0 && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    {setores.map((setor) => {
                                        const selecionado =
                                            setoresSelecionados.includes(
                                                setor.id
                                            );

                                        return (
                                            <div key={setor.id}>
                                                <button
                                                    type="button"
                                                    onClick={() => alternarSetor(setor.id)}
                                                    className={`w-full min-h-[70px] rounded-lg border p-4 text-left transition ${selecionado
                                                        ? "border-[#c22a2e] bg-red-50"
                                                        : "border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50"
                                                        }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div
                                                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border ${selecionado
                                                                ? "border-[#c22a2e] bg-[#c22a2e] text-white"
                                                                : "border-gray-300 bg-white"
                                                                }`}
                                                        >
                                                            {selecionado && (
                                                                <span className="text-xs font-bold">
                                                                    ✓
                                                                </span>
                                                            )}
                                                        </div>

                                                        <div>
                                                            <div className="font-semibold text-gray-800">
                                                                {setor.nome}
                                                            </div>

                                                            {setor.descricao && (
                                                                <div className="mt-1 text-sm text-gray-500">
                                                                    {setor.descricao}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </button>

                                                {selecionado && (
                                                    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4">
                                                        {carregandoChecklists[setor.id] && (
                                                            <p className="text-sm text-gray-500">
                                                                Carregando checklist...
                                                            </p>
                                                        )}

                                                        {!carregandoChecklists[setor.id] &&
                                                            !checklistsPorSetor[setor.id]?.checklist && (
                                                                <p className="text-sm text-yellow-700">
                                                                    Este setor não possui checklist cadastrado.
                                                                </p>
                                                            )}

                                                        {!carregandoChecklists[setor.id] &&
                                                            checklistsPorSetor[setor.id]?.checklist &&
                                                            checklistsPorSetor[setor.id]?.versoes.length === 0 && (
                                                                <p className="text-sm text-yellow-700">
                                                                    Este checklist não possui versões publicadas.
                                                                </p>
                                                            )}

                                                        {!carregandoChecklists[setor.id] &&
                                                            checklistsPorSetor[setor.id]?.checklist &&
                                                            checklistsPorSetor[setor.id]?.versoes.length > 0 && (
                                                                <div>
                                                                    <div className="mb-2 text-sm font-semibold text-gray-700">
                                                                        {
                                                                            checklistsPorSetor[setor.id]?.checklist
                                                                                ?.nome
                                                                        }
                                                                    </div>

                                                                    <select
                                                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                                                                        value={versoesSelecionadas[setor.id] ?? ""}
                                                                        onChange={(event) =>
                                                                            setVersoesSelecionadas((atual) => ({
                                                                                ...atual,
                                                                                [setor.id]: event.target.value,
                                                                            }))
                                                                        }
                                                                    >
                                                                        <option value="">
                                                                            Selecione a versão
                                                                        </option>

                                                                        {checklistsPorSetor[
                                                                            setor.id
                                                                        ]?.versoes.map((versao) => (
                                                                            <option
                                                                                key={versao.id}
                                                                                value={versao.id}
                                                                            >
                                                                                Versão {versao.numero}
                                                                                {versao.descricao
                                                                                    ? ` — ${versao.descricao}`
                                                                                    : ""}
                                                                            </option>
                                                                        ))}
                                                                    </select>
                                                                </div>
                                                            )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                        {setoresSelecionados.length > 0 && (
                            <div className="mt-4 text-sm text-gray-600">
                                {setoresSelecionados.length}{" "}
                                {setoresSelecionados.length === 1
                                    ? "setor selecionado"
                                    : "setores selecionados"}
                            </div>
                        )}
                    </section>

                    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                        <Link
                            href="/auditorias"
                            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 font-medium text-gray-700 hover:bg-gray-50"
                        >
                            Cancelar
                        </Link>

                        <button
                            type="button"
                            onClick={criarAuditoria}
                            className="inline-flex min-h-[44px] items-center justify-center rounded-lg bg-[#c22a2e] px-5 py-3 font-semibold text-white hover:bg-[#a92327]"
                        >
                            Criar Auditoria
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}