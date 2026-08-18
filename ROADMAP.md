# FisioPlay — Roadmap de Desenvolvimento (MVP)

> Plano de execução faseado. O **conceito** vive em `CONCEITO.md`; aqui é a **ordem
> de construção**. Cada fase é uma entrega fechada, com critério de "pronto" (DoD).
> Regra: só avança pra próxima fase quando a atual está ✅ e rodando.

Legenda: `[ ]` a fazer · `[x]` feito · **DoD** = Definition of Done (critério de pronto)

> **STATUS (2026-08-17):** Fases 0–5 ✅ concluídas. Fase 6 ⬜ pendente.
> Handoff completo e notas técnicas em **`ESTADO.md`** (leia primeiro).
> Conteúdo ✅: 6 trilhas × 50 itens = **300 itens** (todas com fonte verificada;
> Anatomia 50, clínicas 25–45 cada; **211/300 itens com imagem**). **5 jogos** entregues
> (Quiz, Forca, Memória, Colunas A-B, Qual a conduta?).

---

## Fase 0 — Fundação do projeto ✅

Objetivo: um app Expo que abre, com tema, navegação e estado prontos (sem jogo ainda).

- [x] Criar projeto Expo + TypeScript (`npx create-expo-app`)
- [x] Instalar libs base: Expo Router, Reanimated, Gesture Handler, Moti, NativeWind, Zustand
- [x] Configurar NativeWind (tailwind.config) com os **tokens de design** (cores, raios, tipografia)
- [x] Definir dark mode como padrão
- [x] Estrutura de pastas (ver abaixo)
- [x] Store global (Zustand) + persistência (AsyncStorage) — esqueleto do `Progresso`
- [x] Tela inicial placeholder navegável

**DoD:** app abre no emulador/Expo Go, mostra a home placeholder no tema escuro,
navegação funciona, sem erro de build.

---

## Fase 1 — Banco de conteúdo ✅

Objetivo: dados reais de uma trilha, carregáveis pelo app.

- [x] Definir schema TS (`Trilha`, `Item`, `Pergunta`) — já rascunhado no CONCEITO
- [x] Criar `data/trilhas/anatomia.json` com ~50 itens (fonte CC BY: OpenStax, traduzidos)
- [x] Cada item com `fonte` + `urlFonte`
- [x] Loader que lê o JSON e valida o formato
- [x] Gerador de perguntas de quiz a partir dos itens (1 correta + 3 distratores)

**DoD:** app carrega a trilha Anatomia em memória; um teste simples imprime N itens
válidos e consegue gerar uma pergunta com alternativas embaralhadas.

---

## Fase 2 — Primeiro jogo: Quiz ✅

Objetivo: uma partida jogável de ponta a ponta.

- [x] Tela de Quiz (enunciado + 4 alternativas + timer)
- [x] Lógica de acerto/erro e avanço de pergunta
- [x] Tela de resultado (acertos, pontos ganhos)
- [x] Pontuação salva **por trilha** no store (persiste)

**DoD:** dá pra jogar uma rodada completa de Quiz de Anatomia, ver o resultado, e a
pontuação da trilha aumenta e persiste ao reabrir o app.

---

## Fase 3 — Gamificação e feedback ✅

Objetivo: o "vício" — feedback satisfatório e progressão visível.

- [x] Animação de acerto (Lottie/confete) e erro (shake) via Reanimated/Moti
- [x] Haptics (expo-haptics) + som curto (expo-av) no acerto/erro
- [x] Streak diária (ofensiva) no store
- [x] XP e nível global
- [x] Tela de "revisão dos erros" ao fim da partida, com link `urlFonte`

**DoD:** acerto/erro têm feedback visual+tátil+sonoro; streak conta dias; ao errar,
o aluno vê a resposta certa e um botão "Ver fonte" que abre o link.

---

## Fase 4 — Mais jogos ✅

Objetivo: variedade reusando o mesmo banco.

- [x] Jogo da Forca (termos da trilha)
- [x] Jogo da Memória (pares termo ↔ definição)
- [x] Jogo Colunas A-B (liga termo ↔ definição, `src/games/colunas.ts`)
- [x] Jogo "Qual a conduta?" (mini-casos clínicos + explicação + Ver fonte,
      `src/games/conduta.ts` / `src/lib/loadCasos.ts` / `src/data/casos/`)
