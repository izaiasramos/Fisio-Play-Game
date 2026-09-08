/**
 * Verificação da persistência das fotos do perfil.
 *
 * O bug que originou isto: avatar e "momentos" em base64 eram gravados na MESMA
 * chave do AsyncStorage que o resto do perfil. No Android cada registro é lido
 * por um CursorWindow do SQLite, com teto de ~2 MB POR LINHA — com poucas fotos
 * a linha estourava e a LEITURA falhava. Como o `persist` do zustand engole o
 * erro de hidratação, o app abria com o perfil zerado e as fotos "desapareciam"
 * sem aviso.
 *
 * O armazém falso abaixo reproduz esse teto: gravar sempre funciona, mas LER uma
 * linha grande demais estoura — igual ao aparelho. Assim o cenário do bug fica
 * coberto sem precisar de celular.
 *
 * Rodar:  npx tsx scripts/verificar-perfil.ts
 */
import {
  type Armazem,
  LIMITE_FOTO_BYTES,
  MAX_MOMENTOS,
  apagarMomento,
  carregarFotos,
  definirArmazem,
  limparFotos,
  migrarFotosLegado,
  salvarAvatar,
  salvarMomento,
} from "../src/lib/fotosPerfil";

/** Teto de uma linha no Android (CursorWindow). */
const LIMITE_LINHA = 2 * 1024 * 1024;

class LinhaGrandeDemais extends Error {
  constructor(chave: string, bytes: number) {
    super(`Row too big to fit into CursorWindow: ${chave} tem ${bytes} bytes`);
  }
}

/** AsyncStorage falso que imita o limite de leitura por linha do Android. */
function criarArmazemFake() {
  const dados = new Map<string, string>();
  const fake: Armazem = {
    async getItem(chave) {
      const v = dados.get(chave);
      if (v === undefined) return null;
      // é na LEITURA que o Android estoura, não na gravação
      if (v.length > LIMITE_LINHA) throw new LinhaGrandeDemais(chave, v.length);
      return v;
    },
    async setItem(chave, valor) {
      dados.set(chave, valor);
    },
    async removeItem(chave) {
      dados.delete(chave);
    },
  };
  return { fake, dados };
}

/** Foto falsa com tamanho controlado, no formato data URI. */
function fotoFalsa(bytes: number): string {
  const cabecalho = "data:image/jpeg;base64,";
  return cabecalho + "A".repeat(Math.max(0, bytes - cabecalho.length));
}

const FOTO_TIPICA = 300_000; // ~300 KB, foto de celular em quality 0.5

let falhas = 0;
function checar(condicao: boolean, descricao: string) {
  if (condicao) {
    console.log(`  ✓ ${descricao}`);
  } else {
    console.error(`  ❌ ${descricao}`);
    falhas += 1;
  }
}

/** Reinstala um armazém limpo; devolve o armazém e o mapa cru para inspeção. */
function reiniciar() {
  const { fake, dados } = criarArmazemFake();
  definirArmazem(fake);
  return { fake, dados };
}

async function cenarioBugAntigo() {
  console.log("\n1) o formato ANTIGO (tudo numa chave) realmente quebra");
  const { fake, dados } = reiniciar();

  // reproduz o que o persist gravava antes: perfil + avatar + 8 momentos juntos
  const blobAntigo = JSON.stringify({
    state: {
      nome: "Luuh",
      corTema: "#22D3A7",
      avatarUri: fotoFalsa(FOTO_TIPICA),
      momentos: Array.from({ length: MAX_MOMENTOS }, () => fotoFalsa(FOTO_TIPICA)),
    },
    version: 1,
  });
  dados.set("fisioplay-perfil", blobAntigo);

  console.log(`     a linha única tem ${(blobAntigo.length / 1024 / 1024).toFixed(2)} MB`);
  checar(blobAntigo.length > LIMITE_LINHA, "avatar + 8 momentos passam do teto de 2 MB por linha");

  let estourou = false;
  try {
    await fake.getItem("fisioplay-perfil");
  } catch (e) {
    estourou = e instanceof LinhaGrandeDemais;
  }
  checar(estourou, "ler essa linha estoura — era daí que vinha o perfil zerado");
}

async function cenarioFormatoNovo() {
  console.log("\n2) o formato NOVO (uma chave por foto) sobrevive ao mesmo volume");
  void reiniciar();

  const avatar = fotoFalsa(FOTO_TIPICA);
  checar((await salvarAvatar(avatar)).ok, "avatar gravado");

  const ids: string[] = [];
  for (let i = 0; i < MAX_MOMENTOS; i++) {
    const res = await salvarMomento(fotoFalsa(FOTO_TIPICA));
    if (res.ok && res.id !== undefined) ids.push(res.id);
  }
  checar(ids.length === MAX_MOMENTOS, `${MAX_MOMENTOS} momentos gravados`);

  // o ponto do teste: reabrir o app e achar tudo lá
  const lido = await carregarFotos();
  checar(lido.avatarUri === avatar, "avatar sobreviveu ao reabrir");
  checar(lido.momentos.length === MAX_MOMENTOS, "todos os momentos sobreviveram ao reabrir");
  checar(
    lido.momentos.every((m, i) => m.id === ids[i]),
    "a ordem dos momentos foi preservada"
  );
}

