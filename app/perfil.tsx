import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack } from "expo-router";
import { MotiView } from "moti";
import { FundoHalos } from "@/components/FundoHalos";
import { escolherFoto } from "@/lib/escolherFoto";
import type { ResultadoFoto } from "@/lib/fotosPerfil";
import { usePaddingRodape } from "@/lib/useRodape";
import { CORES_TEMA, MAX_MOMENTOS, usePerfil } from "@/store/usePerfil";
import { colors } from "@/theme/tokens";

export default function Perfil() {
  const paddingRodape = usePaddingRodape(40);
  const {
    nome,
    frase,
    avatarUri,
    corTema,
    momentos,
    setNome,
    setFrase,
    setAvatar,
    setCorTema,
    addMomento,
    removeMomento,
    reset,
  } = usePerfil();

  const [ocupado, setOcupado] = useState(false);

  /**
   * Avisa quando a foto não pôde ser gravada. Sem isto a foto apareceria na
   * tela e sumiria no próximo abrir do app — exatamente o bug que a separação
   * das fotos em chaves próprias corrigiu.
   */
  const avisarFalha = (res: ResultadoFoto) => {
    if (res.ok) return;
    if (res.motivo === "grande") {
      Alert.alert(
        "Foto muito grande",
        "Esta foto não caberia no armazenamento do aparelho. Escolha outra, ou recorte uma área menor."
      );
    } else {
      Alert.alert("Não deu para salvar", "Tente novamente com outra foto.");
    }
  };

  const trocarAvatar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const uri = await escolherFoto({ aspecto: [1, 1] });
      if (uri) avisarFalha(await setAvatar(uri));
    } finally {
      setOcupado(false);
    }
  };

  const adicionarMomento = async () => {
    if (ocupado || momentos.length >= MAX_MOMENTOS) return;
    setOcupado(true);
    try {
      const uri = await escolherFoto({ aspecto: [3, 4] });
      if (uri) avisarFalha(await addMomento(uri));
    } finally {
      setOcupado(false);
    }
  };

  const confirmarReset = () =>
    Alert.alert("Apagar personalização?", "Isso remove nome, avatar e fotos. O progresso dos jogos não é afetado.", [
      { text: "Cancelar", style: "cancel" },
      { text: "Apagar", style: "destructive", onPress: reset },
    ]);

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: "Meu perfil" }} />
      <FundoHalos />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingTop: 20, paddingBottom: paddingRodape, paddingHorizontal: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* avatar com anel pulsante */}
        <MotiView
          from={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "timing", duration: 450 }}
          className="items-center mt-2"
        >
          <View className="items-center justify-center" style={{ width: 168, height: 168 }}>
            <MotiView
              from={{ opacity: 0.5, scale: 1 }}
              animate={{ opacity: 0.15, scale: 1.18 }}
              transition={{ loop: true, type: "timing", duration: 2200 }}
              style={[styles.halo, { backgroundColor: corTema }]}
            />
            <Pressable
              onPress={trocarAvatar}
              accessibilityRole="button"
              accessibilityLabel="Trocar foto do avatar"
              style={[styles.avatarRing, { borderColor: corTema, shadowColor: corTema }]}
              className="active:opacity-80"
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
              ) : (
                <View className="items-center justify-center flex-1">
                  <Text className="text-4xl">📷</Text>
                  <Text className="text-muted text-[11px] mt-1">toque p/ foto</Text>
                </View>
              )}
            </Pressable>
            {/* badge de câmera */}
            <View style={[styles.camBadge, { backgroundColor: corTema }]} pointerEvents="none">
              <Text className="text-[13px]">✎</Text>
            </View>
          </View>
        </MotiView>

        {/* nome */}
        <Text style={[styles.label, { color: corTema }]}>SEU NOME</Text>
        <TextInput
          value={nome}
          onChangeText={setNome}
          placeholder="Ex.: Luuh 💜"
          placeholderTextColor={colors.muted}
          maxLength={24}
          style={styles.input}
          className="text-ink"
        />

        {/* frase carinhosa */}
        <Text style={[styles.label, { color: corTema }]}>FRASE DO DIA</Text>
        <TextInput
          value={frase}
          onChangeText={setFrase}
          placeholder="Ex.: Você vai arrasar no estágio!"
          placeholderTextColor={colors.muted}
          maxLength={80}
          multiline
          style={[styles.input, { minHeight: 60, textAlignVertical: "top" }]}
          className="text-ink"
        />

        {/* cor de destaque */}
        <Text style={[styles.label, { color: corTema }]}>COR DE DESTAQUE</Text>
        <View className="flex-row flex-wrap" style={{ gap: 14 }}>
          {CORES_TEMA.map((c) => {
            const ativa = c.hex === corTema;
            return (
              <Pressable
                key={c.hex}
                onPress={() => setCorTema(c.hex)}
                accessibilityRole="button"
                accessibilityLabel={`Cor ${c.nome}`}
                style={[
                  styles.corDot,
                  { backgroundColor: c.hex, shadowColor: c.hex },
                  ativa && styles.corDotAtiva,
                ]}
                className="items-center justify-center active:opacity-80"
              >
                {ativa && <Text className="text-bg text-base font-black">✓</Text>}
              </Pressable>
            );
          })}
        </View>

        {/* momentos */}
        <View className="flex-row items-end justify-between mt-8 mb-1">
          <Text style={[styles.label, { color: corTema, marginTop: 0 }]}>MOMENTOS DA LUUH</Text>
          <Text className="text-muted text-[11px]">
            {momentos.length}/{MAX_MOMENTOS}
          </Text>
        </View>
        <Text className="text-muted text-[12px] mb-3 leading-4">
          Fotos que viram uma torcida animada na tela inicial 🎉
        </Text>

        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {momentos.map(({ id, uri }) => (
            <MotiView
              key={id}
              from={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "timing", duration: 260 }}
            >
              <View style={styles.momento}>
                <Image source={{ uri }} style={styles.momentoImg} />
                <Pressable
                  onPress={() => removeMomento(id)}
                  accessibilityRole="button"
                  accessibilityLabel="Remover foto"
                  hitSlop={8}
                  style={styles.momentoX}
                >
                  <Text className="text-ink text-xs font-black">✕</Text>
                </Pressable>
              </View>
            </MotiView>
          ))}

          {momentos.length < MAX_MOMENTOS && (
            <Pressable
              onPress={adicionarMomento}
              accessibilityRole="button"
              accessibilityLabel="Adicionar foto"
              style={[styles.momento, styles.addTile, { borderColor: corTema + "77" }]}
              className="items-center justify-center active:opacity-80"
            >
              <Text style={{ color: corTema }} className="text-3xl font-black leading-7">
                +
              </Text>
              <Text className="text-muted text-[10px] mt-1">adicionar</Text>
            </Pressable>
          )}
        </View>

        {/* reset */}
        <Pressable
          onPress={confirmarReset}
          accessibilityRole="button"
          className="mt-10 self-center active:opacity-70"
        >
          <Text className="text-muted text-xs">Apagar personalização</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  halo: { position: "absolute", width: 168, height: 168, borderRadius: 84 },
  avatarRing: {
    width: 136,
    height: 136,
    borderRadius: 68,
    borderWidth: 3,
    overflow: "hidden",
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 18,
    elevation: 8,
  },
  avatarImg: { width: "100%", height: "100%" },
  camBadge: {
    position: "absolute",
    right: 22,
    bottom: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.bg,
  },
  label: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 26,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  corDot: {
    width: 46,
    height: 46,
    borderRadius: 23,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
  },
  corDotAtiva: { borderWidth: 3, borderColor: colors.ink },
  momento: { width: 92, height: 122, borderRadius: 16, overflow: "hidden", position: "relative" },
  momentoImg: { width: "100%", height: "100%" },
  momentoX: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    borderWidth: 2,
    borderStyle: "dashed",
    backgroundColor: colors.surface,
  },
});
