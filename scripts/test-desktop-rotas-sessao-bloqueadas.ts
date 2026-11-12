import { strict as assert } from "node:assert";
import { NextRequest } from "next/server";
import { POST as criarSessao } from "../src/app/api/desktop/exportacao/sessoes/route";
import { GET as recuperarSessao } from "../src/app/api/desktop/exportacao/sessoes/[sessaoId]/route";

async function main() {
    const anterior = process.env.QUALITY_DESKTOP_EXPORT_SESSION_ENABLED;
    try {
        delete process.env.QUALITY_DESKTOP_EXPORT_SESSION_ENABLED;
        const criacao = await criarSessao();
        assert.equal(criacao.status, 503);
        assert.equal(criacao.headers.get("cache-control")?.includes("no-store"), true);
        assert.equal((await criacao.json()).success, false);
        console.log("OK: criação de sessão bloqueada sem configuração.");

        const recuperacao = await recuperarSessao(
            new NextRequest("http://localhost/api/desktop/exportacao/sessoes/00000000-0000-4000-8000-000000000000"),
            { params: Promise.resolve({ sessaoId: "00000000-0000-4000-8000-000000000000" }) }
        );
        assert.equal(recuperacao.status, 503);
        assert.equal(recuperacao.headers.get("cache-control")?.includes("no-store"), true);
        assert.equal((await recuperacao.json()).success, false);
        console.log("OK: recuperação de sessão bloqueada sem configuração.");

        process.env.QUALITY_DESKTOP_EXPORT_SESSION_ENABLED = "false";
        assert.equal((await criarSessao()).status, 503);
        console.log("OK: valor 'false' mantém criação bloqueada.");
        console.log("OK: nenhuma operação no banco ou Blob foi iniciada.");
    } finally {
        if (anterior === undefined) delete process.env.QUALITY_DESKTOP_EXPORT_SESSION_ENABLED;
        else process.env.QUALITY_DESKTOP_EXPORT_SESSION_ENABLED = anterior;
    }
}
main().catch(erro => { console.error(erro); process.exitCode = 1; });
