"use client";

import { useState } from "react";

type Props = {
    checklistId: string;
    versaoId: string;
    publicada: boolean;
    podeGerenciar: boolean;
};

export default function AlterarPublicacaoVersaoButton({
    checklistId,
    versaoId,
    publicada,
    podeGerenciar,
}: Props) {
    const [carregando, setCarregando] = useState(false);

    if (!podeGerenciar) {
        return null;
    }

    async function alterarPublicacao() {
        const novoStatus = !publicada;

        const mensagem = novoStatus
            ? "Deseja publicar esta versão?"
            : "Deseja despublicar esta versão?";

        const confirmou = window.confirm(mensagem);

        if (!confirmou) {
            return;
        }

        try {
            setCarregando(true);

            const response = await fetch(
                `/api/checklists/${checklistId}/versoes`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        versaoId,
                        publicada: novoStatus,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data?.message ||
                    "Não foi possível alterar a publicação."
                );
            }

            window.location.reload();
        } catch (error) {
            console.error(error);

            alert(
                error instanceof Error
                    ? error.message
                    : "Não foi possível alterar a publicação."
            );
        } finally {
            setCarregando(false);
        }
    }

    return (
        <button
            type="button"
            onClick={alterarPublicacao}
            disabled={carregando}
            className={
                publicada
                    ? "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    : "rounded-lg border border-[#22365b] bg-[#22365b] px-3 py-2 text-center text-xs font-semibold text-white transition hover:bg-[#1b2b49] disabled:cursor-not-allowed disabled:opacity-50"
            }
        >
            {carregando
                ? "Aguarde..."
                : publicada
                    ? "Despublicar"
                    : "Publicar"}
        </button>
    );
}