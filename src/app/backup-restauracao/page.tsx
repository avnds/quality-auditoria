import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

export default async function BackupRestauracaoPage() {
    const usuario = await getCurrentUser();

    if (!usuario) {
        redirect("/login");
    }

    if (usuario.perfil !== "MASTER") {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
                    <h1 className="text-xl font-bold text-[#c22a2e]">Acesso não permitido</h1>
                    <p className="mt-2 text-sm text-slate-600">
                        Esta área é exclusiva para o perfil MASTER.
                    </p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
                <header className="mb-8">
                    <p className="text-sm font-semibold uppercase tracking-wide text-[#c22a2e]">
                        Administração do sistema
                    </p>
                    <h1 className="mt-2 text-3xl font-bold text-[#12223f] sm:text-4xl">
                        Backup e restauração
                    </h1>
                    <div className="mt-3 h-1 w-20 rounded-full bg-[#c22a2e]" />
                    <p className="mt-4 max-w-3xl text-slate-600">
                        Área exclusiva para preparar operações de backup e recuperação do banco de dados do Quality Auditoria.
                    </p>
                </header>

                <section className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 sm:p-6">
                    <h2 className="font-bold text-amber-900">Restauração ainda não habilitada</h2>
                    <p className="mt-2 text-sm leading-6 text-amber-900">
                        Esta primeira etapa prepara a área administrativa. Nenhum arquivo será enviado e nenhum banco será alterado por esta página.
                        A execução será implementada somente depois de validarmos o procedimento técnico de importação no banco de desenvolvimento.
                    </p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <h2 className="text-xl font-bold text-[#12223f]">Procedimento seguro previsto</h2>
                    <ol className="mt-5 space-y-4">
                        <li className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22365b] text-sm font-bold text-white">1</span>
                            <div>
                                <p className="font-semibold text-[#12223f]">Selecionar o arquivo de backup</p>
                                <p className="mt-1 text-sm text-slate-600">Identificar o arquivo e a data do backup antes de qualquer operação.</p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22365b] text-sm font-bold text-white">2</span>
                            <div>
                                <p className="font-semibold text-[#12223f]">Validar o arquivo</p>
                                <p className="mt-1 text-sm text-slate-600">Conferir formato, integridade e compatibilidade antes de permitir a restauração.</p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22365b] text-sm font-bold text-white">3</span>
                            <div>
                                <p className="font-semibold text-[#12223f]">Confirmar o banco de destino</p>
                                <p className="mt-1 text-sm text-slate-600">Testar primeiro na DEV, manter um backup anterior e bloquear destinos não autorizados.</p>
                            </div>
                        </li>
                        <li className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#22365b] text-sm font-bold text-white">4</span>
                            <div>
                                <p className="font-semibold text-[#12223f]">Restaurar e verificar</p>
                                <p className="mt-1 text-sm text-slate-600">Executar somente após confirmação explícita e verificar os dados restaurados.</p>
                            </div>
                        </li>
                    </ol>
                    <p className="mt-6 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                        Observação: as fotos de evidências armazenadas no Vercel Blob ficam fora do banco de dados e exigem uma estratégia de backup separada.
                    </p>
                </section>
            </div>
        </main>
    );
}
