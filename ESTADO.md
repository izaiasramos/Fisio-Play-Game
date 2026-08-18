# FisioPlay — Estado do Projeto (handoff)

> **Leia primeiro.** Documento único de continuidade para retomar o projeto em um
> novo chat. Consolida o antigo `STATUS.md`. Docs de apoio: `CONCEITO.md` (visão),
> `ROADMAP.md` (fases), `MATERIAS.md` (plano das trilhas clínicas),
> `JOGOS-FUTUROS.md` (jogos), `revisao/` (revisão clínica do conteúdo).
> Última atualização: **2026-08-17**.

## Onde estamos
- **Fases 0 → 5 COMPLETAS.** **Fase 6 em andamento:** o lado de **UI/UX
  (verificação técnica + usabilidade + polish)** foi concluído em 2026-08-17
  (ver seção "Fase 6 — UI/UX"); a **revisão clínica do conteúdo** está sendo
  feita em paralelo por outro chat (relatórios em `revisao/relatorios/`). Falta
  ainda **teste em device real / 60fps** e o **sign-off profissional**. Ver `ROADMAP.md`.
- App roda em **web preview**. ⚠️ Expo SDK 57 não é suportado pelo Expo Go atual
  (ago/2026) → usar web ou development build (EAS).

### Subir o servidor
```bash
npx expo start --web --port 8081
# preview: http://127.0.0.1:8081/
```
> Nota de infra: builds/preview e sub-agentes (`spawn_run`, ~4 GB) são pesados;
> com memória apertada no host, adiar ou rodar localmente.

