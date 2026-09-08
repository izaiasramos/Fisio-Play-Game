/**
 * Conferidor visual das pranchas geradas por scripts/gerar_pranchas.py.
 *
 * Não existe rasterizador de SVG no projeto, então a conferência é indireta mas
 * fiel: baixa o RASTER da prancha original no Commons, recorta exatamente no
 * mesmo enquadramento que o SVG gerado usa e marca cada alvo por cima, numerado.
 * Se o número cai sobre a estrutura certa, os alvos do JSON estão certos.
 *
 * O PNG de saída ainda mostra os rótulos e linhas-guia do original (eles existem
 * no raster); no SVG gerado eles foram removidos.
 *
 * Uso:
 *   python3 scripts/gerar_pranchas.py <id>     # gera e escreve o sidecar
 *   node scripts/conferir_prancha.cjs <id>     # produz /tmp/prancha-<id>.png
 */
const fs = require("fs");
const path = require("path");
const https = require("https");
const Jimp = require("jimp-compact");

const SIDECAR = "/tmp/fisioplay-pranchas-conferencia.json";
const USER_AGENT =
  "FisioPlay/1.0.0 (app educativo de fisioterapia; https://expo.dev/@izaiasr/fisioplay)";
const LARGURA_PEDIDA = 1000;

function baixar(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { "User-Agent": USER_AGENT } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return baixar(res.headers.location).then(resolve, reject);
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode} em ${url}`));
        }
        const partes = [];
        res.on("data", (c) => partes.push(c));
        res.on("end", () => resolve(Buffer.concat(partes)));
      })
      .on("error", reject);
  });
}

/** Anel vazado + cruz no centro, para o alvo não esconder a estrutura. */
function marcar(img, cx, cy, raioPx, cor) {
  const { width, height } = img.bitmap;
  const ponto = (x, y) => {
    if (x >= 0 && y >= 0 && x < width && y < height) img.setPixelColor(cor, x, y);
  };
  for (let a = 0; a < 360; a += 0.4) {
    const r = (a * Math.PI) / 180;
    for (const dr of [-1, 0, 1]) {
      ponto(Math.round(cx + (raioPx + dr) * Math.cos(r)), Math.round(cy + (raioPx + dr) * Math.sin(r)));
    }
  }
  for (let d = -5; d <= 5; d++) {
    ponto(Math.round(cx + d), Math.round(cy));
    ponto(Math.round(cx), Math.round(cy + d));
  }
}

async function main() {
  const id = process.argv[2];
  if (!fs.existsSync(SIDECAR)) {
    console.error(`sidecar não encontrado: ${SIDECAR}\nrode antes: python3 scripts/gerar_pranchas.py <id>`);
    process.exit(1);
  }
  const todas = JSON.parse(fs.readFileSync(SIDECAR, "utf8"));
  const alvo = id ? todas.find((p) => p.id === id) : todas[0];
  if (!alvo) {
    console.error(`prancha "${id}" não está no sidecar. Disponíveis: ${todas.map((p) => p.id).join(", ")}`);
    process.exit(1);
  }

  const nome = encodeURIComponent(alvo.arquivo.replace(/ /g, "_"));
  const url = `https://commons.wikimedia.org/wiki/Special:FilePath/${nome}?width=${LARGURA_PEDIDA}`;
  const buf = await baixar(url);
  const img = await Jimp.read(buf);

  const [ox, oy, ow] = alvo.viewBoxOrigem;
  const [gx, gy, gw, gh] = alvo.viewBoxGerado;
  const s = img.bitmap.width / ow; // px por unidade de usuário

  const x = Math.max(0, Math.round((gx - ox) * s));
  const y = Math.max(0, Math.round((gy - oy) * s));
  const w = Math.min(Math.round(gw * s), img.bitmap.width - x);
  const h = Math.min(Math.round(gh * s), img.bitmap.height - y);
  img.crop(x, y, w, h);

  const VERMELHO = 0xff0000ff;
  const AZUL = 0x0066ffff;
  console.log(`${alvo.id}: recorte ${w}x${h}px (aspecto ${(w / h).toFixed(3)})`);
  alvo.alvos.forEach((a, i) => {
    const cx = a.x * w;
    const cy = a.y * h;
    const raio = (a.raio ?? 0.1) * w;
    marcar(img, cx, cy, raio, i % 2 ? AZUL : VERMELHO);
    console.log(
      `  ${i + 1}. ${a.rotulo.padEnd(12)} centro=(${Math.round(cx)},${Math.round(cy)}) raio=${Math.round(raio)}px ${
        i % 2 ? "azul" : "vermelho"
      }`
    );
  });

  const saida = `/tmp/prancha-${alvo.id}.png`;
  await img.writeAsync(saida);
  console.log(`\n-> ${saida}`);
}

main().catch((e) => {
  console.error("ERRO:", e.message);
  process.exit(1);
});
