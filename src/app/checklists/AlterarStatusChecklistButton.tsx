"use client";

import { useState } from "react";

type AlterarStatusChecklistButtonProps = {
    checklistId: string;
    ativo: boolean;
    nome: string;
    onChanged: () => void;
};

export default function AlterarStatusChecklistButton({
    checklistId,
    ativo,
    nome,
    onChanged,
}: AlterarStatusChecklistButtonProps) {
    const [alterando, setAlterando] = useState(false);
    const [erro, setErro] = useState("");

    async function alterarStatus() {
        const acao = ativo ? "inativar" : "ativar";

        const confirmado = window.confirm(
            `Deseja ${acao} o checklist "${nome}"?`
        );

        if (!confirmado) {
            return;
        }

        setErro("");
        setAlterando(true);

        try {
            const response = await fetch(
                `/api/checklists/${checklistId}`,
                {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        ativo: !ativo,
                    }),
                }
            );

            const data = await response.json();

            if (!response.ok) {
                setErro(
                    data.message ||
                        "Não foi possível alterar o status do checklist."
                );
                return;
            }

            onChanged();
        } catch {
            setErro(
                "Não foi possível alterar o status do checklist. Tente novamente."
            );
        } finally {
            setAlterando(false);
        }
    }

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={alterarStatus}
                disabled={alterando}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    ativo
                        ? "border border-red-200 text-red-700 hover:bg-red-50"
                        : "border border-green-200 text-green-700 hover:bg-green-50"
                }`}
            >
                {alterando
                    ? "Aguarde..."
                    : ativo
                        ? "Inativar"
                        : "Ativar"}
            </button>

            {erro && (
                <span className="text-xs text-red-600">
                    {erro}
                </span>
            )}
        </div>
    );
}