## Stack
React Native + Expo SDK 57 · Expo Router · NativeWind 4 · Zustand 5 (+AsyncStorage)
· Reanimated 4 · Moti · expo-haptics/expo-audio. Offline-first, sem login. Dark theme.
Layout limitado a **480px centralizado** (`app/_layout.tsx` + `global.css` body #0b1020).

## Conteúdo — 6 trilhas, 300 itens
Registradas em `src/lib/loadTrilha.ts`; Home (`app/index.tsx`) lista dinâmico via
`listarTrilhas()`. Cada item tem `fonte` + `urlFonte` (HTTP 200 verificado); muitos
têm `imagem`/`imagemFonte`/`imagemCredito` (Wikimedia, verificadas HTTP 200).

| Trilha | id | itens | c/ imagem |
|---|---|---|---|
| Anatomia | `anatomia` | 50 | 50 |
| Ortopedia | `ortopedia` | 50 | 29 |
| Neurofuncional | `neuro` | 50 | 22 |
| Cardiorrespiratória | `cardio` | 50 | 39 |
| Saúde da Mulher | `saude-mulher` | 50 | 23 |
| Saúde Geral | `saude-geral` | 50 | 18 |

Total: **211 de 300 itens com imagem** (Anatomia 50, Cardio 45, Ortopedia 35, Saúde
da Mulher 31, Neuro 25, Saúde Geral 25). Fontes: OpenStax A&P 2e (CC BY 4.0) +
Wikimedia Commons (imagens verificadas 200 + crédito). Faltam sobretudo imagens de
testes/escalas clínicas epônimos (Neer, Hawkins, Berg, MRC, Ashworth, NYHA) — sem
imagem livre relevante. Substituídas 3 imagens-líder fracas: `ger-043` (foto de
maratona → diagrama do ciclo da marcha), `neu-020` (ilustração de 1910 → níveis de
paralisia, Servier), `mul-023` (símbolo → diagrama de sintomas da menopausa).
Refinadas +3 por QA visual (2026-08-17): `car-029` Reabilitação cardíaca (marca-passo
→ teste ergométrico em esteira), `neu-017` Tremor de repouso (espiral de tremor
essencial → ilustração de Parkinson de Gowers), `ger-019` Prevenção de quedas
(crianças caindo → andador/auxílio de marcha). QA visual das 32 novas/trocadas OK
(carregam e são topicais); todas verificadas 200 + `image/*` + crédito.
**Conteúdo revisado em 1ª linha (IA) nas 6 trilhas; PENDENTE de sign-off humano antes de publicar (ver seção Revisão).**

## Jogos — 5 (todos jogáveis, somam pontos por trilha, rodam em qualquer trilha)

| Jogo | Tela | Lógica | Notas |
|------|------|--------|-------|
| Quiz | `app/jogo/quiz.tsx` | `src/games/quiz.ts` | 8 perguntas, timer 60s, bônus velocidade (cap +10), revisão de erros, imagens |
| Forca | `app/jogo/forca.tsx` | `src/games/forca.ts` | teclado A–Z (44px), dica, rosto, shake |
| Memória | `app/jogo/memoria.tsx` | `src/games/memoria.ts` | pares termo↔definição, flip via crossfade |
| Colunas A–B | `app/jogo/colunas.tsx` | `src/games/colunas.ts` | liga termo↔definição, 5 pares/rodada, bônus perfeito |
| Qual a conduta? | `app/jogo/conduta.tsx` | `src/games/conduta.ts` + `src/lib/loadCasos.ts` | mini-casos clínicos + explicação + Ver fonte; card só nas trilhas com casos |

Cada jogo tem `scripts/verificar-<jogo>.ts` (verificação de lógica sem UI).
Casos clínicos em `src/data/casos/`: **ortopedia, neuro, cardio, saude-mulher — 6 cada (24)**.

Gamificação: XP/nível (`src/games/gamificacao.ts`), streak, pontos por trilha
(`src/store/useProgresso.ts`), confete/haptics/som (`src/lib/useFeedback.ts`).

## Revisão clínica do conteúdo (`revisao/`)
Framework para auditar o banco trilha a trilha antes de publicar:
- `revisao/AGENTE-REVISOR-CLINICO.md` — spec do agente revisor (EBP), rubrica,
  taxonomia de evidência (comprovado / convencional / não-convencional aceito /
  controverso / insuficiente), regras anti-alucinação, portão de aprovação.
- `revisao/ESQUEMA-REVISAO.md` — schema JSON do relatório (inclui `condutasAlternativas`
  → base do futuro "multi-conduta" por caso).
- `scripts/preparar-revisao.ts` → gera `revisao/worksheets/<trilha>.json` (324 entradas).
- `revisao/relatorios/EXEMPLO-cardio.json` — amostra do formato (2 itens).

### Status das revisões (kiro como revisor — pendente sign-off humano)
| Trilha | Relatório | Veredito | Correções aplicadas aos dados |
|---|---|---|---|
| Anatomia | `anatomia.json/.md` | ✅ revisada | sim |
| Ortopedia | `ortopedia.json/.md` | ✅ revisada | sim |
| Neuro | `neuro.json/.md` | ✅ revisada | sim (5 fontes + rótulos) |
| Cardio | `cardio.json/.md` | ✅ revisada | sim (car-001 + 5 fontes) |
| Saúde da Mulher | `saude-mulher.json/.md` | ✅ revisada | sim (imagem ♀ em mul-001/031) |
| Saúde Geral | `saude-geral.json/.md` | ✅ revisada | sim (ger-008 EVA vs END; ger-043 fonte→Gait) |

**Todas as 6 trilhas revisadas em 1ª linha.** Sem erros factuais graves em nenhuma.
Pendências abertas p/ sign-off humano: fontes adjacentes (Saúde da Mulher: 6 itens
no artigo de anatomia do assoalho pélvico; Saúde Geral: 9 itens, incl. marcha→
"types of body movements" e modalidades→"Chronic Pain") e nuance de evidência de
TENS/ultrassom (Saúde Geral). Nenhuma correção de conteúdo pendente.

⚠️ O agente é **primeira linha**, não laudo: publicação exige **sign-off de
profissional licenciado** (não basta estudante/estagiária). Rodar em massa via
sub-agente precisa ~4 GB de RAM livres → hoje serial/adiado.

## Fase 5 — linguagem visual (o que foi feito)
- `src/components/FundoHalos.tsx`: fundo de halos animados reutilizável.
- `src/components/CartaMemoria.tsx`: flip (crossfade + rotateY ±90°), glow neon.
- Home: hero, HUD de nível com glow, cards de trilha com glow + **mini-barra de
  desempenho por trilha** (dashboard forças/fraquezas), entrada escalonada.
- Trilha: header com ícone luminoso, prévia, cards de jogo com glow.
- Layout web: coluna central 480px + fundo escuro global (corrige app esticado no desktop).

## Fase 6 — UI/UX (verificação + polish, 2026-08-17)
Sessão dedicada a verificação técnica/visual e usabilidade (sem tocar em conteúdo,
que estava sendo revisado em paralelo). Tudo com `tsc` limpo e verificado por
screenshot no web.
- **`src/components/TextoAdaptativo.tsx`** (novo): alinhamento condicional de texto
  — ≤2 linhas centraliza, >2 alinha à esquerda. Híbrido cross-platform: `onTextLayout`
  (nativo, nº exato de linhas, imune à escala de fonte) + `onLayout`/altura (fallback
  web). Aplicado em **Colunas, Quiz, Conduta** e na definição da **Memória** (`CartaMemoria`).
- **Colunas**: cards de altura fixa 108px (colunas alinhadas), definições em
  `inkSoft` (#D4DAEC, contraste AA), token `inkSoft` em `tokens.ts` + `tailwind.config.js`.
- **Memória — timing de leitura**: par errado deixou de desvirar em 850ms fixos →
  **proporcional ao texto** (`1600 + maiorTexto×35`, teto 6000ms) + overlay
  **"Toque em qualquer lugar para continuar"** (desvira antes do tempo). Estado `aguardando`.
- **`src/components/HeaderVoltar.tsx`** (novo): botão **"‹ Voltar" SEMPRE presente**
  no header (não depende de histórico). `router.canGoBack() ? back() : replace("/")`.
  Aplicado global em `app/_layout.tsx` (`headerBackVisible:false` + `headerLeft`);
  Home sem botão (`headerLeft:()=>null`). paddingLeft 16 (não encostar na borda).
- **Halos suavizados** nos jogos com halo inline (Colunas/Conduta/Memória):
  `from .15 → animate .28` (primary) / `.12 → .24` (accent). `FundoHalos` já era sutil (0.05–0.1).
- **Trilha**: "itens" → "**conceitos**"; prévia do quiz marcada como **"amostra"**
  (selo + opacity-50 + `pointerEvents none`) para não parecer clicável.
- **`app/sobre.tsx`** (novo): tela **"Sobre & Créditos"** — aviso médico (app
  educativo, não substitui profissional), fontes/licenças (OpenStax CC BY 4.0
  adaptado · StatPearls CC BY-NC-ND só link · Wikimedia por imagem), referências
  (PEDro/Physiopedia/COFFITO) e nota de app offline/sem coleta. Rota `/sobre`,
  ganha o botão "‹ Voltar" global.
- **Home** (`app/index.tsx`): rodapé com aviso curto ("conteúdo educativo, não
  substitui profissional") + link **"Sobre & créditos ›"** para `/sobre`.

### Publicação (docs de apoio, não código)
- **`PUBLICAR.md`** (novo): checklist de publicação (Play Store/App Store) com
  bloqueadores. Já resolvidos nesta sessão: **disclaimer médico** e **tela de
  créditos/licenças** (ver acima). Pendentes: revisão clínica + sign-off,
  configurar build (bundle ids/`eas.json`/splash), preencher/hospedar a política.
- **`POLITICA_PRIVACIDADE.md`** (novo): rascunho da Política de Privacidade
  (offline, sem coleta, LGPD). Verificado no código: progresso só local
  (AsyncStorage/Zustand `persist`), sons embutidos (`expo-audio`, sem microfone),
  sem `fetch`/analytics/anúncios/conta. **Falta**: preencher nome/e-mail e
  hospedar numa URL pública para colar no cadastro das lojas.

## Acessibilidade (revisada na Fase 5)
- Contraste WCAG AA. **Correção**: branco sobre verde de acerto dava 2.28:1 →
  `successDeep` (#15803D, 5.02:1), usado em Quiz/Forca/Memória.
- Alvos de toque ≥ 44px (teclado da Forca ajustado 40→44px).
- `accessibilityRole="button"` + rótulos agrupados; `accessibilityState` de desabilitado.
- Decorativos (FundoHalos, Confete) ocultos para leitores de tela.

## Notas técnicas / gotchas (ler antes de mexer)
- **URLs verificadas**: nunca gravar `urlFonte`/`imagem` sem confirmar (curl 200 ou
  API). StatPearls: confirmar título com `curl -sL <url>|grep -o '<title>...'`
  (vários NBK dão 200 mas são de outro assunto). Physiopedia bloqueia curl (403).
- **RN Web + `backfaceVisibility:hidden` NÃO funciona** (flip 3D espelha texto) →
  usar 2 faces em crossfade + rotateY ±90°.
- **RN Web não tem blur** → halos são discos de cor sólida, grandes, fora da tela,
  opacidade ≤0.10. `Image` dentro de `Pressable` quebra a largura → `Image` no `View`.
  Imagens do Commons: `Special:FilePath/<arquivo>?width=800`; não renderiza `.webm`/`.ogv`/`.pdf`.
- **Testar em largura desktop (1400px+)**, não só mobile.
- **QA por screenshot headless**: `google-chrome --headless=new --disable-gpu
  --no-sandbox --window-size=W,H --virtual-time-budget=8000 --screenshot=/tmp/x.png URL`.
  Loops Moti deixam a página "não-ociosa" → captura pega frame cedo; confirmar com
  `--dump-dom`. Playwright NÃO está disponível.
- **Sub-agentes (spawn_run)** recusados com <4 GB livres → fazer em série no parent.
- Scripts que usam módulos Node (`fs`/`path`) precisam de `/// <reference types="node" />`
  (o `expo/tsconfig.base` não inclui `node` no `types`).
- Após editar: `npx tsc --noEmit` deve passar limpo. Commits são do usuário (Izaias) — não commitar por ele.

## O que FALTA (backlog priorizado) — atualizado 2026-08-17

### P0 — bloqueia publicar
1. **Sign-off clínico humano** — a revisão de **1ª linha por IA** está ✅ nas 6 trilhas
   (relatórios em `revisao/relatorios/*.json|.md`; correções já aplicadas nos dados).
   Falta o carimbo de um fisioterapeuta **licenciado** (estudante não fecha o portão).
   Entregar a ele as pendências abertas: fontes adjacentes (Saúde da Mulher 6; Saúde
   Geral 8), nuance de evidência de **TENS/ultrassom**, e a imagem do `ger-043`.
2. **Development build (EAS) + device real** — Expo Go não suporta SDK 57 → EAS dev
   build. ✅ Config feita (2026-08-17): `ios.bundleIdentifier`/`android.package` =
   `com.fisioplay.app` no `app.json` e `eas.json` com perfis development/preview/
   production (`expo config` resolve OK) + `expo-splash-screen ~57.0.7` instalado e
   configurado (fundo `#0B1020`). Falta: `eas login` + `eas build` (exige a conta Expo
   do usuário), rodar em device e checar 60fps.
3. **Pré-requisitos de loja** — ícone, splash, nome/bundle id definitivos, screenshots,
   descrição; **hospedar** `POLITICA_PRIVACIDADE.md` numa URL pública e preencher
   nome/e-mail. (App é offline, sem login e sem rede → sem superfície de auth.)

### P1 — qualidade antes/perto do lançamento
4. **Imagens** ✅ em grande parte (2026-08-17): 3 imagens-líder fracas trocadas
   (`ger-043`, `neu-020`, `mul-023`), +3 refinadas por QA (`car-029`, `neu-017`,
   `ger-019`) e cobertura ampliada 181→**211/300** via pipeline verificado. QA visual
   das 32 novas/trocadas feito (screenshot headless) — todas carregam e são topicais.
   Resta o "cauda longa" de testes/escalas epônimos sem imagem livre
   (Neer, Hawkins, Berg, MRC, Ashworth, NYHA) — provavelmente exige diagrama próprio.
5. (Opcional) Aplicar as trocas de **fonte adjacente** que dá pra verificar por curl,
   adiantando o trabalho do sign-off.

### P2 — pós-MVP (dá pra lançar sem)
6. **Casos clínicos para Saúde Geral** (e Anatomia) + ampliar os 24 casos atuais (6/trilha).
7. **Multi-conduta**: estender `CasoClinico` para várias condutas válidas por caso
   (o schema de revisão já prevê `condutasAlternativas`).
8. Novos jogos (Complete a palavra, V/F, arrastar em anatomia), ranking, conta/sync
   em nuvem, notificações de estudo.

> **Nota honesta:** a **config** de build (bundle ids + `eas.json`) foi feita e valida
> localmente, mas o que exige **conta Expo / hardware** — `eas build`, teste em device
> real, 60fps, contas e assets/listing de loja — ainda **não foi executado nesta
> máquina**. `eas-cli` não está instalado localmente.

## Mapa rápido de arquivos
```
app/index.tsx                 Home (lista trilhas dinamicamente)
app/trilha/[id].tsx           seleção de jogo (jogos + conduta condicional)
app/jogo/{quiz,forca,memoria,colunas,conduta}.tsx
src/games/{quiz,forca,memoria,colunas,conduta,gamificacao}.ts   lógica pura
src/lib/{loadTrilha,loadCasos,gerarQuiz,useFeedback}.ts
src/components/{FundoHalos,CartaMemoria,Confete,TextoAdaptativo,HeaderVoltar}.tsx
src/data/schema.ts            Trilha, Item, Pergunta, CasoClinico
src/data/trilhas/*.json       6 bancos de conteúdo (300 itens)
src/data/casos/*.json         4 bancos de casos clínicos (24 casos)
src/store/useProgresso.ts     progresso (Zustand + AsyncStorage)
scripts/verificar-*.ts        DoD de cada peça
scripts/imagens_trilha.py     sourcing de imagens (REST + 200 + crédito)
scripts/preparar-revisao.ts   gera worksheets de revisão
revisao/                      agente revisor, esquema, worksheets, relatórios
```
