/**
 * Verificação da lógica da Forca (Fase 4): simula partidas SEM UI e confere
 * mascaramento, contagem de erros, vitória/derrota e pontuação.
 *
 * Rodar:  npx tsx scripts/verificar-forca.ts
 */
import { carregarTrilha } from "../src/lib/loadTrilha";
import {
  MAX_ERROS,
  PONTOS_BASE_FORCA,
  PONTOS_MIN_FORCA,
  calcularPontosForca,
  contarErros,
  escolherItemForca,
  letrasParaAdivinhar,
  mascarar,
  normalizar,
  perdeu,
  venceu,
} from "../src/games/forca";

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

let falhas = 0;
function checar(cond: boolean, msg: string) {
  console.log(`${cond ? "✓" : "✗"} ${msg}`);
  if (!cond) falhas++;
}

function main() {
  const banco = carregarTrilha("anatomia");
  const rng = lcg(7);

  // 1) Sorteio válido e com letras suficientes
  const item = escolherItemForca(banco.itens, rng);
  const alvo = letrasParaAdivinhar(item.termo);
  checar(alvo.size >= 3, `termo sorteado "${item.termo}" tem ${alvo.size} letras distintas (>=3)`);

  // 2) Vitória: chutar todas as letras corretas → 0 erros, pontos = base
  const soCertas = new Set(alvo);
  checar(venceu(item.termo, soCertas), "venceu ao chutar todas as letras do termo");
  checar(contarErros(item.termo, soCertas) === 0, "zero erros no caminho perfeito");
  checar(
    calcularPontosForca(true, 0) === PONTOS_BASE_FORCA,
    `vitória sem erro vale ${PONTOS_BASE_FORCA} pontos`
  );

  // 3) Derrota: MAX_ERROS letras inexistentes (dígitos normalizados nunca estão no termo)
  const erradas = new Set<string>();
  const naoLetras = "0123456789".split(""); // garantidamente fora de qualquer termo
  // usa letras reais ausentes do termo p/ ser realista
  for (const c of "QWXYZKJ".split("")) {
    if (!alvo.has(normalizar(c))) erradas.add(normalizar(c));
    if (erradas.size >= MAX_ERROS) break;
  }
  for (const d of naoLetras) {
    if (erradas.size >= MAX_ERROS) break;
    erradas.add(d);
  }
  checar(perdeu(item.termo, erradas), `perdeu ao acumular ${MAX_ERROS} erros`);
  checar(calcularPontosForca(false, MAX_ERROS) === 0, "derrota vale 0 pontos");

  // 4) Piso de pontos: muitos erros mas venceu → PONTOS_MIN_FORCA
  checar(
    calcularPontosForca(true, 100) === PONTOS_MIN_FORCA,
    `vitória com muitos erros respeita o piso de ${PONTOS_MIN_FORCA}`
  );

  // 5) Máscara: espaços revelados, letras não-chutadas escondidas
  const semChute = new Set<string>();
  const cels = mascarar(item.termo, semChute);
  const espacosOk = cels.filter((c) => !c.ehLetra).every((c) => c.revelado);
  const letrasEscondidas = cels.filter((c) => c.ehLetra).every((c) => !c.revelado);
  checar(espacosOk, "não-letras (espaço/hífen) já vêm reveladas");
  checar(letrasEscondidas, "letras começam escondidas antes de qualquer chute");

  // 6) Acentos: chutar 'A' revela 'Á'/'Â' etc.
  const comAcento = banco.itens.find((i) => /[áàâãéêíóôõúç]/i.test(i.termo));
  if (comAcento) {
    const primeira = [...comAcento.termo].find((c) => /[a-zà-ú]/i.test(c))!;
    const chute = new Set([normalizar(primeira)]);
    const revela = mascarar(comAcento.termo, chute).some((c) => c.revelado && c.ehLetra);
    checar(revela, `chute normalizado revela letra acentuada em "${comAcento.termo}"`);
  }

  console.log(falhas === 0 ? "\n✅ Lógica da Forca consistente." : `\n❌ ${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
}

main();
