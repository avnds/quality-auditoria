import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";

type PageProps = {
    searchParams: Promise<{ restaurado?: string }>;
};

export default async function BackupRestauracaoPage({ searchParams }: PageProps) {
    const usuario = await getCurrentUser();
    const params = await searchParams;

    if (!usuario) redirect("/login");

    if (usuario.perfil !== "MASTER") {
        return (
            <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl rounded-2xl border border-red-200 bg-white p-6 shadow-sm sm:p-8">
                    <h1 className="text-xl font-bold text-[#c22a2e]">Acesso não permitido</h1>
                    <p className="mt-2 text-sm text-slate-600">Esta área é exclusiva para o perfil MASTER.</p>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-5xl">
                <header className="mb-8">
                    <p className="text-sm font-semibold uppercase tracking-wide text-[#c22a2e]">Administração do sistema</p>
                    <h1 className="mt-2 text-3xl font-bold text-[#12223f] sm:text-4xl">Backup e restauração</h1>
                    <div className="mt-3 h-1 w-20 rounded-full bg-[#c22a2e]" />
                    <p className="mt-4 max-w-3xl text-slate-600">Área exclusiva para backup e recuperação do banco de dados do Quality Auditoria.</p>
                </header>

                {params.restaurado === "1" && (
                    <section role="status" className="mb-6 rounded-2xl border border-green-200 bg-green-50 p-5 text-green-900">
                        <h2 className="font-bold">Restauração concluída</h2>
                        <p className="mt-1 text-sm">O backup foi restaurado e a quantidade de linhas foi conferida. Faça uma verificação funcional das telas e dos dados antes de continuar usando o ambiente.</p>
                    </section>
                )}

                <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="text-xl font-bold text-[#12223f]">Backup do banco de desenvolvimento</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-600">O arquivo contém estrutura e dados do banco DEV. Guarde-o em local seguro: pode conter informações internas, dados pessoais e hashes de senha. Não o compartilhe.</p>
                    <a href="/api/backup-restauracao" className="mt-4 inline-flex items-center justify-center rounded-xl bg-[#22365b] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#182846]">
                        Baixar backup do banco DEV
                    </a>
                    <p className="mt-3 text-xs leading-5 text-slate-500">Disponível somente em desenvolvimento local. Fotos de evidências armazenadas no Vercel Blob não são incluídas.</p>
                </section>

                <section className="mb-6 rounded-2xl border border-red-300 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="text-xl font-bold text-[#c22a2e]">Restaurar backup no banco DEV</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-700">A operação substitui a estrutura e os dados atuais do banco conectado ao ambiente local. Use somente o arquivo de backup desejado e confirme que o backup de recuperação atual foi salvo fora do projeto.</p>
                    <form action="/api/backup-restauracao/restaurar" method="post" encType="multipart/form-data" className="mt-5 space-y-4">
                        <div>
                            <label htmlFor="arquivo" className="mb-2 block text-sm font-semibold text-slate-800">Arquivo JSON do backup</label>
                            <input id="arquivo" name="arquivo" type="file" accept=".json,application/json" required className="block w-full rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold" />
                            <p className="mt-1 text-xs text-slate-500">Limite: 25 MB. O arquivo deve ter sido gerado pelo backup lógico do Quality Auditoria.</p>
                        </div>
                        <div>
                            <label htmlFor="confirmacao" className="mb-2 block text-sm font-semibold text-slate-800">Para confirmar, digite exatamente: RESTAURAR DEV</label>
                            <input id="confirmacao" name="confirmacao" type="text" autoComplete="off" required pattern="RESTAURAR DEV" title="Digite exatamente RESTAURAR DEV" className="block w-full rounded-lg border border-slate-300 px-3 py-3 text-sm text-slate-900" />
                        </div>
                        <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-[#c22a2e] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-800">
                            Substituir dados do banco DEV
                        </button>
                    </form>
                    <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm leading-5 text-red-900">A restauração só funciona em desenvolvimento local e com perfil MASTER. Se a validação de dados ou chaves estrangeiras falhar, a transação será cancelada. O banco de produção é bloqueado por esta rota.</p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <h2 className="text-lg font-bold text-[#12223f]">Limites desta restauração</h2>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
                        <li>Restaura tabelas, índices e registros incluídos no arquivo.</li>
                        <li>Confere as quantidades de linhas e executa uma verificação de chaves estrangeiras antes de confirmar a transação.</li>
                        <li>Não restaura fotos e arquivos do Vercel Blob.</li>
                        <li>Depois da operação, valide login, auditorias, checklists e relatórios no ambiente DEV.</li>
                    </ul>
                </section>
            </div>
        </main>
    );
}
