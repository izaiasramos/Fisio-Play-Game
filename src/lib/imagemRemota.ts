import Constants from "expo-constants";
import type { ImageSourcePropType } from "react-native";

const VERSAO = Constants.expoConfig?.version ?? "1.0.0";

/**
 * User-Agent enviado nas imagens do Wikimedia Commons.
 *
 * Desde 2025 a Wikimedia recusa (HTTP 403 "Please set a user-agent and respect
 * our robot policy") requisições com User-Agent genérico ou ausente — e é
 * exatamente isso que o carregador de imagens do React Native manda por padrão
 * no Android (`okhttp/x.y.z`). Sem este header as ilustrações vinham em branco.
 *
 * A política pede um UA descritivo com uma forma de contato:
 * https://foundation.wikimedia.org/wiki/Policy:Wikimedia_Foundation_User-Agent_Policy
 *
 * TODO: trocar a URL pelo e-mail/site de contato definitivo do app ao publicar.
 */
export const USER_AGENT = `FisioPlay/${VERSAO} (app educativo de fisioterapia; https://expo.dev/@izaiasr/fisioplay)`;

/**
 * Monta a source de uma imagem vinda da internet já com o User-Agent.
 * Use sempre isto no lugar de `{{ uri }}` para imagens de acervo remoto.
 */
export function fonteRemota(uri: string | undefined): ImageSourcePropType {
  return { uri, headers: { "User-Agent": USER_AGENT } };
}
