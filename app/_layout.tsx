import "../global.css";

import { useEffect } from "react";
import { Stack } from "expo-router";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { setAudioModeAsync } from "expo-audio";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, initialWindowMetrics } from "react-native-safe-area-context";
import { HeaderVoltar } from "@/components/HeaderVoltar";
import { colors } from "@/theme/tokens";

export default function RootLayout() {
  useEffect(() => {
    // Permite tocar os sons de feedback mesmo com o celular no silencioso.
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);

  return (
    // SafeAreaProvider fica na raiz de propósito: os insets são medidos em
    // relação à posição do provider na janela, então aninhá-lo dentro do
    // container centralizado (maxWidth 480) pode devolver bottom errado.
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center" }}>
        <View style={{ flex: 1, width: "100%", maxWidth: 480, backgroundColor: colors.bg }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.surface },
              headerTintColor: colors.ink,
              headerTitleStyle: { fontWeight: "800" },
              headerShadowVisible: false,
              headerBackVisible: false,
              headerLeft: () => <HeaderVoltar />,
              contentStyle: { backgroundColor: colors.bg },
            }}
          >
            <Stack.Screen name="index" options={{ title: "FisioPlay", headerLeft: () => null }} />
            <Stack.Screen name="perfil" options={{ title: "Meu perfil" }} />
            <Stack.Screen name="trilha/[id]" options={{ title: "Trilha" }} />
          </Stack>
        </View>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
