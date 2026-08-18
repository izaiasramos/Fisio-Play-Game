# PUBLICAR — Checklist de publicação (Google Play + App Store)

> Checklist para levar o FisioPlay às lojas. Marque `[x]` conforme concluir.
> Contexto: app **gratuito**, **offline-first** (sem login, sem coleta), Expo SDK 57.
> Estado geral: UI/UX pronto (Fases 0–6 UI). Caminho crítico = **conteúdo + legal + build EAS**.
> Última atualização: 2026-08-17.

## 🔴 Bloqueadores (não publica sem)
- [ ] **Revisão clínica completa do conteúdo** — em andamento (relatórios em `revisao/relatorios/`).
      Faltam: Saúde da Mulher, Saúde Geral e os casos clínicos.
- [ ] **Sign-off de fisioterapeuta licenciado** — o revisor-IA é primeira linha, não laudo.
      Conteúdo de saúde não deve ir ao ar sem aprovação profissional.
- [x] **Disclaimer médico no app** — feito: aviso na tela "Sobre & Créditos"
      (`app/sobre.tsx`) + linha no rodapé da Home. (Opcional futuro: modal na 1ª abertura.)
- [~] **Política de Privacidade** — rascunho pronto em `POLITICA_PRIVACIDADE.md`
      (offline, sem coleta, LGPD). **Falta**: preencher `[NOME]`/`[E-MAIL]`, hospedar
      numa **URL pública** e colar essa URL no cadastro das duas lojas.
- [x] **Tela de créditos/licenças no app** — feito (`app/sobre.tsx`): OpenStax (CC BY 4.0,
      adaptado), StatPearls (CC BY-NC-ND, só link), Wikimedia (crédito por imagem no jogo),
      referências (PEDro/Physiopedia/COFFITO). ⚠️ Ainda confirmar que nenhuma definição é
      tradução literal do StatPearls (devem ser redações próprias).

## 🟠 Build técnico (Expo / EAS)
- [x] `app.json` base: nome, slug, versão 1.0.0, ícone + adaptive icons (Android), tema escuro.
- [x] **`ios.bundleIdentifier`** e **`android.package`** no `app.json` = `com.fisioplay.app`
      (2026-08-17). ⚠️ Trocar se você tiver domínio/org próprio antes do 1º build (o
      bundle id é imutável na loja depois de publicado). `expo config` resolve OK.
- [x] **`eas.json`** criado (2026-08-17): perfis **development** (`developmentClient:true`,
      APK interno — é o que substitui o Expo Go no SDK 57), **preview** (APK interno) e
      **production** (`autoIncrement`, `appVersionSource: remote`). Falta só rodar
      `eas login` + `eas build` (exige sua conta Expo — não fiz).
- [x] **Splash screen** configurada (2026-08-17): `expo-splash-screen ~57.0.7` instalado +
      plugin no `app.json` (`splash-icon.png` 1024², `imageWidth:200`, `contain`,
      fundo `#0B1020`). `expo config` resolve OK.
- [ ] `android.versionCode` / `ios.buildNumber` — geridos pelo EAS (`appVersionSource:
      remote` + `autoIncrement`); nada a fazer manualmente.
- [ ] **Build de produção**: AAB (Android) e IPA (iOS) via `eas build`.
- [ ] **Testar o build em device real** (Android + iPhone) — Expo Go NÃO serve (SDK 57).
- [ ] Checar **60fps** das animações em aparelho real (Reanimated/Moti).

## 🟡 Contas e assets de loja
- [ ] **Google Play Console** (US$ 25, taxa única) + **Apple Developer Program** (US$ 99/ano).
- [ ] **Ícone 1024×1024** (confirmar resolução de `assets/icon.png`).
- [ ] **Screenshots** por tamanho de device (phone + tablet; ambas as lojas).
- [ ] **Feature graphic 1024×500** (Play Store).
- [ ] Descrição curta + longa, **categoria** (Educação ou Medicina), palavras-chave.
- [ ] **Classificação etária**: questionário IARC (Play) + age rating (Apple).
- [ ] **Data Safety** (Play) / **App Privacy** (Apple) — declarar que **não coleta dados**.

## 🟢 QA final
- [ ] Rodar os **5 jogos × 6 trilhas** em device real.
- [ ] Estados vazios/erro (trilha sem casos, trilha inexistente).
- [ ] **Persistência** de progresso (fechar/reabrir mantém pontos/streak/XP).
- [ ] Acessibilidade no device (leitor de tela + fonte grande do sistema).

## Notas
- **Sem permissões sensíveis**: app offline, sem câmera/localização/contatos → declaração
  de privacidade fica simples ("não coletamos dados").
- **Áudio**: usa `expo-audio` (sons de feedback) — sem permissão de microfone.
- **Links externos**: os botões "Ver fonte" abrem navegador (`Linking`) — ok nas lojas.
- Ordem sugerida: (1) fechar revisão + sign-off → (2) legal (privacidade/disclaimer/créditos)
  → (3) build EAS + teste em device → (4) contas + assets de loja → (5) submissão.
