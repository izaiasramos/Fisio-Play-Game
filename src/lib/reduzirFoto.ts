/**
 * Regras de redução das fotos do perfil.
 *
 * Antes, a foto ia para o armazenamento no tamanho que saía da galeria: base64
 * de foto de celular passa fácil do orçamento por foto e o app tinha que recusar
 * ("Foto muito grande"). Aqui a foto é reduzida ANTES de gravar, então a recusa
 * deixa de ser o caminho comum.
 *
 * Este módulo é só aritmética e orquestração — nada de módulo nativo — para a
 * lógica ser testável fora do app (ver `scripts/verificar-perfil.ts`). Quem
 * conversa com o `expo-image-manipulator` é o `escolherFoto.ts`.
 */
import { LIMITE_FOTO_BYTES, tamanhoFoto } from "./fotosPerfil";

/**
 * Maior lado que uma foto do perfil precisa ter, em pixels.
 *
 * As fotos aparecem num avatar de 168 px e em tiles pequenos da torcida; 1024
 * já dá folga de sobra para telas de alta densidade e derruba muito o peso.
 */
export const TETO_LADO = 1024;

/**
 * Níveis de compressão tentados, do melhor para o pior. A primeira que couber
 * no orçamento é a escolhida, então na prática quase sempre para na primeira.
 */
export const ESCADA_QUALIDADE = [0.6, 0.45, 0.3, 0.2] as const;

/**
 * Qual lado fixar no redimensionamento. Fixamos só um: o manipulador calcula o
 * outro preservando a proporção.
 */
export type Redimensionamento = { width: number } | { height: number };

/**
 * Decide o redimensionamento a partir das dimensões originais.
 *
 * Devolve `null` quando não há o que fazer: foto já pequena, ou dimensões
 * desconhecidas. Nunca amplia — ampliar só geraria bytes à toa.
 */
export function calcularRedimensionamento(
  largura: number | undefined,
  altura: number | undefined,
  teto: number = TETO_LADO
): Redimensionamento | null {
  const l = Number(largura);
  const a = Number(altura);

  // dimensões desconhecidas: não arrisca (ampliar pioraria), a compressão resolve
  if (!Number.isFinite(l) || !Number.isFinite(a) || l <= 0 || a <= 0) return null;

  if (Math.max(l, a) <= teto) return null;

  // fixa o MAIOR lado no teto, para o menor caber com folga
  return l >= a ? { width: teto } : { height: teto };
}

/** Grava a foto com a compressão pedida e devolve o data URI (ou null se falhar). */
export type SalvarComQualidade = (compress: number) => Promise<string | null>;

export type ResultadoReducao = {
  /** data URI final, ou null se nenhuma tentativa produziu imagem */
  uri: string | null;
  /** compressão usada na tentativa escolhida */
  qualidade: number | null;
  /** quantas tentativas foram feitas */
  tentativas: number;
  /** true se nem a última tentativa caberia no orçamento */
  aindaGrande: boolean;
};

/**
 * Desce a escada de compressão até a foto caber no orçamento.
 *
 * Se nem o degrau mais agressivo couber, devolve a menor imagem que conseguiu
 * gerar e marca `aindaGrande` — quem chama decide o que dizer ao usuário, em vez
 * de gravar às escondidas algo que não seria lido de volta.
 */
export async function reduzirAteCaber(
  salvar: SalvarComQualidade,
  opcoes: { escada?: readonly number[]; limiteBytes?: number } = {}
): Promise<ResultadoReducao> {
  const escada = opcoes.escada ?? ESCADA_QUALIDADE;
  const limiteBytes = opcoes.limiteBytes ?? LIMITE_FOTO_BYTES;

  let ultima: string | null = null;
  let ultimaQualidade: number | null = null;
  let tentativas = 0;

  for (const compress of escada) {
    tentativas += 1;
    const uri = await salvar(compress);
    if (uri === null) continue;

    ultima = uri;
    ultimaQualidade = compress;

    if (tamanhoFoto(uri) <= limiteBytes) {
      return { uri, qualidade: compress, tentativas, aindaGrande: false };
    }
  }

  return {
    uri: ultima,
    qualidade: ultimaQualidade,
    tentativas,
    aindaGrande: ultima !== null,
  };
}
