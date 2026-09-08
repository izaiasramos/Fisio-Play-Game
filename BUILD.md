# BUILD — como gerar o app para testar no celular

> FisioPlay · Expo SDK 57 · projeto EAS já configurado (`owner: izaiasr`, `slug: fisioplay`).
> **Expo Go não serve mais.** O app usa módulos nativos (`expo-audio`, `expo-image-picker`,
> `expo-image-manipulator`, Reanimated 4) — precisa de um build próprio.

---

## Opção 1 — Build na nuvem (recomendada)

Não precisa de cabo nem de Android SDK. Compila nos servidores do Expo e devolve um
link/QR code para instalar o APK direto no celular.

```bash
npx eas login          # só na primeira vez
npx eas build --profile preview --platform android
```

- Leva **10–30 min** contando a fila do plano gratuito.
- No fim, abra o link no celular e instale o APK (autorize "instalar de fontes desconhecidas").
- O perfil `preview` gera um **APK autônomo com o JS embutido** — comporta-se como o app
  publicado, que é exatamente o cenário para testar "fecha e abre".

---

## Opção 2 — Build local por USB

Mais rápido nas próximas vezes e sem fila, mas exige cabo e ambiente Android
(JDK 17 + Android SDK/platform-tools).

1. No celular: ative **Opções do desenvolvedor** e **Depuração USB**.
2. Conecte o cabo e **autorize o computador** no aviso que aparece na tela.
3. Rode:

```bash
npx expo run:android
```

Isso faz o `prebuild` (cria a pasta `android/`), compila e instala no aparelho.
A primeira compilação baixa dependências do Gradle: **10–20 min**.

> A pasta `android/` gerada é descartável. Se der problema estranho de cache:
> `rm -rf android && npx expo run:android`.

---

## Perfis disponíveis (`eas.json`)

| Perfil | Saída | Para que serve |
|---|---|---|
| `development` | APK interno + dev client | Desenvolver com hot reload e módulos nativos |
| `preview` | APK interno autônomo | **Testar como app real** (usar este) |
| `production` | AAB / IPA | Submissão às lojas (`autoIncrement` de versão) |

Trocar de perfil ou plataforma:

```bash
npx eas build --profile development --platform android
npx eas build --profile production  --platform android   # AAB para a Play Store
npx eas build --profile production  --platform ios       # exige Apple Developer
```

---

## O que testar depois de instalar

1. Definir a **foto de perfil** e duas ou três **fotos da torcida**.
2. **Fechar o app de verdade** — tirar da lista de recentes, não só minimizar.
3. Abrir de novo: as fotos devem continuar lá.

Também vale rodar os 5 jogos × 6 trilhas e conferir progresso/streak persistindo
(checklist completo em `PUBLICAR.md`).

---

## Se falhar, como ver o motivo

O erro de leitura do perfil não é mais descartado em silêncio — virou `console.warn`.
Com o app instalado e conectado:

```bash
npx expo start
```

Procure nos logs as linhas com `[perfil]` ou `[fotosPerfil]` e mande o que aparecer.

---

## Erros comuns

| Sintoma | Causa provável | Saída |
|---|---|---|
| Escolher foto falha | Build antigo, sem `expo-image-manipulator` | Gerar build novo |
| `Not logged in` no EAS | Falta `eas login` | `npx eas login` |
| `adb: no devices found` | USB sem autorização/depuração | Reconectar e aceitar o aviso no celular |
| Build local trava no Gradle | Cache corrompido | `rm -rf android` e rodar de novo |
| App abre branco após instalar | Bundle desatualizado no dispositivo | Desinstalar o APK antigo antes de instalar |