- [x] Cada jogo alimenta a pontuação da trilha e roda sobre **qualquer** trilha

**DoD:** os 5 jogos (Quiz, Forca, Memória, Colunas A-B, Qual a conduta?) funcionam
sobre as trilhas e somam pontos na mesma trilha. "Qual a conduta?" aparece só nas
trilhas com banco de casos (ortopedia, neuro, cardio, saude-mulher). Cada peça tem
seu `scripts/verificar-*.ts` e `tsc --noEmit` limpo.

---

## Fase 5 — Home e polish visual ✅

Objetivo: a cara final do MVP.

- [x] Home com seleção de trilha e de jogo
- [x] Dashboard de pontos por trilha (forças/fraquezas)
- [x] Micro-interações (botões, transições de tela)
- [x] Revisão de acessibilidade (contraste, área de toque, fonte escalável)

**DoD:** navegação completa Home → escolher trilha → escolher jogo → jogar → resultado,
tudo com visual coeso e animado.

---

## Fase 6 — Verificação e fechamento do MVP ⬜ (próxima)

- [ ] Rodar em device real. ⚠️ **Expo Go não suporta SDK 57** (ago/2026) →
      usar **web preview** ou **development build** (EAS)
- [ ] Checar performance das animações (60fps, sem travar durante o jogo)
- [ ] **Revisão do banco de conteúdo por um fisioterapeuta** (300 itens + 24 casos)
- [x] Ampliar imagens nas trilhas clínicas → 211/300 (resta cauda longa de testes/escalas epônimos sem imagem livre)
- [ ] Ajustes finais

**DoD do MVP:** 6 trilhas + 5 jogos + pontuação/streak + feedback + fontes,
rodando fluido em device real, conteúdo revisado.

---

## Pós-MVP (backlog, fora do escopo inicial)

- ~~Mais trilhas (Ortopedia, Neuro, Cardio, Saúde da Mulher, Saúde Geral)~~ ✅ feito (6 trilhas)
- ~~Mais jogos (Colunas A-B, casos clínicos)~~ ✅ feito — resta: Complete a palavra, V/F, arrastar em anatomia
- Casos clínicos para `saude-geral` + ampliar os 24 casos atuais
- Conta de usuário + sincronização em nuvem
- Ranking / desafios entre amigos
- Notificações de lembrete de estudo

---

## Estrutura de pastas sugerida (Fase 0)

```
App-Fisioterapeuta/
├── app/                 # rotas (Expo Router)
│   ├── index.tsx        # Home
│   ├── trilha/[id].tsx  # escolha de jogo
│   └── jogo/
│       ├── quiz.tsx
│       ├── forca.tsx
│       ├── memoria.tsx
│       ├── colunas.tsx
│       └── conduta.tsx
├── src/
│   ├── components/      # UI reutilizável (Botao, Card, Feedback...)
│   ├── games/           # lógica de cada jogo (pura, testável)
│   ├── store/           # Zustand (progresso, pontuação)
│   ├── data/
│   │   ├── schema.ts    # Trilha, Item, Pergunta, CasoClinico
│   │   ├── trilhas/*.json   # 6 bancos (300 itens)
│   │   └── casos/*.json     # 4 bancos de casos clínicos (24 casos)
│   ├── theme/           # tokens de design
│   └── lib/             # loaders (loadTrilha, loadCasos), helpers (gerar quiz, embaralhar)
├── assets/              # lottie, sons, imagens
├── CONCEITO.md
├── ESTADO.md            # handoff (leia primeiro)
└── ROADMAP.md
```

## Ordem recomendada de execução

Fase 0 → 1 → 2 são o **coração do MVP** (app rodando + dados + 1 jogo jogável).
Depois 3 (o que engaja), 4 (variedade), 5 (acabamento) e 6 (verificação).
Se o tempo apertar, um MVP mínimo defensável é **Fase 0+1+2+3** (Quiz completo,
com feedback e fontes) — já é um app útil e publicável.
