import { useMemo } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MotiView } from "moti";
import { useProgresso } from "@/store/useProgresso";
import { carregarTrilha, type BancoTrilha } from "@/lib/loadTrilha";
import { temCasos } from "@/lib/loadCasos";
import { temTabuleiros } from "@/lib/loadMontar";
import { temPranchas } from "@/lib/loadPranchas";
import { gerarPergunta } from "@/lib/gerarQuiz";
import { FundoHalos } from "@/components/FundoHalos";
import { usePaddingRodape } from "@/lib/useRodape";
import { colors } from "@/theme/tokens";

type Jogo = {
  rota: "/jogo/quiz" | "/jogo/forca" | "/jogo/memoria" | "/jogo/colunas" | "/jogo/completar" | "/jogo/vf" | "/jogo/arrastar" | "/jogo/montar" | "/jogo/conduta";
  icone: string;
  nome: string;
  desc: string;
  cor: string;
};

const JOGOS: Jogo[] = [
  { rota: "/jogo/quiz", icone: "❓", nome: "Quiz", desc: "Definição → estrutura, contra o relógio", cor: colors.primary },
  { rota: "/jogo/forca", icone: "🔤", nome: "Forca", desc: "Descubra a estrutura pela dica, letra a letra", cor: colors.accent },
  { rota: "/jogo/completar", icone: "🧩", nome: "Complete a palavra", desc: "Preencha as letras que faltam pela dica", cor: "#38BDF8" },
  { rota: "/jogo/vf", icone: "⚖️", nome: "Verdadeiro ou Falso", desc: "A definição bate com o termo? Decida V ou F", cor: colors.success },
  { rota: "/jogo/memoria", icone: "🧠", nome: "Memória", desc: "Case cada estrutura com a sua definição", cor: "#C084FC" },
  { rota: "/jogo/colunas", icone: "🔗", nome: "Colunas A-B", desc: "Ligue cada termo à sua definição", cor: colors.warning },
];

/** Jogo extra, exibido só nas trilhas que têm banco de casos clínicos. */
const CONDUTA_JOGO: Jogo = {
  rota: "/jogo/conduta",
  icone: "🩺",
  nome: "Qual a conduta?",
  desc: "Mini-casos clínicos: escolha a conduta certa",
  cor: colors.error,
};

/** Jogo extra, exibido só nas trilhas que têm pranchas de anatomia. */
const ARRASTAR_JOGO: Jogo = {
  rota: "/jogo/arrastar",
  icone: "🦴",
  nome: "Arrastar na anatomia",
  desc: "Arraste cada nome até a estrutura certa",
  cor: "#F472B6",
};

/** Jogo extra, exibido só nas trilhas que têm regiões para montar. */
const MONTAR_JOGO: Jogo = {
  rota: "/jogo/montar",
  icone: "🧍",
  nome: "Montar o corpo",
  desc: "Leia o nome do osso e ponha no lugar dele",
  cor: "#FB923C",
};

