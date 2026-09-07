import { Stack } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { FundoHalos } from "@/components/FundoHalos";
import { usePaddingRodape } from "@/lib/useRodape";
import { colors } from "@/theme/tokens";

const APP_VERSAO = "1.0.0";

function abrir(url: string) {
  Linking.openURL(url).catch(() => {});
}

type FonteProps = { nome: string; licenca: string; url: string; obs?: string };

function Fonte({ nome, licenca, url, obs }: FonteProps) {
  return (
    <View style={styles.fonte} className="rounded-xl p-3 mt-2">
      <Text className="text-ink text-sm font-bold">{nome}</Text>
      <Text className="text-accent text-[11px] font-semibold mt-0.5">{licenca}</Text>
      {obs ? <Text className="text-muted text-[11px] mt-1 leading-4">{obs}</Text> : null}
      <Pressable
        onPress={() => abrir(url)}
        accessibilityRole="link"
        accessibilityLabel={`Abrir ${nome}`}
        hitSlop={8}
        className="mt-1.5 active:opacity-70"
      >
        <Text className="text-primary text-[11px] font-semibold" numberOfLines={1}>
          {url} ↗
        </Text>
      </Pressable>
    </View>
  );
}

export default function Sobre() {
  const paddingRodape = usePaddingRodape();

  return (
    <View className="flex-1 bg-bg">
      <Stack.Screen options={{ title: "Sobre & Créditos" }} />
      <FundoHalos />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 20, paddingBottom: paddingRodape }}
      >
        {/* AVISO MÉDICO */}
        <View style={styles.aviso} className="rounded-2xl p-4">
          <Text className="text-warning text-sm font-black uppercase tracking-wide">
            ⚠️ Aviso importante
          </Text>
          <Text className="text-ink text-sm leading-5 mt-2">
            O FisioPlay é um app <Text className="font-bold">educativo</Text>, para estudo e
            revisão de conteúdos de fisioterapia. As informações têm caráter informativo e{" "}
            <Text className="font-bold">
              não substituem aulas, livros, a orientação de professores nem a avaliação e a
              conduta de um profissional de saúde habilitado
            </Text>
            .
          </Text>
          <Text className="text-ink text-sm leading-5 mt-2">
            Não utilize o conteúdo do app para diagnóstico ou tratamento de pacientes. Em caso de
            dúvida clínica, consulte um fisioterapeuta ou médico. O conteúdo passa por revisão, mas
            pode conter imprecisões.
          </Text>
        </View>

        {/* CONTEÚDO / TEXTO */}
        <Text className="text-ink text-lg font-bold mt-8">Fontes do conteúdo</Text>
        <Text className="text-muted text-xs mt-1 leading-4">
          As definições são redações próprias em português, baseadas nas fontes abaixo. Cada
          item do app também mostra sua fonte com link ("Ver fonte").
        </Text>

        <Fonte
          nome="OpenStax — Anatomy & Physiology 2e"
          licenca="CC BY 4.0 (adaptado e traduzido, com atribuição)"
          url="https://openstax.org/books/anatomy-and-physiology-2e"
          obs="Base de anatomia e fisiologia. A licença permite adaptar e traduzir mediante atribuição."
        />
        <Fonte
          nome="StatPearls — NCBI Bookshelf"
          licenca="CC BY-NC-ND 4.0 — usado apenas como referência (link)"
          url="https://www.ncbi.nlm.nih.gov/books"
          obs="Referência clínica. Por ser 'NoDerivatives', o texto NÃO é adaptado — entra somente como fonte/citação com link."
        />

        {/* IMAGENS */}
        <Text className="text-ink text-lg font-bold mt-8">Imagens</Text>
        <Text className="text-muted text-xs mt-1 leading-4">
          As imagens vêm do Wikimedia Commons, sob licenças diversas (CC BY, CC BY-SA ou domínio
          público). O crédito e a licença de cada imagem aparecem abaixo dela, dentro do jogo.
        </Text>
        <Fonte
          nome="Wikimedia Commons"
          licenca="CC BY / CC BY-SA / Domínio público (por imagem)"
          url="https://commons.wikimedia.org"
        />

        {/* SONS */}
        <Text className="text-ink text-lg font-bold mt-8">Sons</Text>
        <Text className="text-muted text-xs mt-1 leading-4">
          Os sons de acerto, erro e do monitor cardíaco são gerados por síntese pelo próprio
          projeto (script `scripts/gerar_sons.py`) — não há amostra de terceiros, banco de sons
          nem atribuição pendente.
        </Text>

        {/* REFERÊNCIAS CONSULTADAS */}
        <Text className="text-ink text-lg font-bold mt-8">Referências consultadas</Text>
        <Text className="text-muted text-xs mt-1 leading-4">
          Recursos usados como referência e para conferência (não incorporados ao app):
        </Text>
        <Fonte nome="PEDro — Physiotherapy Evidence Database" licenca="Referência" url="https://pedro.org.au/portuguese" />
        <Fonte nome="Physiopedia" licenca="Referência" url="https://www.physio-pedia.com" />
        <Fonte nome="COFFITO / Ministério da Saúde (BVS-MS)" licenca="Referência oficial (Brasil)" url="https://bvsms.saude.gov.br" />

        {/* APP */}
        <Text className="text-ink text-lg font-bold mt-8">Sobre o app</Text>
        <View style={styles.fonte} className="rounded-xl p-3 mt-2">
          <Text className="text-ink text-sm font-bold">FisioPlay · versão {APP_VERSAO}</Text>
          <Text className="text-muted text-[11px] mt-1 leading-4">
            App gratuito e offline: funciona sem internet e não coleta dados pessoais. Seu
            progresso fica salvo apenas no seu aparelho.
          </Text>
        </View>

        <Text className="text-muted text-[11px] text-center mt-8 leading-4">
          Encontrou um erro no conteúdo? Reporte para que possamos corrigir.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  aviso: {
    backgroundColor: "rgba(251,191,36,0.08)",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.4)",
  },
  fonte: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
});
