import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { calcularRedimensionamento, reduzirAteCaber } from "./reduzirFoto";

type Opcoes = {
  /** proporção do recorte (ex.: [1,1] avatar, [3,4] retrato) */
  aspecto?: [number, number];
};

/**
 * Resultado de escolher uma foto. Os três casos são distintos de propósito:
 * "falha" não pode se disfarçar de sucesso, senão gravaríamos algo que não
 * seria lido de volta — foi assim que as fotos "sumiam" antes.
 */
export type FotoEscolhida =
  | { estado: "ok"; uri: string }
  | { estado: "cancelado" }
  | { estado: "falha" };

/**
 * Abre a galeria, **reduz** a foto escolhida e devolve como data URI base64.
 *
 * Guardar em base64 mantém a personalização 100% offline e persistente em
 * qualquer plataforma via AsyncStorage — nenhuma foto é enviada. A redução
 * (`expo-image-manipulator`) acontece antes de gravar: sem ela, o base64 de uma
 * foto de celular estoura o orçamento por foto e a gravação era recusada.
 *
 * Note que pedimos `base64: false` ao picker: o base64 que interessa é o da
 * imagem já reduzida, e pedir o da original só gastaria memória à toa.
 */
export async function escolherFoto({ aspecto = [1, 1] }: Opcoes = {}): Promise<FotoEscolhida> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: aspecto,
    // 1 aqui: entregamos a melhor origem possível ao manipulador, que é quem
    // controla tamanho e compressão do que realmente será gravado.
    quality: 1,
    base64: false,
  });

  if (resultado.canceled || !resultado.assets?.length) return { estado: "cancelado" };

  const asset = resultado.assets[0];
  if (!asset.uri) return { estado: "falha" };

  try {
    // com allowsEditing, width/height já são os do recorte
    const alvo = calcularRedimensionamento(asset.width, asset.height);

    let contexto = ImageManipulator.manipulate(asset.uri);
    if (alvo !== null) contexto = contexto.resize(alvo);

    // renderiza UMA vez e reaproveita: os degraus de compressão só refazem o
    // save, não o redimensionamento
    const imagem = await contexto.renderAsync();

    const reducao = await reduzirAteCaber(async (compress) => {
      // Erro num degrau não derruba a redução inteira: devolvendo null, a
      // escada segue e um resultado já obtido antes não é perdido.
      try {
        const salvo = await imagem.saveAsync({
          base64: true,
          compress,
          format: SaveFormat.JPEG,
        });
        return salvo.base64 ? `data:image/jpeg;base64,${salvo.base64}` : null;
      } catch (e) {
        console.warn(`[escolherFoto] falha ao salvar com compress=${compress}:`, e);
        return null;
      }
    });

    if (reducao.uri === null) return { estado: "falha" };

    if (reducao.aindaGrande) {
      console.warn(
        `[escolherFoto] foto ainda acima do orçamento após ${reducao.tentativas} tentativa(s).`
      );
    }

    return { estado: "ok", uri: reducao.uri };
  } catch (e) {
    console.warn("[escolherFoto] falha ao processar a foto:", e);
    return { estado: "falha" };
  }
}
