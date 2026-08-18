# FisioPlay — Jogos Futuros & Adequação de Formato

> Backlog de design para implementação futura. Captura as decisões sobre **quais
> formatos de jogo cada matéria pede** e os **dois jogos próprios** aprovados.
> Complementa `CONCEITO.md` (§5 catálogo de jogos) e `MATERIAS.md` (plano das trilhas).
> Nada aqui bloqueia o conteúdo: os 3 jogos atuais (Quiz, Forca, Memória) já rodam
> sobre qualquer trilha.

---

## 1. Adequação de conteúdo × formato de jogo

Anatomia é "termo ↔ definição", que casa perfeito com Quiz/Forca/Memória. As matérias
clínicas têm conteúdo que às vezes **não** é só "nome de estrutura". Mapeamento:

| Matéria | Bom no Quiz/Forca/Memória (termo↔def) | Rende jogo próprio (raciocínio clínico) |
|---|---|---|
| **Neuro** | escalas, reflexos, pares cranianos, síndromes, marcos motores | localizar lesão → sinal; ordenar avaliação |
| **Ortopedia** | testes especiais, ADM, músculos/ações, patologias | teste ↔ estrutura; conduta por fase de reabilitação |
| **Cardio** | ausculta, sinais vitais, classes NYHA, termos de ECG | interpretar caso; sequência de reabilitação cardíaca |
| **Saúde da Mulher** | assoalho pélvico, fases da gestação, termos obstétricos | conduta por período (gestante/puérpera) |
| **Saúde Geral** | sinais vitais, primeiros conceitos, ética/COFFITO, termos gerais | — (mais factual, casa com Quiz) |

**Leitura:** os 3 jogos atuais cobrem a coluna do meio de todas as matérias. A coluna
da direita é o que justifica os jogos próprios abaixo — incremento, não bloqueio.

---

## 2. Jogos próprios propostos (incremento pós-conteúdo)

Ambos reaproveitam a store de pontos por trilha (`useProgresso.pontosPorTrilha`) e o
padrão de feedback (haptics/som/confete/shake) já existente. Ambos constam no backlog
do CONCEITO §5 ("Raciocínio clínico").

### 2.1 Colunas A-B (associação) — esforço BAIXO

**O que é:** ligar itens da coluna esquerda ↔ direita. Ex.: teste especial ↔ estrutura,
patologia ↔ conduta, origem ↔ inserção, escala ↔ uso.

**Por que agora:** clínica é cheia de pares. Reaproveita direto os campos
`termo`/`definicao` que já existem no schema — **sem mudança de dados**.

**Como implementar:**
- `src/games/colunas.ts` — lógica pura: sortear N itens (ex.: 5), montar duas colunas
  embaralhadas independentemente, validar par selecionado, pontuar. Testável como os
  outros (`scripts/verificar-colunas.ts` no padrão dos demais `verificar-*.ts`).
- `app/jogo/colunas.tsx` — tela: duas colunas de botões; toque em A destaca, toque em B
  confirma/erra; par certo "trava" com cor de acerto, errado dá shake. Recebe `trilha`
  por `params` (igual quiz/forca/memoria).
- Botão na tela `app/trilha/[id].tsx` (novo card "🔗 Colunas").
- Pontuação: `addPontos` + `registrarJogo` na trilha (mesmo fluxo do Quiz).

**Reaproveita:** `carregarTrilha`, `useProgresso`, `useFeedback`, `Confete`.

### 2.2 "Qual a conduta?" / Mini-caso (raciocínio clínico) — esforço MÉDIO

**O que é:** enunciado de mini-caso clínico → escolher a conduta/hipótese correta, com
explicação no feedback. É o que o estágio cobra de verdade (aplicar, não só lembrar).

**Por que exige mais:** item clínico **≠** termo↔definição. Precisa de um tipo de dado
novo (ver §3) e de um banco de casos separado, revisado por fisioterapeuta.

**Como implementar:**
- Estender schema com `CasoClinico` (§3) e criar loader análogo ao `loadTrilha.ts`
  (ex.: `src/lib/loadCasos.ts`, lendo `src/data/casos/<trilha>.json`).
- `app/jogo/conduta.tsx` — mostra `caso`, alternativas embaralhadas, feedback com
  `explicacao` + botão "Ver fonte" (`urlFonte`), igual à revisão de erros do Quiz.
- `src/games/conduta.ts` — seleção/pontuação pura + `scripts/verificar-conduta.ts`.
- Banco inicial pequeno por matéria clínica (Neuro, Ortopedia, Cardio, Saúde da Mulher).

**Cuidado de conteúdo:** casos clínicos são sensíveis — cada um precisa de `fonte` +
`urlFonte` verificada (HTTP 200) e revisão por fisioterapeuta antes de publicar.

---

## 3. Extensão de schema (para o "Qual a conduta?")

O `Item` atual cobre os jogos termo↔definição sem mudança. Para casos clínicos,
adicionar em `src/data/schema.ts` um tipo novo, **sem quebrar o existente**:

```ts
/** Item de raciocínio clínico — para o jogo "Qual a conduta?". */
export type CasoClinico = {
  id: string;
  trilhaId: string;
  caso: string;            // enunciado do mini-caso
  opcoes: string[];        // condutas/hipóteses
  correta: number;         // índice da correta em `opcoes`
  explicacao: string;      // mostrada no feedback (por que é a correta)
  fonte: string;
  urlFonte: string;
};
```

Arquivo de dados separado (`src/data/casos/<trilha>.json`) para não misturar com o
banco termo↔definição.

---

## 4. Ordem de implementação sugerida

1. **Colunas A-B** primeiro — barato, encaixa no schema atual, adiciona variedade já.
2. **Qual a conduta?** depois — extensão de schema + banco de casos + revisão clínica.

Ideias da coluna da direita da §1 (ex.: "localizar lesão → sinal" no Neuro, "conduta por
fase de reabilitação" na Ortopedia) são variações do formato "Qual a conduta?" e entram
como novos bancos de `CasoClinico`, não como novos jogos.

---

## 5. Checklist enxuto (para retomar depois)

> ✅ IMPLEMENTADO em 2026-08-17 (ambos os jogos). Ver `ESTADO.md`.

- [x] `src/games/colunas.ts` + `scripts/verificar-colunas.ts`
- [x] `app/jogo/colunas.tsx` + card na `app/trilha/[id].tsx`
- [x] `CasoClinico` em `src/data/schema.ts`
- [x] `src/lib/loadCasos.ts` + `src/data/casos/<trilha>.json` (ortopedia, neuro, cardio, saude-mulher — 6 casos cada)
- [x] `src/games/conduta.ts` + `scripts/verificar-conduta.ts`
- [x] `app/jogo/conduta.tsx` (feedback com explicação + Ver fonte)

Pendente: casos para `saude-geral`, ampliar os 24 casos, revisão por fisioterapeuta.