async function cenarioFotoGrande() {
  console.log("\n3) foto individual acima do orçamento é recusada, não guardada pela metade");
  void reiniciar();

  const gigante = fotoFalsa(LIMITE_FOTO_BYTES + 1);
  const res = await salvarAvatar(gigante);
  checar(!res.ok && res.motivo === "grande", "salvarAvatar recusa com motivo 'grande'");
  checar((await carregarFotos()).avatarUri === null, "nada foi gravado na recusa");

  const resM = await salvarMomento(gigante);
  checar(!resM.ok && resM.motivo === "grande", "salvarMomento recusa com motivo 'grande'");
  checar((await carregarFotos()).momentos.length === 0, "índice não ficou com momento fantasma");
}

async function cenarioRemocao() {
  console.log("\n4) remover um momento não afeta os outros");
  void reiniciar();

  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await salvarMomento(fotoFalsa(1000 + i));
    if (r.ok && r.id !== undefined) ids.push(r.id);
  }

  await apagarMomento(ids[1]);
  const { momentos } = await carregarFotos();
  checar(momentos.length === 2, "sobraram 2 momentos");
  checar(
    momentos[0].id === ids[0] && momentos[1].id === ids[2],
    "os que sobraram são os certos, na ordem certa"
  );
}

async function cenarioIndiceOrfao() {
  console.log("\n5) índice apontando para foto inexistente se autocorrige");
  const { dados } = reiniciar();

  const a = await salvarMomento(fotoFalsa(1000));
  const b = await salvarMomento(fotoFalsa(1000));
  if (!a.ok || !b.ok || a.id === undefined || b.id === undefined) {
    console.error("  ❌ preparação falhou");
    falhas += 1;
    return;
  }

  // some com o dado de uma foto sem passar pelo índice
  dados.delete(`fisioplay-foto:momento-${a.id}`);

  const { momentos } = await carregarFotos();
  checar(momentos.length === 1 && momentos[0].id === b.id, "a foto órfã foi descartada");

  const indiceCru = dados.get("fisioplay-foto:indice");
  checar(
    indiceCru !== undefined && !indiceCru.includes(a.id),
    "o índice foi reescrito sem o id órfão"
  );
}

async function cenarioMigracao() {
  console.log("\n6) migração do formato antigo para uma chave por foto");
  void reiniciar();

  const avatar = fotoFalsa(FOTO_TIPICA);
  const antigos = Array.from({ length: 3 }, (_, i) => fotoFalsa(FOTO_TIPICA + i));

  const n = await migrarFotosLegado({ avatarUri: avatar, momentos: antigos });
  checar(n === 4, "migrou 1 avatar + 3 momentos");

  const { avatarUri, momentos } = await carregarFotos();
  checar(avatarUri === avatar, "avatar migrado é legível");
  checar(momentos.length === 3, "momentos migrados são legíveis");
  checar(
    momentos.map((m) => m.uri).join("|") === antigos.join("|"),
    "conteúdo e ordem dos momentos preservados na migração"
  );

  // lixo no formato antigo não deve derrubar a migração
  void reiniciar();
  const n2 = await migrarFotosLegado({ avatarUri: null, momentos: "não é lista" });
  checar(n2 === 0, "formato antigo inválido migra 0 sem estourar");

  // respeita o teto de momentos
  void reiniciar();
  const n3 = await migrarFotosLegado({
    momentos: Array.from({ length: MAX_MOMENTOS + 5 }, () => fotoFalsa(1000)),
  });
  checar(n3 === MAX_MOMENTOS, `migração respeita o teto de ${MAX_MOMENTOS} momentos`);
}

async function cenarioLimpeza() {
  console.log("\n7) apagar personalização remove tudo");
  const { dados } = reiniciar();

  await salvarAvatar(fotoFalsa(1000));
  await salvarMomento(fotoFalsa(1000));
  await salvarMomento(fotoFalsa(1000));

  await limparFotos();
  const { avatarUri, momentos } = await carregarFotos();
  checar(avatarUri === null && momentos.length === 0, "perfil sem avatar nem momentos");
  checar(
    [...dados.keys()].filter((k) => k.startsWith("fisioplay-foto:")).length === 0,
    "nenhuma chave de foto sobrou no armazenamento"
  );
}

async function main() {
  await cenarioBugAntigo();
  await cenarioFormatoNovo();
  await cenarioFotoGrande();
  await cenarioRemocao();
  await cenarioIndiceOrfao();
  await cenarioMigracao();
  await cenarioLimpeza();

  if (falhas > 0) {
    console.error(`\n❌ ${falhas} verificação(ões) falharam.`);
    process.exit(1);
  }
  console.log(
    `\n✅ Persistência do perfil OK — fotos em chaves próprias sobrevivem a ` +
      `${MAX_MOMENTOS} momentos + avatar, orçamento de ${(LIMITE_FOTO_BYTES / 1024 / 1024).toFixed(2)} MB ` +
      `por foto respeitado, migração do formato antigo validada.`
  );
}

main();
