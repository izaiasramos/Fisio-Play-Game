import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";
import { usePerfil } from "@/store/usePerfil";
import { colors } from "@/theme/tokens";

const TORCIDAS = [
  "Você consegue! 💪",
  "Orgulho da profissão 🩺",
  "Mais uma rodada e você arrasa ✨",
  "Foco no estágio, futura fisio! 🔥",
  "Cada ponto conta 💜",
  "Bora fixar esse conteúdo! 🚀",
];

/**
 * Faixa "torcida": as fotos-momento da Isa passam em loop com uma frase de
 * incentivo. Aparece na home só quando há fotos cadastradas no perfil.
 */
export function Torcida() {
  const { nome, frase, corTema, momentos } = usePerfil();
  const [i, setI] = useState(0);

  useEffect(() => {
    if (momentos.length < 2) return;
    const t = setInterval(() => setI((x) => x + 1), 3800);
    return () => clearInterval(t);
  }, [momentos.length]);

  if (!momentos.length) return null;

  const foto = momentos[i % momentos.length].uri;
  const incentivo = frase?.trim() || TORCIDAS[i % TORCIDAS.length];
  const quem = nome?.trim() || "Luuh";
  const saudacao = `Vai, ${quem}!`;

  return (
    <MotiView
      from={{ opacity: 0, translateY: 14 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 500, delay: 200 }}
    >
      <View
        style={[styles.card, { borderColor: corTema + "55", shadowColor: corTema }]}
        className="rounded-3xl p-5 mt-4 flex-row items-center"
      >
        {/* foto redonda que troca em loop (espelha a medalha de nível) */}
        <View style={[styles.fotoWrap, { borderColor: corTema, shadowColor: corTema }]}>
          <MotiView
            key={`${i}-${foto.slice(-10)}`}
            from={{ opacity: 0, scale: 1.08 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "timing", duration: 550 }}
            style={StyleSheet.absoluteFill}
          >
            <Image source={{ uri: foto }} style={styles.foto} />
          </MotiView>
        </View>

        <View className="flex-1 ml-5">
          {/* selo */}
          <View style={[styles.selo, { backgroundColor: corTema + "22" }]} className="flex-row items-center self-start">
            <MotiView
              from={{ opacity: 0.4, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.15 }}
              transition={{ loop: true, type: "timing", duration: 1100 }}
              style={[styles.dot, { backgroundColor: corTema }]}
            />
            <Text style={{ color: corTema }} className="text-[10px] font-bold tracking-[2px] uppercase">
              Sua torcida
            </Text>
          </View>

          <Text className="text-ink text-xl font-black mt-1.5">{saudacao}</Text>
          <MotiView
            key={`f-${i}`}
            from={{ opacity: 0, translateX: 8 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: "timing", duration: 450 }}
          >
            <Text className="text-inkSoft text-[13px] mt-0.5 leading-4">{incentivo}</Text>
          </MotiView>
        </View>
      </View>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 5,
  },
  fotoWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: colors.surface,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
  },
  foto: { width: "100%", height: "100%" },
  selo: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
});
