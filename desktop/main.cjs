const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");
const { once } = require("node:events");

let servidor;
let janela;
let instalando = false;
let origemVinculada = null;
const protocolo = "qualitydesktop";
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient(protocolo, process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient(protocolo);
}
function receberVinculo(valor) {
  try {
    const link = new URL(valor);
    if (link.protocol !== protocolo + ":" || link.hostname !== "setup") return;
    const origem = new URL(link.searchParams.get("origin") || "");
    if (origem.username || origem.password || origem.search || origem.hash ||
        (origem.pathname !== "/" && origem.pathname !== "") ||
        (origem.protocol !== "https:" &&
         !(origem.protocol === "http:" && ["localhost", "127.0.0.1"].includes(origem.hostname)))) return;
    origemVinculada = origem.origin;
    if (janela && !janela.isDestroyed()) janela.webContents.send("quality:origin", origemVinculada);
  } catch {}
}
app.on("open-url", (evento, url) => { evento.preventDefault(); receberVinculo(url); });
app.on("second-instance", (_evento, args) => {
  const link = args.find(item => item.startsWith(protocolo + "://"));
  if (link) receberVinculo(link);
  if (janela && !janela.isDestroyed()) janela.focus();
});
const instanciaUnica = app.requestSingleInstanceLock();
if (!instanciaUnica) app.quit();
const linkInicial = process.argv.find(item => item.startsWith(protocolo + "://"));
if (linkInicial) receberVinculo(linkInicial);
const raizDados = () => path.join(process.env.LOCALAPPDATA || app.getPath("userData"), "QualityDesktop");
const instalacaoPronta = () => {
  const raiz = raizDados();
  try {
    const marcador = JSON.parse(fs.readFileSync(path.join(raiz, "instalacao.json"), "utf8"));
    return marcador.format === "quality-desktop-installation" && marcador.version === 1 &&
      !Number.isNaN(Date.parse(marcador.importedAt)) &&
      fs.statSync(path.join(raiz, "database", "quality.sqlite")).size > 0;
  } catch { return false; }
};
const pastaApp = () => path.join(process.resourcesPath, "quality-server");
function portaLivre() {
  return new Promise((resolve, reject) => {
    const socket = net.createServer();
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", () => {
      const endereco = socket.address();
      const porta = endereco.port;
      socket.close(() => resolve(porta));
    });
  });
}
async function aguardarServidor(url, processo) {
  for (let i = 0; i < 90; i++) {
    if (processo.exitCode !== null) throw new Error("Servidor local encerrou inesperadamente.");
    try {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (resposta.status < 500) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error("Servidor local não iniciou dentro do prazo.");
}
async function iniciar() {
  const raiz = pastaApp();
  const entrada = path.join(raiz, "server.js");
  if (!fs.existsSync(entrada)) throw new Error("Pacote do servidor não encontrado.");
  if (!instalacaoPronta()) {
    janela = new BrowserWindow({ width: 760, height: 720, resizable: false,
      webPreferences: { preload: path.join(__dirname, "preload.cjs"), nodeIntegration: false, contextIsolation: true, sandbox: true } });
    janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
    janela.webContents.on("will-navigate", (evento, destino) => {
      if (!destino.startsWith("file://")) evento.preventDefault();
    });
    await janela.loadFile(path.join(__dirname, "setup.html"));
    if (origemVinculada) janela.webContents.send("quality:origin", origemVinculada);
    return;
  }
  const porta = await portaLivre();
  const url = `http://127.0.0.1:${porta}`;
  servidor = spawn(process.execPath, [entrada], {
    cwd: raiz,
    windowsHide: true,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      QUALITY_RUNTIME: "desktop",
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(porta),
    },
    stdio: "ignore",
  });
  await aguardarServidor(url, servidor);
  janela = new BrowserWindow({
    width: 1280, height: 850, minWidth: 900, minHeight: 600,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
  });
  janela.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  janela.webContents.on("will-navigate", (evento, destino) => {
    if (!destino.startsWith(url + "/")) evento.preventDefault();
  });
  await janela.loadURL(url);
}
ipcMain.handle("quality:install", async (evento, entrada) => {
  if (instalando || instalacaoPronta()) return { ok: false, mensagem: "Instalação já iniciada ou concluída." };
  if (!janela || evento.sender !== janela.webContents) return { ok: false, mensagem: "Origem da solicitação inválida." };
  if (!entrada || typeof entrada.origem !== "string" || typeof entrada.email !== "string" ||
      typeof entrada.senha !== "string" || entrada.senha.length > 1024) {
    return { ok: false, mensagem: "Dados de instalação inválidos." };
  }
  if (origemVinculada && new URL(entrada.origem).origin !== origemVinculada) return { ok: false, mensagem: "Origem diferente do Quality online que iniciou a instalação." };
  instalando = true;
  const entradaRunner = path.join(pastaApp(), "instalar-desktop.cjs");
  try {
    if (!fs.existsSync(entradaRunner)) throw new Error("Executor de importação não encontrado.");
    const processo = spawn(process.execPath, [entradaRunner], {
      cwd: pastaApp(), windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", QUALITY_RUNTIME: "desktop" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    const dados = JSON.stringify(entrada);
    entrada.senha = "";
    processo.stdin.end(dados);
    let saida = "";
    let erros = "";
    processo.stdout.setEncoding("utf8");
    processo.stderr.setEncoding("utf8");
    processo.stdout.on("data", trecho => { saida += trecho; if (saida.length > 12000) saida = saida.slice(-12000); });
    processo.stderr.on("data", trecho => { erros += trecho; if (erros.length > 12000) erros = erros.slice(-12000); });
    const [codigo] = await once(processo, "close");
    if (codigo !== 0) throw new Error(erros.slice(-1200) || "Importação falhou.");
    if (!instalacaoPronta()) throw new Error("Importação não ativou o banco local.");
    janela.webContents.send("quality:install-done");
    return { ok: true };
  } catch (erro) {
    return { ok: false, mensagem: erro instanceof Error ? erro.message : "Falha inesperada." };
  } finally {
    instalando = false;
  }
});
ipcMain.handle("quality:restart", () => {
  if (!instalacaoPronta()) return false;
  app.relaunch();
  app.quit();
  return true;
});
app.whenReady().then(() => iniciar().catch(async erro => {
  await dialog.showMessageBox({ type: "error", title: "Quality Desktop", message: erro.message });
  app.quit();
}));
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (servidor && servidor.exitCode === null) servidor.kill();
});
