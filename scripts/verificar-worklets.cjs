/**
 * Verificação estática de worklets (Reanimated 4 / react-native-worklets).
 *
 * Roda o Babel do projeto sobre app/ e src/, extrai cada worklet gerado e
 * reprova se algum deles INVOCAR uma função capturada do closure que não seja
 * worklet. No Reanimated 4 essa função é uma "Remote Function": chamá-la
 * sincronamente na UI runtime aborta o app com
 *   [Worklets] Tried to synchronously call a Remote Function.
 *
 * Esse bug NÃO aparece no preview web (RN Web não tem UI runtime separada),
 * só em device real — por isso a checagem existe.
 *
 * Rodar:  node scripts/verificar-worklets.cjs
 */
// Varredura: encontra worklets que CHAMAM uma função capturada no closure.
// Toda função assim precisa ser worklet também, senão o Reanimated 4 a trata
// como Remote Function e a chamada síncrona na UI runtime derruba o app.
const babel = require("@babel/core");
const fs = require("fs");
const path = require("path");

// funções do Reanimated/JS que já são seguras dentro de worklet
const SEGURAS = new Set([
  "interpolate", "interpolateColor", "withTiming", "withSpring", "withDecay",
  "withDelay", "withSequence", "withRepeat", "runOnJS", "runOnUI", "cancelAnimation",
  "clamp", "Easing", "Math", "Object", "Array", "String", "Number", "JSON",
  "console", "global", "processColor", "convertToRGBA", "isColor", "makeMutable",
  "measure", "scrollTo", "setGestureState", "dispatchCommand", "getRelativeCoords",
]);

function arquivos(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) arquivos(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

let achados = 0;
let nWorklets = 0;
for (const file of [...arquivos("app"), ...arquivos("src")]) {
  let code;
  try {
    code = babel.transformFileSync(file, {
      cwd: process.cwd(),
      filename: file,
      babelrc: true,
      configFile: "./babel.config.js",
      caller: { name: "metro", platform: "android", supportsStaticESM: false },
    }).code;
  } catch {
    continue;
  }
  // nomes que o plugin workletizou neste arquivo: "corSaude_MonitorVitalTsx1"
  // → o prefixo antes de "_<Arquivo>Tsx<n>" é o nome original da função.
  const jaWorklets = new Set();
  for (const m of code.matchAll(/code:"function ([A-Za-z0-9_$]+?)_[A-Za-z0-9]+Tsx?\d+\(/g)) {
    jaWorklets.add(m[1]);
  }

  // cada worklet virou: code:"function NOME(args){const{a,b}=this.__closure; ...}"
  for (const m of code.matchAll(/code:"((?:[^"\\]|\\.)*)"/g)) {
    const corpo = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    const nome = (corpo.match(/^function ([A-Za-z0-9_$]+)/) || [])[1];
    if (!nome) continue;
    nWorklets++;
    const fecho = (corpo.match(/const\s*\{([^}]*)\}\s*=\s*this\.__closure/) || [])[1];
    if (!fecho) continue;
    const nomes = fecho
      .split(",")
      .map((s) => s.split(":")[0].trim())
      .filter(Boolean);
    for (const id of nomes) {
      if (SEGURAS.has(id) || jaWorklets.has(id)) continue;
      // o identificador é INVOCADO dentro do worklet? (id( ... )
      const invocado = new RegExp(`\\b${id.replace(/\$/g, "\\$")}\\s*\\(`).test(corpo);
      if (invocado) {
        console.log(`⚠️  ${file}\n    worklet "${nome}" chama "${id}()" capturado do closure`);
        achados++;
      }
    }
  }
}
console.log(`\n${nWorklets} worklets analisados · ${achados} chamada(s) suspeita(s)`);
process.exit(achados > 0 ? 1 : 0);
