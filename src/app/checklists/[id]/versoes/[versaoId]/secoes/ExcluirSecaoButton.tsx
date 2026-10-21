"use client";

import { useState } from "react";

type ExcluirSecaoButtonProps = {
    checklistId: string;
    versaoId: string;
    secaoId: string;
    nomeSecao: string;
};

export default function ExcluirSecaoButton({
    checklistId,
    versaoId,
    secaoId,
    nomeSecao,
}: ExcluirSecaoButtonProps) {
    const [excluindo, setExcluindo] = useState(false);
    const [erro, setErro] = useState("");

    async function handleExcluir() {
        setErro("");

        const confirmado = window.confirm(
            `Deseja realmente excluir a seção inteira "${nomeSecao}"?\n\nTodos os itens dessa seção também serão excluídos. Essa ação não poderá ser desfeita.`
        );

        if (!confirmado) return;

        setExcluindo(true);

        try {
            const resposta = await fetch(
                `/api/checklists/${checklistId}/versoes/${versaoId}/secoes/${secaoId}`,
                { method: "DELETE" }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                setErro(
                    dados.message ||
                        "Não foi possível excluir a seção."
                );
                return;
            }

            window.location.reload();
        } catch (error) {
            console.error("Erro ao excluir seção:", error);
            setErro("Não foi possível excluir a seção. Tente novamente.");
        } finally {
            setExcluindo(false);
        }
    }

    return (
        <div className="flex flex-col items-start gap-2">
            <button
                type="button"
                onClick={handleExcluir}
                disabled={excluindo}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
                {excluindo ? "Excluindo..." : "Excluir seção"}
            </button>

            {erro && (
                <p role="alert" className="max-w-xs text-xs leading-5 text-red-700">
                    {erro}
                </p>
            )}
        </div>
    );
}