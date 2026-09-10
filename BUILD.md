# BUILD — como gerar o app para testar no celular

> FisioPlay · Expo SDK 57 · projeto EAS já configurado (`owner: izaiasr`, `slug: fisioplay`).
> **Expo Go não serve mais.** O app usa módulos nativos (`expo-audio`, `expo-image-picker`,
> `expo-image-manipulator`, Reanimated 4) — precisa de um build próprio.

## Antes de tudo: como a correção chega no celular

Três fatos que evitam confusão:

- **`git push` não dispara build nenhum.** Não há integração GitHub no projeto (sem
  `.eas/workflows`, sem `.github/workflows`). Quem inicia o build é o comando que você
  roda na sua máquina. O push só guarda seu trabalho.
- **Commitar não é requisito.** O `eas.json` não define `requireCommit`, e o default do
  `eas-cli` é `false` — nesse modo ele clona o repo e **copia o diretório de trabalho por
  cima**, justamente para incluir arquivos alterados e não-rastreados. Sua alteração vai no
  build mesmo sem commit. (Commitar continua sendo boa ideia, para você poder reverter.)
- **Não existe atualização OTA.** O `expo-updates` não está instalado, então não dá para
  empurrar correção de JS para um APK já instalado. Correção de JS = bundle novo, seja por
  rebuild, seja pelo dev client (abaixo).

---

## Opção 1 — Build local por USB (mais rápida)

Sem fila. Exige cabo e ambiente Android. Verificado nesta máquina com **JDK 21**
(Temurin, `JAVA_HOME=~/development/jdk-21`), Android SDK em `~/Android/Sdk` e
Gradle 9.3.1 (baixado pelo wrapper). JDK 17 também atende ao RN 0.86.

1. No celular: ative **Opções do desenvolvedor** e **Depuração USB**.
2. Conecte o cabo e **autorize o computador** no aviso que aparece na tela.
3. Rode:

```bash
npx expo run:android --device     # --device deixa você escolher o aparelho conectado
```

Isso faz o `prebuild` (cria a pasta `android/`), compila e instala no aparelho.
A primeira compilação baixa o Gradle: **10–20 min**. As seguintes são bem mais rápidas.

> ⚠️ **O que o `run:android` mudou no projeto** (na primeira execução): instalou
> `expo-dev-client` e trocou os scripts do `package.json` — `npm run android` agora é
> `expo run:android`, não mais `expo start --android`.

**O ganho principal:** esse build é um **dev client**. Depois de instalado uma vez,
qualquer correção só de JS/TS chega em segundos, sem recompilar nada:

```bash
npx expo start --dev-client
```

Use isso para iterar. Só volte a compilar quando mexer em módulo nativo, `app.json`
ou dependência.

> A pasta `android/` é descartável e está no `.gitignore`. Se der problema estranho de
> cache: `rm -rf android && npx expo run:android`.

---

## Opção 2 — Build na nuvem (sem cabo)

Não precisa de cabo nem de Android SDK. Compila nos servidores do Expo e devolve um
link/QR code para instalar o APK direto no celular.

```bash
npx eas login          # só na primeira vez  ·  confira com: npx eas whoami
npx eas build --profile preview --platform android
```

- Leva **10–30 min** contando a fila do plano gratuito. Foi o gargalo observado na
  prática: o build local ficou pronto enquanto o da nuvem ainda estava na fila.
- No fim, abra o link no celular e instale o APK (autorize "instalar de fontes desconhecidas").
- O perfil `preview` gera um **APK autônomo com o JS embutido** — comporta-se como o app
  publicado. É o cenário certo para o teste final antes de submeter, e para quando você
  não tem o cabo em mãos.

---

## Perfis disponíveis (`eas.json`)

| Perfil | Saída | Para que serve |
|---|---|---|
| `development` | APK interno + dev client | Desenvolver com hot reload e módulos nativos |
| `preview` | APK interno autônomo | **Testar como app real** antes de submeter |
| `production` | AAB / IPA | Submissão às lojas (`autoIncrement` de versão) |

