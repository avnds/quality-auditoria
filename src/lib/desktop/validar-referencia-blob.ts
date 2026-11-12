/**
 * Política de origem para transferências futuras do Quality Desktop.
 * Não faz requisições nem utiliza credenciais do Vercel Blob.
 *
 * Os endereços são dados não confiáveis recebidos do backup.
 * A autorização real de download será feita pelo servidor Cloud.
 */
export function validarReferenciaBlobPrivado(valor: string): URL {
    if (typeof valor !== "string" || valor.length === 0 || valor.length > 4096) {
        throw new Error("Referência Blob ausente ou excessivamente longa.");
    }

    let url: URL;
    try {
        url = new URL(valor);
    } catch {
        throw new Error("Referência Blob não é uma URL válida.");
    }

    if (
        url.protocol !== "https:" ||
        url.username !== "" ||
        url.password !== "" ||
        url.port !== "" ||
        url.hash !== "" ||
        url.search !== ""
    ) {
        throw new Error("Referência Blob contém protocolo ou componentes não permitidos.");
    }

    // O host específico do store privado deve ser confirmado na configuração
    // do Cloud antes de habilitar downloads. Não confiar apenas no sufixo
    // blob.vercel-storage.com: backups podem conter URLs arbitrárias.
    if (!/^[a-z0-9-]+\\.private\\.blob\\.vercel-storage\\.com$/i.test(url.hostname)) {
        throw new Error("Referência fora do padrão de host privado do Vercel Blob.");
    }

    if (url.pathname === "/" || /[\\\\%]/.test(url.pathname)) {
        throw new Error("Caminho Blob inválido ou ambíguo.");
    }

    return url;
}
