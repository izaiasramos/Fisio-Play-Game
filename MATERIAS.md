# FisioPlay — Plano de Matérias Clínicas

> Documento de planejamento para inserir as matérias que a estudante está cursando
> e praticando nos estágios **deste semestre e do próximo** no app.
> Complementa `CONCEITO.md` (visão) e `ROADMAP.md` (ordem de construção).
> Regra herdada do projeto: cada item guarda `fonte` + `urlFonte`; revisão por
> fisioterapeuta antes de publicar; núcleo em `CC BY` / domínio público.

---

## 1. Matérias-alvo

Semestre atual + próximo (aula + estágio):

| # | Matéria (voz da aluna) | Trilha no app | Já sugerida no CONCEITO? |
|---|---|---|---|
| 1 | Neuro | `neuro` (Neurofuncional) | ✅ sim |
| 2 | Ortopedia | `ortopedia` (Ortopedia/Traumato) | ✅ sim |
| 3 | Cardio | `cardio` (Cardiorrespiratória) | ✅ sim |
| 4 | Saúde da Mulher | `saude-mulher` | ➕ nova |
| 5 | Saúde Geral | `saude-geral` | ➕ nova |

Cada uma vira **uma trilha** = um arquivo `src/data/trilhas/<id>.json` com o mesmo
formato do `anatomia.json` que já existe.

---

## 2. Insight central: o que precisa ser feito (e o que NÃO precisa)

Os 3 jogos atuais (**Quiz**, **Forca**, **Memória**) já funcionam sobre qualquer
trilha — eles recebem `trilha` por parâmetro e leem os `itens`. Ou seja:

**NÃO precisa de código de jogo novo para começar.** Inserir uma matéria é:
1. Escrever o JSON da trilha (conteúdo).
2. Registrá-la no loader.
3. Fazer a Home listar as trilhas.

**Precisa de código novo (pequeno) só em 2 pontos que hoje estão fixos em Anatomia:**

- `src/lib/loadTrilha.ts` → o registro `TRILHAS` importa só `anatomia.json`.
  Precisa importar e registrar as novas trilhas.
- `app/index.tsx` (Home) → tem um botão fixo "Começar — Anatomia".
  Precisa virar uma **lista dinâmica** de trilhas (usar `listarTrilhas()`, que já
  existe no loader) com pontos por trilha.

Isso destrava **todas** as 5 matérias de uma vez, com os 3 jogos atuais.

---

## 3. Adequação de conteúdo × formato de jogo

Anatomia é "termo ↔ definição", que casa perfeito com Quiz/Forca/Memória.
As matérias clínicas têm conteúdo que às vezes **não** é só "nome de estrutura".
Mapeamento do que rende bem com o que já temos:

| Matéria | Bom no Quiz/Forca/Memória (conteúdo tipo termo↔def) | Rende jogo próprio (raciocínio clínico) |
|---|---|---|
| Neuro | escalas, reflexos, pares cranianos, síndromes, marcos motores | localizar lesão → sinal; ordenar avaliação |
| Ortopedia | testes especiais, ADM, músculos/ações, patologias | teste ↔ estrutura; conduta por fase de reabilitação |
| Cardio | ausculta, sinais vitais, classes NYHA, termos ECG | interpretar caso; sequência de reabilitação cardíaca |
| Saúde da Mulher | assoalho pélvico, fases da gestação, termos obstétricos | conduta por período (gestante/puérpera) |
| Saúde Geral | sinais vitais, primeiros conceitos, ética/COFFITO, termos gerais | — (mais factual, casa com Quiz) |

**Conclusão:** as 3 fases atuais cobrem ~70% do valor imediato. O restante justifica
**2 jogos novos** (ver §5), mas eles são incremento, não bloqueio.

---

## 4. Fontes de conteúdo por matéria

Seguindo o §11 do CONCEITO (extrair só de `CC BY`/PD, o resto é link "Ver fonte"):

