import * as Haptics from "expo-haptics";
import { useAudioPlayer } from "expo-audio";
import somAcerto from "../../assets/sounds/acerto.wav";
import somErro from "../../assets/sounds/erro.wav";

/**
 * Feedback multissensorial de acerto/erro: haptic + som curto.
 * As animações visuais (confete/shake) ficam a cargo da tela.
 */
export function useFeedback() {
  const playerAcerto = useAudioPlayer(somAcerto);
  const playerErro = useAudioPlayer(somErro);

  const tocar = (player: ReturnType<typeof useAudioPlayer>) => {
    try {
      player.seekTo(0);
      player.play();
    } catch {
      // som é reforço, nunca deve quebrar o jogo
    }
  };

  const acerto = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    tocar(playerAcerto);
  };

  const erro = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    tocar(playerErro);
  };

  return { acerto, erro };
}