> Se você já rodou `npx expo run:android`, **não precisa do perfil `development` na nuvem**:
> o build local já vem com `expo-dev-client` e faz o mesmo papel, sem fila.

Trocar de perfil ou plataforma:

```bash
npx eas build --profile development --platform android
npx eas build --profile production  --platform android   # AAB para a Play Store
npx eas build --profile production  --platform ios       # exige Apple Developer
```

---

## Antes de gerar o build

```bash
npx tsc --noEmit                      # tipos limpos
node scripts/verificar-worklets.cjs   # worklets do Reanimated (só quebra em device)
```

A checagem de worklets existe porque essa classe de bug **não aparece no preview web**:
o React Native Web não tem UI runtime separada, então um worklet chamando função JS comum
passa batido lá e derruba o app no celular. Detalhe na tabela de erros comuns.

---

## O que testar depois de instalar

1. Definir a **foto de perfil** e duas ou três **fotos da torcida**.
2. **Fechar o app de verdade** — tirar da lista de recentes, não só minimizar.
3. Abrir de novo: as fotos devem continuar lá.
4. Entrar na **Forca** e errar letras até o flatline — é o caminho que exercita as
   animações do `MonitorVital` (onde já houve um crash de worklet).

Também vale rodar os 9 jogos × 6 trilhas e conferir progresso/streak persistindo
(checklist completo em `PUBLICAR.md`).

---

## Se falhar, como ver o motivo

O erro de leitura do perfil não é mais descartado em silêncio — virou `console.warn`.
Com o app instalado e conectado:

```bash
npx expo start --dev-client
```

Procure nos logs as linhas com `[perfil]` ou `[fotosPerfil]` e mande o que aparecer.

**Crash que fecha o app não aparece no Metro.** Ele é um abort nativo, então o log do
`expo start` não mostra nada. Use o logcat:

```bash
~/Android/Sdk/platform-tools/adb logcat -c                       # limpa o buffer
~/Android/Sdk/platform-tools/adb logcat | grep -iE "fisioplay|ReactNative|Worklets|AndroidRuntime|FATAL"
```

Reproduza o crash com o logcat aberto. No APK `preview` (sem dev client), o caminho
alternativo é o próprio Android: **Configurações → Apps → FisioPlay**, ou a tela "App
assistente inteligente" que aparece após o fechamento, em **Ver histórico → Detalhes** —
foi de lá que saiu o stack trace que identificou o crash do `MonitorVital`.

---

## Erros comuns

| Sintoma | Causa provável | Saída |
|---|---|---|
| App fecha sozinho, log diz `[Worklets] Tried to synchronously call a Remote Function` | Worklet do Reanimated 4 chamando função JS comum capturada no closure | Marcar a função com `"worklet"` (ou envolver em `runOnJS`). Rodar `node scripts/verificar-worklets.cjs` |
| Correção de JS não aparece no celular | APK `preview` tem o bundle embutido e não há OTA | Usar o dev client (`npx expo start --dev-client`) ou gerar build novo |
| Escolher foto falha | Build antigo, sem `expo-image-manipulator` | Gerar build novo |
| `Not logged in` no EAS | Falta `eas login` | `npx eas login` |
| `adb: no devices found` | USB sem autorização/depuração | Reconectar e aceitar o aviso no celular |
| Build local trava no Gradle | Cache corrompido | `rm -rf android` e rodar de novo |
| App abre branco após instalar | Bundle desatualizado no dispositivo | Desinstalar o APK antigo antes de instalar |

### Sobre o crash de worklet

Foi um caso real: `src/components/forca/MonitorVital.tsx` tinha um helper de cor
(`corSaude`) como função JS comum, chamado de dentro de `useAnimatedProps`/
`useAnimatedStyle`. No Reanimated 4 uma função não-worklet capturada por worklet vira
**Remote Function**, e chamá-la sincronamente na UI runtime aborta o processo. Como o
worklet rodava a cada frame, o app fechava ao jogar a Forca. A correção foi mover a função
para escopo de módulo com o diretivo `"worklet"`.
