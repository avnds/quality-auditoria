const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");
const fs = require("node:fs");

let servidor;
let janela;
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
app.whenReady().then(() => iniciar().catch(async erro => {
  await dialog.showMessageBox({ type: "error", title: "Quality Desktop", message: erro.message });
  app.quit();
}));
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (servidor && servidor.exitCode === null) servidor.kill();
});
