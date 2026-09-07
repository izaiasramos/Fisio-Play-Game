import { MotiView } from "moti";
import { Stack, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useProgresso } from "@/store/useProgresso";
import { usePerfil } from "@/store/usePerfil";
import { listarTrilhas } from "@/lib/loadTrilha";
import { nivelDoXp, progressoNoNivel, xpParaProximoNivel } from "@/games/gamificacao";
import { FundoHalos } from "@/components/FundoHalos";
import { Torcida } from "@/components/Torcida";
import { usePaddingRodape } from "@/lib/useRodape";
import { colors } from "@/theme/tokens";

export default function Home() {
  const insets = useSafeAreaInsets();
  const paddingRodape = usePaddingRodape();
  const router = useRouter();
  const xp = useProgresso((s) => s.xp);
  const streak = useProgresso((s) => s.streakDias);
  const pontosPorTrilha = useProgresso((s) => s.pontosPorTrilha);

  const nome = usePerfil((s) => s.nome);
  const avatarUri = usePerfil((s) => s.avatarUri);
  const corTema = usePerfil((s) => s.corTema);

  const nivel = nivelDoXp(xp);
  const progresso = progressoNoNivel(xp) * 100;
  const faltam = xpParaProximoNivel(xp);

  const trilhas = listarTrilhas();
  const pontosDe = (id: string) => pontosPorTrilha[id] ?? 0;
  const maxPontos = Math.max(1, ...trilhas.map((t) => pontosDe(t.id)));
  const totalPontos = trilhas.reduce((acc, t) => acc + pontosDe(t.id), 0);

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ headerShown: false }} />
      <FundoHalos />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: paddingRodape, paddingHorizontal: 24 }}
      >
        {/* hero */}
        <MotiView
          from={{ opacity: 0, translateY: 14 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 500 }}
        >
          <Text className="text-accent text-[11px] font-bold tracking-[4px] uppercase">
            Fisioterapia gamificada
          </Text>
          <Text className="text-5xl font-black text-ink mt-1">FisioPlay</Text>

          {/* linha de perfil: avatar + saudação (toca para personalizar) */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Meu perfil"
              onPress={() => router.push("/perfil")}
              className="flex-row items-center mt-4 active:opacity-80"
            >
              <View style={StyleSheet.flatten([styles.heroAvatar, { borderColor: corTema, shadowColor: corTema }])}>
                {avatarUri ? (
                  <Image source={{ uri: avatarUri }} style={styles.heroAvatarImg} />
                ) : (
                  <MotiView
                    from={{ scale: 0.9, opacity: 0.7 }}
                    animate={{ scale: 1.06, opacity: 1 }}
                    transition={{ loop: true, type: "timing", duration: 1400 }}
                    className="items-center justify-center flex-1"
                  >
                    <Text className="text-2xl">✨</Text>
                  </MotiView>
                )}
              </View>

              <View className="flex-1 ml-4">
                <Text className="text-ink text-lg font-black">
                  {`Oi, ${nome?.trim() || "Luuh"} 👋`}
                </Text>
                <Text className="text-muted text-[13px] mt-0.5">
                  {avatarUri ? "bom estudo, futura fisio! 💜" : "toque para personalizar com suas fotos ✨"}
                </Text>
              </View>

              <Text className="text-muted text-2xl ml-2">›</Text>
            </Pressable>
        </MotiView>

        {/* HUD de nível */}
        <MotiView
          from={{ opacity: 0, translateY: 16 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 500, delay: 120 }}
        >
          <View style={styles.hud} className="rounded-3xl p-5 mt-8 flex-row items-center">
            {/* medalha de nível com glow */}
            <View style={styles.nivelRing}>
              <Text className="text-accent text-[9px] font-bold tracking-widest">NÍVEL</Text>
              <Text className="text-ink text-2xl font-black leading-6">{nivel}</Text>
            </View>

            <View className="flex-1 ml-5">
              <View className="flex-row justify-between items-center">
                <Text className="text-warning font-bold">🔥 {streak} dias</Text>
                <Text className="text-muted text-xs">{xp} XP</Text>
              </View>
              <View className="h-2.5 bg-surface rounded-full mt-2 overflow-hidden">
                <MotiView
                  from={{ width: "0%" }}
                  animate={{ width: `${progresso}%` }}
                  transition={{ type: "timing", duration: 700, delay: 300 }}
                  style={styles.xpBar}
                />
              </View>
              <Text className="text-muted text-[11px] mt-2">
                faltam {faltam} XP para o nível {nivel + 1}
              </Text>
            </View>
          </View>
        </MotiView>

        {/* torcida da Luuh (só aparece quando há fotos no perfil) */}
        <Torcida />

        {/* trilhas */}
        <View className="flex-row justify-between items-end mt-8 mb-1">
          <Text className="text-ink text-lg font-bold">Suas trilhas</Text>
          <Text className="text-muted text-xs">{totalPontos} pts no total</Text>
        </View>

        {trilhas.map((trilha, i) => {
          const pontos = pontosDe(trilha.id);
          const barra = (pontos / maxPontos) * 100;
          const lider = pontos > 0 && pontos === maxPontos;
          return (
            <MotiView
              key={trilha.id}
              from={{ opacity: 0, translateY: 22, scale: 0.96 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              transition={{ type: "timing", duration: 420, delay: 240 + i * 80 }}
            >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Trilha ${trilha.nome}, ${pontos} pontos`}
                  onPress={() => router.push(`/trilha/${trilha.id}`)}
                  style={StyleSheet.flatten([
                    styles.trilhaCard,
                    { shadowColor: trilha.cor, borderColor: trilha.cor + "55" },
                  ])}
                  className="mt-4 rounded-2xl py-4 px-4 flex-row items-center active:opacity-80"
                >
                  <View
                    style={[styles.icone, { backgroundColor: trilha.cor, shadowColor: trilha.cor }]}
                    className="w-12 h-12 rounded-2xl items-center justify-center mr-4"
                  >
                    <Text className="text-2xl">{trilha.icone}</Text>
                  </View>

                  <View className="flex-1">
                    <View className="flex-row items-center">
                      <Text className="text-ink text-base font-bold">{trilha.nome}</Text>
                      {lider && (
                        <View className="ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.accent + "22" }}>
                          <Text className="text-accent text-[9px] font-bold">TOP</Text>
                        </View>
                      )}
                    </View>
                    <Text className="text-muted text-[11px] mt-0.5">{pontos} pontos seus</Text>
                    {/* mini-barra de desempenho por trilha (força/fraqueza) */}
                    <View className="h-1.5 bg-surface rounded-full mt-2 overflow-hidden">
                      <View
                        className="h-1.5 rounded-full"
                        style={{ width: `${barra}%`, backgroundColor: trilha.cor }}
                      />
                    </View>
                  </View>

                  <Text className="text-muted text-2xl ml-3">›</Text>
                </Pressable>
            </MotiView>
          );
        })}

        {/* rodapé: aviso educativo + link para créditos/licenças */}
        <MotiView
          from={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ type: "timing", duration: 400, delay: 600 }}
        >
          <Text className="text-muted text-[11px] text-center mt-10 leading-4">
            Conteúdo educativo — não substitui a orientação de um profissional de saúde.
          </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sobre e créditos"
              onPress={() => router.push("/sobre")}
              className="mt-2 items-center active:opacity-70"
            >
              <Text className="text-accent text-xs font-semibold">Sobre & créditos ›</Text>
            </Pressable>
        </MotiView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  heroAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 6,
  },
  heroAvatarImg: { width: "100%", height: "100%" },
  hud: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(108,92,231,0.35)",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 6,
  },
  nivelRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,210,168,0.08)",
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 12,
  },
  xpBar: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.accent,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  trilhaCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 5,
  },
  icone: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
});
