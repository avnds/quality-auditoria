import { createHash } from "node:crypto";
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import type { AreaImportacaoDesktop } from "./area-importacao";
import type { ManifestoImportacaoDesktop } from "./manifesto-importacao";
import type { PlanoTransferencia } from "./plano-transferencia";
import type { IntegridadeEsperada } from "./conferir-integridade-esperada";
import { concluirTransferenciaDoPlano } from "./executar-transferencia-plano";

type Referencia = { tipo: "evidencia" | "relatorio"; registroId: string; referenciaSha256: string; destinoRelativo: string };
const chave = (tipo: string, id: string) => `${tipo}:${id}`;

/**
 * Confere se os arquivos no staging correspondem EXATAMENTE às referências
 * de arquivos presentes no SQLite restaurado, além de verificar os bytes.
 * Nunca altera banco, arquivos ou marcador da instalação.
 */
export async function conferirConjuntoImportado(
    area: AreaImportacaoDesktop,
    manifesto: ManifestoImportacaoDesktop,
    plano: PlanoTransferencia,
    integridades: readonly IntegridadeEsperada[]
): Promise<boolean> {
    if (manifesto.formato !== "quality-desktop-import-manifest" ||
        manifesto.versao !== 1 || manifesto.totalArquivos !== manifesto.inventario.arquivos.length ||
        manifesto.inventario.totalEvidencias + manifesto.inventario.totalRelatorios !== manifesto.totalArquivos ||
        !existsSync(area.banco) || lstatSync(area.banco).isSymbolicLink() ||
        realpathSync(area.banco) !== resolve(area.banco) ||
        !existsSync(area.arquivos) || lstatSync(area.arquivos).isSymbolicLink() ||
        realpathSync(area.arquivos) !== resolve(area.arquivos)) return false;

    const referencias = new Map<string, Referencia>();
    for (const item of manifesto.inventario.arquivos) {
        if (!["evidencia", "relatorio"].includes(item.tipo) ||
            !/^[A-Za-z0-9_-]{1,128}$/.test(item.registroId) ||
            !/^[a-f0-9]{64}$/.test(item.referenciaSha256) ||
            item.destinoRelativo !== `${item.tipo === "evidencia" ? "evidencias" : "relatorios"}/${item.registroId}`) return false;
        const id = chave(item.tipo, item.registroId);
        if (referencias.has(id)) return false;
        referencias.set(id, item);
    }
    if (!await concluirTransferenciaDoPlano(plano, area.arquivos, integridades)) return false;
    if (plano.arquivos.length !== referencias.size ||
        plano.arquivos.some(item => {
            const referencia = referencias.get(chave(item.tipo, item.registroId));
            return !referencia || referencia.destinoRelativo !== item.destinoRelativo;
        })) return false;

    const bancoArquivo = resolve(area.banco, "quality.sqlite");
    if (!existsSync(bancoArquivo) || lstatSync(bancoArquivo).isSymbolicLink() ||
        realpathSync(bancoArquivo) !== bancoArquivo) return false;
    const db = createClient({ url: pathToFileURL(bancoArquivo).href });
    try {
        const fk = await db.execute("PRAGMA foreign_key_check");
        const integridade = await db.execute("PRAGMA integrity_check");
        if (fk.rows.length || integridade.rows.length !== 1 ||
            String(integridade.rows[0]?.integrity_check) !== "ok") return false;

        const encontrados = new Set<string>();
        for (const [tabela, tipo] of [["evidencias", "evidencia"], ["relatorios", "relatorio"]] as const) {
            const resultado = await db.execute(`SELECT id, arquivo_uri FROM "${tabela}" WHERE arquivo_uri IS NOT NULL AND TRIM(arquivo_uri) <> ''`);
            for (const row of resultado.rows) {
                const id = String(row.id);
                const uri = String(row.arquivo_uri);
                const k = chave(tipo, id);
                if (encontrados.has(k)) return false;
                encontrados.add(k);
                const ref = referencias.get(k);
                const hash = createHash("sha256").update(uri, "utf8").digest("hex");
                if (!ref || ref.referenciaSha256 !== hash) return false;
            }
        }
        return encontrados.size === referencias.size;
    } catch {
        return false;
    } finally {
        await db.close();
    }
}
