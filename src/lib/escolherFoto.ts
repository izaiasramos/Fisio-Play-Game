import * as ImagePicker from "expo-image-picker";

type Opcoes = {
  /** proporção do recorte (ex.: [1,1] avatar, [3,4] retrato) */
  aspecto?: [number, number];
};

/**
 * Abre a galeria do aparelho e devolve a foto escolhida como **data URI base64**.
 * Guardar em base64 mantém a personalização 100% offline e persistente em
 * qualquer plataforma (web + nativo) via AsyncStorage — nenhuma foto é enviada.
 * Retorna `null` se a Isa cancelar.
 */
export async function escolherFoto({ aspecto = [1, 1] }: Opcoes = {}): Promise<string | null> {
  const resultado = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: aspecto,
    quality: 0.5,
    base64: true,
  });

  if (resultado.canceled || !resultado.assets?.length) return null;

  const asset = resultado.assets[0];
  if (asset.base64) {
    const tipo = asset.mimeType ?? "image/jpeg";
    return `data:${tipo};base64,${asset.base64}`;
  }
  // fallback (algumas plataformas web já devolvem uma data/blob URL em uri)
  return asset.uri ?? null;
}