export default function TrilhaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const trilhaId = id ?? "";
  const paddingRodape = usePaddingRodape();
  const pontos = useProgresso((s) => s.pontosPorTrilha[trilhaId] ?? 0);

  const banco = useMemo<BancoTrilha | null>(() => {
    try {
      return carregarTrilha(trilhaId);
    } catch {
      return null;
    }
  }, [trilhaId]);

  const previa = useMemo(() => (banco ? gerarPergunta(banco.itens) : null), [banco]);

  const jogos = useMemo<Jogo[]>(() => {
    const lista = [...JOGOS];
    if (temPranchas(trilhaId)) lista.push(ARRASTAR_JOGO);
    if (temTabuleiros(trilhaId)) lista.push(MONTAR_JOGO);
    if (temCasos(trilhaId)) lista.push(CONDUTA_JOGO);
    return lista;
  }, [trilhaId]);

  if (!banco) {
    return (
      <View className="flex-1 bg-bg px-6 pt-8">
        <Stack.Screen options={{ title: "Trilha" }} />
        <Text className="text-ink text-lg font-bold">Trilha não encontrada</Text>
        <Text className="text-muted mt-1">Nenhum banco de conteúdo para "{trilhaId}".</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: banco.trilha.nome }} />
      <FundoHalos />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 32, paddingBottom: paddingRodape }}
      >
        {/* cabeçalho da trilha */}
        <MotiView
          from={{ opacity: 0, translateY: 12 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: "timing", duration: 420 }}
          className="flex-row items-center"
        >
          <View
            style={[styles.icone, { backgroundColor: banco.trilha.cor, shadowColor: banco.trilha.cor }]}
            className="w-14 h-14 rounded-2xl items-center justify-center mr-4"
          >
            <Text className="text-3xl">{banco.trilha.icone}</Text>
          </View>
          <View className="flex-1">
            <Text className="text-2xl font-black text-ink">{banco.trilha.nome}</Text>
            <Text className="text-muted text-xs mt-0.5">
              {banco.itens.length} conceitos · {pontos} pontos seus
            </Text>
          </View>
        </MotiView>

        {/* prévia do quiz */}
        {previa && (
          <MotiView
            from={{ opacity: 0, translateY: 16 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: "timing", duration: 420, delay: 100 }}
          >
            <View style={styles.previa} className="rounded-2xl p-4 mt-6">
              <View className="flex-row items-center justify-between">
                <Text className="text-accent text-[10px] uppercase tracking-widest font-bold">
                  Prévia do Quiz
                </Text>
                <View className="bg-surface rounded-full px-2 py-0.5 border border-white/10">
                  <Text className="text-muted text-[9px] font-bold uppercase tracking-wide">
                    amostra
                  </Text>
                </View>
              </View>
              <Text className="text-ink mt-2 font-semibold">{previa.enunciado}</Text>
              <View pointerEvents="none" className="mt-3 gap-2 opacity-50">
                {previa.alternativas.map((alt, i) => (
                  <View key={i} className="bg-surface rounded-xl px-3 py-2">
                    <Text className="text-ink text-sm">
                      {String.fromCharCode(65 + i)}. {alt}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </MotiView>
        )}

        <Text className="text-ink text-lg font-bold mt-8 mb-1">Escolha um jogo</Text>

        {jogos.map((jogo, i) => (
          <MotiView
            key={jogo.rota}
            from={{ opacity: 0, translateY: 20, scale: 0.96 }}
            animate={{ opacity: 1, translateY: 0, scale: 1 }}
            transition={{ type: "timing", duration: 380, delay: 200 + i * 80 }}
          >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Jogar ${jogo.nome}. ${jogo.desc}`}
                onPress={() => router.push({ pathname: jogo.rota, params: { trilha: trilhaId } })}
                style={StyleSheet.flatten([styles.jogoCard, { shadowColor: jogo.cor, borderColor: jogo.cor + "55" }])}
                className="mt-3 rounded-2xl py-4 px-4 flex-row items-center active:opacity-80"
              >
                <View
                  style={[styles.jogoIcone, { backgroundColor: jogo.cor + "22", borderColor: jogo.cor + "66" }]}
                  className="w-12 h-12 rounded-2xl items-center justify-center mr-4 border"
                >
                  <Text className="text-2xl">{jogo.icone}</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-ink text-lg font-bold">{jogo.nome}</Text>
                  <Text className="text-muted text-xs mt-0.5">{jogo.desc}</Text>
                </View>
                <Text className="text-2xl ml-2" style={{ color: jogo.cor }}>›</Text>
              </Pressable>
          </MotiView>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  icone: {
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 10,
    elevation: 6,
  },
  previa: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(0,210,168,0.3)",
  },
  jogoCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 5,
  },
  jogoIcone: {
    shadowOffset: { width: 0, height: 0 },
  },
});