| Matéria | Extraível (CC BY / PD) | Só citar/linkar (autoridade) |
|---|---|---|
| Neuro | OpenStax A&P 2e (sistema nervoso), LibreTexts Neuro (checar licença) | Physiopedia (neuro), PEDro, StatPearls |
| Ortopedia | OpenStax A&P 2e (sistema muscular/esquelético) | Physiopedia (testes especiais), PEDro, TeachMeAnatomy |
| Cardio | OpenStax A&P 2e (cardiovascular/respiratório) | Physiopedia (cardioresp), WHO Rehabilitation, StatPearls |
| Saúde da Mulher | OpenStax A&P 2e (reprodutor), SciELO Brasil (artigos CC BY em PT) | Physiopedia (women's health), BVS-MS |
| Saúde Geral | OpenStax, SciELO Brasil | COFFITO, Ministério da Saúde (BVS-MS), WHO |

> ⚠️ Imagens: seguir a regra do projeto — URL verificada (API Wikipedia/Commons ou
> `curl -sI` = 200) antes de gravar `imagem`/`imagemFonte`. Nunca inventar link.

---

## 5. Jogos próprios propostos (incremento pós-conteúdo)

Reaproveitam a mesma store de pontos por trilha. Ambos já estão no backlog do CONCEITO (§5, "Raciocínio clínico").

### 5.1 Colunas A-B (associação)
- Ligar coluna esquerda ↔ direita: teste especial ↔ estrutura, patologia ↔ conduta,
  origem ↔ inserção, escala ↔ uso.
- **Por que agora:** clínica é cheia de pares. Reaproveita `termo`/`definicao`.
- Esforço: baixo (lógica parecida com Memória).

### 5.2 Qual a conduta? / Mini-caso (raciocínio clínico)
- Enunciado de mini-caso → escolher conduta/hipótese correta.
- **Por que:** é o que o estágio cobra de verdade (aplicar, não só lembrar).
- **Exige extensão de schema** (ver §6) — item clínico ≠ termo↔definição.
- Esforço: médio.

Ordem: Colunas A-B primeiro (barato, encaixa no schema atual), Mini-caso depois.

---

## 6. Impacto no schema (`src/data/schema.ts`)

O `Item` atual (`termo`, `definicao`, `dificuldade`, `fonte`, `urlFonte`, imagem
opcional) **cobre Neuro/Orto/Cardio/Mulher/Geral no modo termo↔definição sem mudança**.

Para o jogo "Qual a conduta?" (§5.2), sugerir um tipo novo, sem quebrar o atual:

```ts
/** Item de raciocínio clínico — para o jogo "Qual a conduta?". */
export type CasoClinico = {
  id: string;
  trilhaId: string;
  caso: string;            // enunciado do mini-caso
  opcoes: string[];        // condutas/hipóteses
  correta: number;         // índice da correta
  explicacao: string;      // por que, mostrado no feedback
  fonte: string;
  urlFonte: string;
};
```

Ficaria num arquivo separado (ex: `src/data/casos/<trilha>.json`) para não misturar
com o banco termo↔definição. Loader e validação análogos ao `loadTrilha.ts`.

---

## 7. Plano de execução (faseado)

Estende o `ROADMAP.md`. **Conteúdo destrava tudo; código é mínimo.**

### Fase A — Multi-trilha (destravar o app) · esforço baixo
- [ ] `loadTrilha.ts`: importar e registrar as 5 novas trilhas no `TRILHAS`
- [ ] `app/index.tsx`: trocar botão fixo por lista dinâmica via `listarTrilhas()`, com pontos por trilha
- [ ] **DoD:** Home lista Anatomia + 5 matérias; entrar em qualquer uma abre os 3 jogos

### Fase B — Conteúdo por matéria (uma trilha por vez) · esforço alto (conteúdo)
Para cada matéria (começar pela do estágio atual):
- [ ] `src/data/trilhas/<id>.json` com ~30–50 itens (CC BY, PT-BR, com fonte+urlFonte)
- [ ] Rodar o script de verificação (padrão `scripts/verificar-banco.ts`)
- [ ] Marcar como "pendente de revisão por fisioterapeuta"
- [ ] **DoD por matéria:** trilha carrega, os 3 jogos rodam sobre ela

### Fase C — Colunas A-B · esforço baixo
- [ ] Lógica pura em `src/games/colunas.ts` + tela `app/jogo/colunas.tsx`
- [ ] Botão na tela da trilha; soma pontos na trilha
- [ ] **DoD:** jogar associação em qualquer trilha

### Fase D — Qual a conduta? (raciocínio clínico) · esforço médio
- [ ] Estender schema (`CasoClinico`) + loader de casos
- [ ] Banco de casos por matéria clínica (revisado por fisioterapeuta)
- [ ] Tela `app/jogo/conduta.tsx` com feedback + explicação + Ver fonte
- [ ] **DoD:** mini-casos jogáveis em Neuro/Orto/Cardio/Mulher

---

## 8. Priorização sugerida

1. **Fase A** (1 sessão, código) — sem isso as matérias não aparecem.
2. **Fase B** para a matéria do **estágio atual** dela primeiro (maior valor imediato).
3. Demais matérias em B, uma por vez.
4. **Fase C** (Colunas A-B) quando quiser variedade barata.
5. **Fase D** (casos clínicos) como diferencial de "aplicar no estágio".

Quando começar a produzir conteúdo, o gargalo é **revisão por fisioterapeuta** —
a própria estudante pode validar o que já domina em aula/estágio.
