import { redirect } from "next/navigation";

type PageProps = {
    params: Promise<{ id: string; lojaId: string }>;
};

export default async function TreinamentosDaLojaPage({ params }: PageProps) {
    const { id: clienteId, lojaId } = await params;
    redirect(`/treinamentos?clienteId=${encodeURIComponent(clienteId)}&lojaId=${encodeURIComponent(lojaId)}`);
}
