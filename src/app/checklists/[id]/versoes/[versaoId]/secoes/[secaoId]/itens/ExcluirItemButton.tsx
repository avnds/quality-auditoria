"use client";

import { useState } from "react";

type ExcluirItemButtonProps = {
    checklistId: string;
    versaoId: string;
    secaoId: string;
    itemId: string;
    textoItem: string;
};

export default function ExcluirItemButton({
    checklistId,
    versaoId,
    secaoId,
    itemId,
    textoItem,
}: ExcluirItemButtonProps) {
    const [excluindo, setExcluindo] = useState(false);
    const [erro, setErro] = useState("");

    async function handleExcluir() {
        setErro("");

        const confirmado = window.confirm(
            `Deseja realmente excluir este item?\n\n${textoItem}\n\nEssa ação não poderá ser desfeita.`
        );

        if (!confirmado) {
            return;
        }

        setExcluindo(true);

        try {
            const resposta = await fetch(
                `/api/checklists/${checklistId}/versoes/${versaoId}/secoes/${secaoId}/itens/${itemId}`,
                {
                    method: "DELETE",
                }
            );

            const dados = await resposta.json();

            if (!resposta.ok) {
                setErro(
                    dados.message ||
                    "Não foi possível excluir o item."
                );
                return;
            }

            window.location.reload();
        } catch (error) {
            console.error("Erro ao excluir item:", error);
            setErro(
                "Não foi possível excluir o item. Tente novamente."
            );
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
                {excluindo ? "Excluindo..." : "Excluir"}
            </button>

            {erro && (
                <p
                    role="alert"
                    className="max-w-xs text-xs leading-5 text-red-700"
                >
                    {erro}
                </p>
            )}
        </div>
    );
}