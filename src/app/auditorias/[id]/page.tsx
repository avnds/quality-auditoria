
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";


type Resultado =
    | "CONFORME"
    | "PARCIALMENTE_CONFORME"
    | "NAO_CONFORME"
    | "NAO_APLICAVEL";

type Evidencia = {
    id: string;
    ordem: number;
    versao?: number;
};

type Item = {
    id: string;
    texto: string;
    orientacao: string | null;
    ordem: number;
    ativo: boolean;
    resposta: {
        id: string;
        resultado: Resultado | null;
        observacao: string | null;
        respondido_em: string | null;
        evidencias: Evidencia[];
    } | null;
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
    usuario_perfil: string;
    encarregado_nome: string | null;
    gerente_setor_nome: string | null;
    gerente_loja_nome: string | null;
    criada_em: string;
    versao: {
        id: string;
        numero: number;
        status: string;
        criada_em: string;
        motivo_devolucao: string | null;
    };
    setores: Setor[];
};

export default function ExecucaoAuditoriaPage() {
    const params = useParams();
    const id = String(params.id);

    const [auditoria, setAuditoria] =
        useState<Auditoria | null>(null);

    const [carregando, setCarregando] =
        useState(true);

    const [erro, setErro] = useState("");

    const [respostas, setRespostas] = useState<
        Record<string, Resultado>
    >({});

    const [respostaIds, setRespostaIds] = useState<
        Record<string, string>
    >({});

    const [setoresAbertos, setSetoresAbertos] = useState<
        Record<string, boolean>
    >({});

    const [observacoes, setObservacoes] = useState<
        Record<string, string>
    >({});

    const [salvando, setSalvando] = useState<
        Record<string, boolean>
    >({});

    const [erroResposta, setErroResposta] = useState<
        Record<string, string>
    >({});

    const [evidenciaAberta, setEvidenciaAberta] =
        useState<Evidencia | null>(null);

    const timersObservacao = useRef<
        Record<string, ReturnType<typeof setTimeout>>
    >({});



    useEffect(() => {
        async function carregarAuditoria() {
            try {
                setCarregando(true);
                setErro("");

                const response = await fetch(
                    `/api/auditorias/${id}`
                );

                const data = await response.json();

                if (!response.ok || !data.success) {
                    throw new Error(
                        data.message ||
                        "Não foi possível carregar a auditoria."
                    );
                }

                const auditoriaCarregada: Auditoria =
                    data.auditoria;

                setAuditoria(auditoriaCarregada);

                const respostasSalvas: Record<
                    string,
                    Resultado
                > = {};

                const observacoesSalvas: Record<
                    string,
                    string
                > = {};
                const respostaIdsSalvas: Record<
                    string,
                    string
                > = {};

                auditoriaCarregada.setores.forEach(
                    (setor) => {
                        setor.secoes.forEach(
                            (secao) => {
                                secao.itens.forEach(
                                    (item) => {

                                        if (item.resposta?.id) {
                                            respostaIdsSalvas[item.id] =
                                                item.resposta.id;
                                        }
                                        const resultadoSalvo =
                                            item.resposta
                                                ?.resultado;

                                        if (
                                            resultadoSalvo ===
                                            "CONFORME" ||
                                            resultadoSalvo ===
                                            "PARCIALMENTE_CONFORME" ||
                                            resultadoSalvo ===
                                            "NAO_CONFORME" ||
                                            resultadoSalvo ===
                                            "NAO_APLICAVEL"
                                        ) {
                                            respostasSalvas[
                                                item.id
                                            ] =
                                                resultadoSalvo;
                                        }

                                        if (
                                            item.resposta
                                                ?.observacao
                                        ) {
                                            observacoesSalvas[
                                                item.id
                                            ] =
                                                item.resposta.observacao;
                                        }
                                    }
                                );
                            }
                        );
                    }
                );

                setRespostas(respostasSalvas);
                setObservacoes(
                    observacoesSalvas
                );
                setRespostaIds(respostaIdsSalvas);
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

    async function salvarResposta(
        auditoriaSetorId: string,
        itemId: string,
        resultado: Resultado,
        observacao: string
    ) {
        setSalvando((estadoAtual) => ({
            ...estadoAtual,
            [itemId]: true,
        }));

        setErroResposta((estadoAtual) => ({
            ...estadoAtual,
            [itemId]: "",
        }));

        try {
            const response = await fetch(
                `/api/auditorias/${id}/respostas`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        auditoriaSetorId,
                        checklistItemId: itemId,
                        resultado,
                        observacao,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
                throw new Error(
                    data.message ||
                    "Não foi possível salvar a resposta."
                );
            }
            if (data.resposta?.id) {
                setRespostaIds((estadoAtual) => ({
                    ...estadoAtual,
                    [itemId]: String(data.resposta.id),
                }));
            }

            setAuditoria((auditoriaAtual) => {
                if (!auditoriaAtual) {
                    return auditoriaAtual;
                }

                return {
                    ...auditoriaAtual,
                    setores: auditoriaAtual.setores.map((setor) => ({
                        ...setor,
                        secoes: setor.secoes.map((secao) => ({
                            ...secao,
                            itens: secao.itens.map((item) => {
                                if (item.id !== itemId) {
                                    return item;
                                }

                                return {
                                    ...item,
                                    resposta: {
                                        id: String(data.resposta.id),
                                        resultado,
                                        observacao: observacao || null,
                                        respondido_em:
                                            item.resposta?.respondido_em ?? null,
                                        evidencias:
                                            item.resposta?.evidencias ?? [],
                                    },
                                };
                            }),
                        })),
                    })),
                };
            });

            setRespostas((estadoAtual) => ({
                ...estadoAtual,
                [itemId]: resultado,
            }));

            setObservacoes((estadoAtual) => ({
                ...estadoAtual,
                [itemId]: observacao,
            }));
        } catch (error) {
            console.error(
                "Erro ao salvar resposta:",
                error
            );

            setErroResposta((estadoAtual) => ({
                ...estadoAtual,
                [itemId]:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível salvar a resposta.",
            }));
        } finally {
            setSalvando((estadoAtual) => ({
                ...estadoAtual,
                [itemId]: false,
            }));
        }
    }


    async function adicionarEvidencia(
        itemId: string
    ) {
        const respostaId = respostaIds[itemId];

        if (!respostaId) {
            setErroResposta((estadoAtual) => ({
                ...estadoAtual,
                [itemId]:
                    "Salve a resposta antes de adicionar uma foto.",
            }));
            return;
        }

        const resultado = respostas[itemId];

        if (
            resultado !== "NAO_CONFORME" &&
            resultado !== "PARCIALMENTE_CONFORME"
        ) {
            return;
        }

        const input = document.createElement("input");

        input.type = "file";
        input.accept =
            "image/jpeg,image/png,image/webp";
        input.capture = "environment";

        input.onchange = async () => {
            const arquivo = input.files?.[0];

            if (!arquivo) {
                return;
            }

            if (arquivo.size > 10 * 1024 * 1024) {
                setErroResposta((estadoAtual) => ({
                    ...estadoAtual,
                    [itemId]:
                        "A imagem deve ter no máximo 10 MB.",
                }));
                return;
            }

            try {
                setErroResposta((estadoAtual) => ({
                    ...estadoAtual,
                    [itemId]: "",
                }));

                const formData = new FormData();

                formData.append(
                    "respostaId",
                    respostaId
                );

                formData.append(
                    "arquivo",
                    arquivo
                );

                const response = await fetch(
                    `/api/auditorias/${id}/evidencias`,
                    {
                        method: "POST",
                        body: formData,
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ??
                        "Não foi possível salvar a foto."
                    );
                }

                const evidenciaSalva: Evidencia = {
                    id: String(data.evidencia.id),
                    ordem: Number(data.evidencia.ordem),
                };

                setAuditoria((auditoriaAtual) => {
                    if (!auditoriaAtual) {
                        return auditoriaAtual;
                    }

                    return {
                        ...auditoriaAtual,
                        setores: auditoriaAtual.setores.map(
                            (setor) => ({
                                ...setor,
                                secoes: setor.secoes.map(
                                    (secao) => ({
                                        ...secao,
                                        itens: secao.itens.map(
                                            (item) => {
                                                if (
                                                    item.id !==
                                                    itemId
                                                ) {
                                                    return item;
                                                }

                                                if (
                                                    !item.resposta
                                                ) {
                                                    return item;
                                                }

                                                return {
                                                    ...item,
                                                    resposta: {
                                                        ...item.resposta,
                                                        evidencias: [
                                                            ...item.resposta
                                                                .evidencias,
                                                            evidenciaSalva,
                                                        ],
                                                    },
                                                };
                                            }
                                        ),
                                    })
                                ),
                            })
                        ),
                    };
                });
            } catch (error) {
                console.error(
                    "Erro ao enviar evidência:",
                    error
                );

                setErroResposta((estadoAtual) => ({
                    ...estadoAtual,
                    [itemId]:
                        error instanceof Error
                            ? error.message
                            : "Não foi possível enviar a foto.",
                }));
            }
        };

        input.click();
    }

    const substituirEvidencia = async (
        evidencia: Evidencia,
        itemId: string
    ) => {
        const input =
            document.createElement("input");

        input.type = "file";
        input.accept =
            "image/jpeg,image/png,image/webp";
        input.capture = "environment";

        input.onchange = async () => {
            const arquivo = input.files?.[0];

            if (!arquivo) {
                return;
            }

            if (arquivo.size > 10 * 1024 * 1024) {
                alert(
                    "A imagem deve ter no máximo 10 MB."
                );
                return;
            }

            const formData = new FormData();

            formData.append(
                "evidenciaId",
                evidencia.id
            );

            formData.append(
                "arquivo",
                arquivo
            );

            try {
                const response = await fetch(
                    `/api/auditorias/${id}/evidencias`,
                    {
                        method: "PUT",
                        body: formData,
                    }
                );

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(
                        data.message ??
                        "Não foi possível substituir a foto."
                    );
                }

                const evidenciaAtualizada: Evidencia = {
                    id: String(data.evidencia.id),
                    ordem: Number(
                        data.evidencia.ordem
                    ),
                    versao: Date.now(),
                };

                setAuditoria(
                    (auditoriaAtual) => {
                        if (!auditoriaAtual) {
                            return auditoriaAtual;
                        }

                        return {
                            ...auditoriaAtual,
                            setores:
                                auditoriaAtual.setores.map(
                                    (setor) => ({
                                        ...setor,
                                        secoes:
                                            setor.secoes.map(
                                                (
                                                    secao
                                                ) => ({
                                                    ...secao,
                                                    itens:
                                                        secao.itens.map(
                                                            (
                                                                item
                                                            ) => {
                                                                if (
                                                                    item.id !==
                                                                    itemId
                                                                ) {
                                                                    return item;
                                                                }

                                                                if (
                                                                    !item.resposta
                                                                ) {
                                                                    return item;
                                                                }

                                                                return {
                                                                    ...item,
                                                                    resposta:
                                                                    {
                                                                        ...item.resposta,
                                                                        evidencias:
                                                                            item.resposta.evidencias.map(
                                                                                (
                                                                                    evidenciaAtual
                                                                                ) =>
                                                                                    evidenciaAtual.id ===
                                                                                        evidencia.id
                                                                                        ? evidenciaAtualizada
                                                                                        : evidenciaAtual
                                                                            ),
                                                                    },
                                                                };
                                                            }
                                                        ),
                                                })
                                            ),
                                    })
                                ),
                        };
                    }
                );

                setEvidenciaAberta(

                    (aberta) =>
                        aberta?.id === evidencia.id
                            ? evidenciaAtualizada
                            : aberta
                );
            } catch (error) {
                console.error(
                    "Erro ao substituir evidência:",
                    error
                );

                alert(
                    error instanceof Error
                        ? error.message
                        : "Não foi possível substituir a foto."
                );
            }
        };

        input.click();
    };
    async function enviarParaValidacao() {
        if (!auditoria) {
            return;
        }

        if (
            auditoria.versao.status !== "ABERTA" &&
            auditoria.versao.status !== "EM_CORRECAO"
        ) {
            return;
        }

        const estaEmCorrecao =
            auditoria.versao.status === "EM_CORRECAO";

        const confirmar = window.confirm(
            estaEmCorrecao
                ? "Deseja reenviar esta auditoria para validação?\n\nAs correções serão enviadas na mesma versão da auditoria."
                : "Deseja enviar esta auditoria para validação?\n\nDepois do envio, a auditoria não poderá mais ser editada nesta versão."
        );

        if (!confirmar) {
            return;
        }

        try {
            setErro("");

            const response = await fetch(
                `/api/auditorias/${id}/enviar-validacao`,
                {
                    method: "POST",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ??
                    "Não foi possível enviar a auditoria para validação."
                );
            }

            setAuditoria((auditoriaAtual) => {
                if (!auditoriaAtual) {
                    return auditoriaAtual;
                }

                return {
                    ...auditoriaAtual,
                    versao: {
                        ...auditoriaAtual.versao,
                        status: "ENVIADA",
                    },
                };
            });
        } catch (error) {
            console.error(
                "Erro ao enviar auditoria para validação:",
                error
            );

            setErro(
                error instanceof Error
                    ? error.message
                    : "Não foi possível enviar a auditoria para validação."
            );
        }
    }

    async function finalizarAuditoria() {
        if (!auditoria) return;

        if (
            auditoria.usuario_perfil !== "SUPERVISORA" ||
            auditoria.versao.status !== "ENVIADA"
        ) {
            return;
        }

        const confirmar = window.confirm(
            "Deseja finalizar esta auditoria?\n\nDepois da finalização, esta versão será encerrada."
        );

        if (!confirmar) return;

        try {
            setErro("");

            const response = await fetch(
                `/api/auditorias/${id}/finalizar`,
                {
                    method: "POST",
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ??
                    "Não foi possível finalizar a auditoria."
                );
            }

            setAuditoria((auditoriaAtual) => {
                if (!auditoriaAtual) return auditoriaAtual;

                return {
                    ...auditoriaAtual,
                    versao: {
                        ...auditoriaAtual.versao,
                        status: "FINALIZADA",
                    },
                };
            });
        } catch (error) {
            console.error(
                "Erro ao finalizar auditoria:",
                error
            );

            setErro(
                error instanceof Error
                    ? error.message
                    : "Não foi possível finalizar a auditoria."
            );
        }
    }

    async function devolverParaCorrecao() {
        if (
            !auditoria ||
            auditoria.usuario_perfil !== "SUPERVISORA" ||
            auditoria.versao.status !== "ENVIADA"
        ) {
            return;
        }

        const motivo = window.prompt(
            "Informe o motivo da devolução para correção:"
        );

        if (motivo === null) {
            return;
        }

        if (!motivo.trim()) {
            setErro("O motivo da devolução é obrigatório.");
            return;
        }

        if (motivo.trim().length > 2000) {
            setErro(
                "O motivo deve ter no máximo 2000 caracteres."
            );
            return;
        }

        const confirmar = window.confirm(
            "Deseja devolver esta auditoria para correção?\n\nA mesma versão será reaberta, preservando as respostas e evidências."
        );

        if (!confirmar) {
            return;
        }

        try {
            setErro("");

            const response = await fetch(
                `/api/auditorias/${id}/devolver`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        motivo: motivo.trim(),
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.message ??
                    "Não foi possível devolver a auditoria para correção."
                );
            }

            setAuditoria((auditoriaAtual) => {
                if (!auditoriaAtual) {
                    return auditoriaAtual;
                }

                return {
                    ...auditoriaAtual,
                    versao: {
                        ...auditoriaAtual.versao,
                        status: "EM_CORRECAO",
                        motivo_devolucao: motivo.trim(),
                    },
                };
            });
        } catch (error) {
            console.error(
                "Erro ao devolver auditoria para correção:",
                error
            );

            setErro(
                error instanceof Error
                    ? error.message
                    : "Não foi possível devolver a auditoria para correção."
            );
        }
    }
    function podeEditarAuditoria() {
        return (
            auditoria?.versao.status === "ABERTA" ||
            auditoria?.versao.status === "EM_CORRECAO"
        );
    }


    async function selecionarResultado(
        auditoriaSetorId: string,
        itemId: string,
        resultado: Resultado
    ) {
        setErroResposta((estadoAtual) => ({
            ...estadoAtual,
            [itemId]: "",
        }));

        const observacaoAtual =
            observacoes[itemId] ?? "";

        const exigeObservacao =
            resultado ===
            "PARCIALMENTE_CONFORME" ||
            resultado === "NAO_CONFORME";

        /*
         * Para resultados que exigem observação,
         * mantemos a observação atual.
         *
         * Para CONFORME e NÃO APLICÁVEL,
         * a observação deve ser apagada.
         */
        const observacaoParaSalvar =
            exigeObservacao
                ? observacaoAtual.trim()
                : "";

        /*
         * Não permite salvar PARCIALMENTE_CONFORME
         * ou NAO_CONFORME sem observação.
         */
        if (
            exigeObservacao &&
            !observacaoParaSalvar
        ) {
            setRespostas((estadoAtual) => ({
                ...estadoAtual,
                [itemId]: resultado,
            }));

            return;
        }

        /*
         * Atualiza a interface imediatamente.
         */
        setRespostas((estadoAtual) => ({
            ...estadoAtual,
            [itemId]: resultado,
        }));

        /*
         * Se mudou para CONFORME ou
         * NÃO APLICÁVEL, limpa também
         * a observação local.
         */
        setObservacoes((estadoAtual) => ({
            ...estadoAtual,
            [itemId]: observacaoParaSalvar,
        }));

        /*
         * Salva imediatamente no banco.
         */
        await salvarResposta(
            auditoriaSetorId,
            itemId,
            resultado,
            observacaoParaSalvar
        );
    }

    function alterarObservacao(
        auditoriaSetorId: string,
        itemId: string,
        observacao: string
    ) {
        if (!podeEditarAuditoria()) {
            return;
        }
        setObservacoes((estadoAtual) => ({
            ...estadoAtual,
            [itemId]: observacao,
        }));

        setErroResposta((estadoAtual) => ({
            ...estadoAtual,
            [itemId]: "",
        }));

        if (timersObservacao.current[itemId]) {
            clearTimeout(
                timersObservacao.current[itemId]
            );
        }

        const resultadoAtual =
            respostas[itemId];

        if (
            resultadoAtual !==
            "PARCIALMENTE_CONFORME" &&
            resultadoAtual !== "NAO_CONFORME"
        ) {
            return;
        }

        /*
         * Não tenta salvar observação vazia,
         * pois ela é obrigatória.
         */
        if (!observacao.trim()) {
            return;
        }

        /*
         * Salva automaticamente após
         * 5 segundos sem nova alteração.
         */
        timersObservacao.current[itemId] =
            setTimeout(() => {
                salvarResposta(
                    auditoriaSetorId,
                    itemId,
                    resultadoAtual,
                    observacao.trim()
                );
            }, 5000);
    }

    async function salvarObservacaoAoSair(
        auditoriaSetorId: string,
        itemId: string
    ) {
        if (!podeEditarAuditoria()) {
            return;
        }
        const resultadoAtual = respostas[itemId];
        const observacaoAtual = observacoes[itemId] ?? "";

        if (
            resultadoAtual !==
            "PARCIALMENTE_CONFORME" &&
            resultadoAtual !== "NAO_CONFORME"
        ) {
            return;
        }

        if (!observacaoAtual.trim()) {
            return;
        }

        if (timersObservacao.current[itemId]) {
            clearTimeout(
                timersObservacao.current[itemId]
            );
            delete timersObservacao.current[itemId];
        }

        await salvarResposta(
            auditoriaSetorId,
            itemId,
            resultadoAtual,
            observacaoAtual.trim()
        );
    }

    useEffect(() => {
        return () => {
            Object.values(
                timersObservacao.current
            ).forEach((timer) => {
                clearTimeout(timer);
            });
        };
    }, []);

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
                            {erro ||
                                "Auditoria não encontrada."}
                        </p>
                    </div>
                </div>
            </main>
        );
    }

    function alternarSetor(setorId: string) {
        setSetoresAbertos((estadoAtual) => ({
            ...estadoAtual,
            [setorId]: !estadoAtual[setorId],
        }));
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
                        style={{
                            backgroundColor:
                                "#c22a2e",
                        }}
                    />

                    <p className="mt-3 text-gray-600">
                        Avalie cada item do checklist
                        durante a execução da auditoria.
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
                                {
                                    auditoria.cliente_nome
                                }
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
                                {
                                    auditoria.auditor_nome
                                }
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Gerente da Loja
                            </p>

                            <p className="mt-1 font-semibold text-gray-800">
                                {
                                    auditoria.gerente_loja_nome ||
                                    "—"
                                }
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Encarregado do Setor
                            </p>

                            <p className="mt-1 font-semibold text-gray-800">
                                {
                                    auditoria.encarregado_nome ||
                                    "—"
                                }
                            </p>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-gray-500">
                                Gerente do Setor
                            </p>

                            <p className="mt-1 font-semibold text-gray-800">
                                {
                                    auditoria.gerente_setor_nome ||
                                    "—"
                                }
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
                                {
                                    auditoria.versao.status
                                }
                            </span>
                        </div>
                    </div>
                </section>
                {auditoria.versao.status === "EM_CORRECAO" && (
                    <section className="mb-8 rounded-xl border border-amber-300 bg-amber-50 p-5">
                        <h2 className="text-lg font-bold text-amber-900">
                            Auditoria devolvida para correção
                        </h2>

                        <p className="mt-2 text-sm text-amber-800">
                            A supervisora solicitou correções nesta mesma versão.
                            Revise o motivo abaixo, ajuste as respostas necessárias
                            e reenvie a auditoria para validação.
                        </p>

                        <div className="mt-4 rounded-lg border border-amber-200 bg-white p-4">
                            <p className="text-sm font-semibold text-gray-700">
                                Motivo da devolução
                            </p>

                            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">
                                {auditoria.versao.motivo_devolucao ||
                                    "O motivo não foi informado."}
                            </p>
                        </div>
                    </section>
                )}

                {/* SETORES */}
                <div className="space-y-8">
                    {auditoria.setores.length ===
                        0 ? (
                        <section className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                            <p className="text-gray-600">
                                Nenhum setor foi associado
                                a esta auditoria.
                            </p>
                        </section>
                    ) : (
                        auditoria.setores.map(
                            (setor) => (
                                <section
                                    key={
                                        setor.auditoria_setor_id
                                    }
                                    className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
                                >
                                    {/* CABEÇALHO DO SETOR */}
                                    <button
                                        type="button"
                                        onClick={() =>
                                            alternarSetor(
                                                setor.auditoria_setor_id
                                            )
                                        }
                                        className="w-full border-b border-gray-200 px-6 py-5 text-left transition hover:bg-gray-100"
                                        style={{
                                            backgroundColor:
                                                "#f8fafc",
                                        }}
                                    >
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p className="text-sm font-medium text-gray-500">
                                                    Setor{" "}
                                                    {
                                                        setor.ordem
                                                    }
                                                </p>

                                                <div className="flex items-center gap-3">
                                                    <span
                                                        className="text-lg font-bold"
                                                        style={{ color: "#c22a2e" }}
                                                        aria-hidden="true"
                                                    >
                                                        {setoresAbertos[
                                                            setor.auditoria_setor_id
                                                        ]
                                                            ? "▼"
                                                            : "▶"}
                                                    </span>

                                                    <h2 className="text-2xl font-bold text-gray-800">
                                                        {setor.setor_nome}
                                                    </h2>
                                                </div>
                                            </div>

                                            <div className="text-left sm:text-right">
                                                <p className="text-sm text-gray-500">
                                                    Checklist
                                                </p>

                                                <p className="font-semibold text-gray-800">
                                                    {
                                                        setor.checklist_nome
                                                    }
                                                </p>

                                                <p className="text-sm text-gray-500">
                                                    Versão{" "}
                                                    {
                                                        setor.checklist_versao_numero
                                                    }
                                                </p>
                                            </div>
                                        </div>
                                    </button>

                                    {/* SEÇÕES */}
                                    {setoresAbertos[setor.auditoria_setor_id] && (
                                        <div className="divide-y divide-gray-200">
                                            {setor.secoes.length === 0 ? (
                                                <div className="p-6">
                                                    <p className="text-gray-500">
                                                        Este checklist não possui seções.
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
                                                            {secao.itens.length === 0 ? (
                                                                <p className="text-sm text-gray-500">
                                                                    Nenhum item cadastrado nesta seção.
                                                                </p>
                                                            ) : (
                                                                secao.itens.map((item) => {
                                                                    const resultadoAtual =
                                                                        respostas[item.id];

                                                                    const exigeObservacao =
                                                                        resultadoAtual ===
                                                                        "PARCIALMENTE_CONFORME" ||
                                                                        resultadoAtual ===
                                                                        "NAO_CONFORME";

                                                                    return (
                                                                        <div
                                                                            key={item.id}
                                                                            className="rounded-lg border border-gray-200 bg-gray-50 p-4"
                                                                        >
                                                                            <div className="flex gap-3">
                                                                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-700">
                                                                                    {item.ordem}
                                                                                </div>

                                                                                <div className="min-w-0 flex-1">
                                                                                    <p className="font-medium leading-relaxed text-gray-800">
                                                                                        {item.texto}
                                                                                    </p>

                                                                                    {item.orientacao && (
                                                                                        <div className="mt-2 rounded-md border border-blue-100 bg-blue-50 p-3">
                                                                                            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                                                                                                Orientação
                                                                                            </p>

                                                                                            <p className="mt-1 text-sm text-blue-900">
                                                                                                {item.orientacao}
                                                                                            </p>
                                                                                        </div>
                                                                                    )}

                                                                                    {/* RESULTADO */}
                                                                                    <div className="mt-4">
                                                                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                                                                            <p className="text-sm font-semibold text-gray-700">
                                                                                                Resultado
                                                                                            </p>

                                                                                            {salvando[item.id] && (
                                                                                                <span className="text-xs font-medium text-gray-500">
                                                                                                    Salvando...
                                                                                                </span>
                                                                                            )}
                                                                                        </div>

                                                                                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                                                                                            <button
                                                                                                type="button"
                                                                                                disabled={salvando[item.id] || !podeEditarAuditoria()}
                                                                                                onClick={() =>
                                                                                                    selecionarResultado(
                                                                                                        setor.auditoria_setor_id,
                                                                                                        item.id,
                                                                                                        "CONFORME"
                                                                                                    )
                                                                                                }
                                                                                                className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold transition ${resultadoAtual ===
                                                                                                    "CONFORME"
                                                                                                    ? "border-green-600 bg-green-600 text-white"
                                                                                                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                                                                                    }`}
                                                                                            >
                                                                                                Conforme
                                                                                            </button>

                                                                                            <button
                                                                                                type="button"
                                                                                                disabled={salvando[item.id]}
                                                                                                onClick={() =>
                                                                                                    selecionarResultado(
                                                                                                        setor.auditoria_setor_id,
                                                                                                        item.id,
                                                                                                        "PARCIALMENTE_CONFORME"
                                                                                                    )
                                                                                                }
                                                                                                className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold transition ${resultadoAtual ===
                                                                                                    "PARCIALMENTE_CONFORME"
                                                                                                    ? "border-yellow-500 bg-yellow-500 text-white"
                                                                                                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                                                                                    }`}
                                                                                            >
                                                                                                Parcialmente Conforme
                                                                                            </button>

                                                                                            <button
                                                                                                type="button"
                                                                                                disabled={salvando[item.id]}
                                                                                                onClick={() =>
                                                                                                    selecionarResultado(
                                                                                                        setor.auditoria_setor_id,
                                                                                                        item.id,
                                                                                                        "NAO_CONFORME"
                                                                                                    )
                                                                                                }
                                                                                                className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold transition ${resultadoAtual ===
                                                                                                    "NAO_CONFORME"
                                                                                                    ? "border-red-600 bg-red-600 text-white"
                                                                                                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                                                                                    }`}
                                                                                            >
                                                                                                Não Conforme
                                                                                            </button>

                                                                                            <button
                                                                                                type="button"
                                                                                                disabled={salvando[item.id]}
                                                                                                onClick={() =>
                                                                                                    selecionarResultado(
                                                                                                        setor.auditoria_setor_id,
                                                                                                        item.id,
                                                                                                        "NAO_APLICAVEL"
                                                                                                    )
                                                                                                }
                                                                                                className={`min-h-[44px] rounded-lg border px-3 py-2 text-sm font-semibold transition ${resultadoAtual ===
                                                                                                    "NAO_APLICAVEL"
                                                                                                    ? "border-gray-600 bg-gray-600 text-white"
                                                                                                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                                                                                                    }`}
                                                                                            >
                                                                                                Não Aplicável
                                                                                            </button>

                                                                                            {(
                                                                                                respostas[item.id] === "NAO_CONFORME" ||
                                                                                                respostas[item.id] === "PARCIALMENTE_CONFORME"
                                                                                            ) && (
                                                                                                    <>
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            disabled={!podeEditarAuditoria()}
                                                                                                            onClick={() =>
                                                                                                                adicionarEvidencia(item.id)
                                                                                                            }
                                                                                                            className="rounded-lg border border-[#22365b] px-3 py-2 text-sm font-medium text-[#22365b] hover:bg-[#22365b] hover:text-white"
                                                                                                        >
                                                                                                            {item.resposta?.evidencias.length
                                                                                                                ? "Adicionar outra foto"
                                                                                                                : "Adicionar foto"}
                                                                                                        </button>

                                                                                                        {item.resposta?.evidencias.length ? (
                                                                                                            <div className="mt-3 w-full">
                                                                                                                <p className="mb-2 text-sm font-semibold text-gray-700">
                                                                                                                    Evidências
                                                                                                                </p>

                                                                                                                <div className="flex flex-wrap gap-3">
                                                                                                                    {item.resposta.evidencias.map(
                                                                                                                        (evidencia) => (
                                                                                                                            <div
                                                                                                                                key={evidencia.id}
                                                                                                                                className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
                                                                                                                            >
                                                                                                                                <button
                                                                                                                                    type="button"
                                                                                                                                    onClick={() =>
                                                                                                                                        setEvidenciaAberta(evidencia)
                                                                                                                                    }
                                                                                                                                    className="block cursor-zoom-in"
                                                                                                                                    aria-label={`Abrir Foto ${evidencia.ordem}`}
                                                                                                                                    disabled={!podeEditarAuditoria()}
                                                                                                                                >
                                                                                                                                    <img
                                                                                                                                        src={`/api/auditorias/${id}/evidencias?evidenciaId=${encodeURIComponent(
                                                                                                                                            evidencia.id
                                                                                                                                        )}&v=${evidencia.versao ?? 0}`}
                                                                                                                                        alt={`Evidência ${evidencia.ordem}`}
                                                                                                                                        className="h-28 w-28 object-cover"
                                                                                                                                    />
                                                                                                                                </button>

                                                                                                                                <div className="px-2 py-1 text-center text-xs font-medium text-gray-600">
                                                                                                                                    Foto {evidencia.ordem}
                                                                                                                                </div>

                                                                                                                                <button
                                                                                                                                    type="button"
                                                                                                                                    onClick={() =>
                                                                                                                                        substituirEvidencia(
                                                                                                                                            evidencia,
                                                                                                                                            item.id
                                                                                                                                        )
                                                                                                                                    }
                                                                                                                                    className="w-full border-t border-gray-200 px-2 py-2 text-xs font-semibold text-[#c22a2e] hover:bg-gray-50"
                                                                                                                                >
                                                                                                                                    Substituir foto
                                                                                                                                </button>
                                                                                                                            </div>
                                                                                                                        )
                                                                                                                    )}
                                                                                                                </div>
                                                                                                            </div>
                                                                                                        ) : null}
                                                                                                    </>
                                                                                                )}
                                                                                        </div>

                                                                                        {/* OBSERVAÇÃO */}
                                                                                        {exigeObservacao && (
                                                                                            <div className="mt-4">
                                                                                                <label
                                                                                                    htmlFor={`observacao-${item.id}`}
                                                                                                    className="block text-sm font-semibold text-gray-700"
                                                                                                >
                                                                                                    Observação /
                                                                                                    Justificativa
                                                                                                    <span className="ml-1 text-red-600">
                                                                                                        *
                                                                                                    </span>
                                                                                                </label>

                                                                                                <textarea
                                                                                                    id={`observacao-${item.id}`}
                                                                                                    disabled={!podeEditarAuditoria()}
                                                                                                    value={
                                                                                                        observacoes[item.id] ??
                                                                                                        ""
                                                                                                    }
                                                                                                    onChange={(event) =>
                                                                                                        alterarObservacao(
                                                                                                            setor.auditoria_setor_id,
                                                                                                            item.id,
                                                                                                            event.target.value
                                                                                                        )
                                                                                                    }
                                                                                                    onBlur={() =>
                                                                                                        salvarObservacaoAoSair(
                                                                                                            setor.auditoria_setor_id,
                                                                                                            item.id
                                                                                                        )
                                                                                                    }
                                                                                                    placeholder="Informe a justificativa ou descreva a situação encontrada..."
                                                                                                    rows={4}
                                                                                                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-3 text-sm text-gray-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                                                                                />

                                                                                                <p className="mt-1 text-xs text-gray-500">
                                                                                                    A observação é obrigatória
                                                                                                    para este resultado e é
                                                                                                    salva automaticamente.
                                                                                                </p>
                                                                                            </div>
                                                                                        )}

                                                                                        {erroResposta[item.id] && (
                                                                                            <p className="mt-2 text-sm font-medium text-red-600">
                                                                                                {erroResposta[item.id]}
                                                                                            </p>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    );
                                                                })
                                                            )}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </section>
                            )
                        )
                    )}
                </div>
            </div>

            {(
                auditoria.versao.status === "ABERTA" ||
                auditoria.versao.status === "EM_CORRECAO"
            ) && (
                    <div className="mt-6 flex justify-end">
                        <button
                            type="button"
                            onClick={enviarParaValidacao}
                            className="min-h-[44px] rounded-lg bg-[#22365b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#1a2a47]"
                        >
                            {auditoria.versao.status === "EM_CORRECAO"
                                ? "Enviar novamente para validação"
                                : "Enviar para validação"}
                        </button>
                    </div>
                )}

            {auditoria.usuario_perfil === "SUPERVISORA" &&
                auditoria.versao.status === "ENVIADA" && (
                    <div className="mt-6 flex flex-wrap justify-end gap-3">
                        <button
                            type="button"
                            onClick={devolverParaCorrecao}
                            className="min-h-[44px] rounded-lg border border-[#c22a2e] px-6 py-3 text-sm font-semibold text-[#c22a2e] transition hover:bg-red-50"
                        >
                            Devolver para correção
                        </button>

                        <button
                            type="button"
                            onClick={finalizarAuditoria}
                            className="min-h-[44px] rounded-lg bg-[#c22a2e] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#a82226]"
                        >
                            Finalizar auditoria
                        </button>
                    </div>
                )}

            {evidenciaAberta && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
                    onClick={() =>
                        setEvidenciaAberta(null)
                    }
                >
                    <div
                        className="relative flex max-h-[95vh] max-w-5xl flex-col items-center rounded-xl bg-white p-4 shadow-2xl"
                        onClick={(event) =>
                            event.stopPropagation()
                        }
                    >
                        <div className="mb-3 flex w-full items-center justify-between gap-4">
                            <h2 className="text-lg font-bold text-gray-800">
                                Foto {evidenciaAberta.ordem}
                            </h2>

                            <button
                                type="button"
                                onClick={() =>
                                    setEvidenciaAberta(null)
                                }
                                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-gray-300 bg-white px-3 text-xl font-semibold text-gray-700 hover:bg-gray-100"
                                aria-label="Fechar visualização"
                            >
                                ×
                            </button>
                        </div>

                        <img
                            src={`/api/auditorias/${id}/evidencias?evidenciaId=${encodeURIComponent(
                                evidenciaAberta.id
                            )}&v=${evidenciaAberta.versao ?? 0}`}
                            alt={`Evidência ${evidenciaAberta.ordem}`}
                            className="max-h-[80vh] max-w-full rounded-lg object-contain"
                        />
                    </div>
                </div>
            )}

        </main>
    );
}
