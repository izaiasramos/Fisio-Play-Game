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

---

## 6. "Montar o corpo" — girar em 360º, zoom e regiões detalhadas

> Avaliado em 2026-09-10, a partir da pergunta "no joelho tem apenas a patela?".
> **Zoom: implementado.** **360º: descartado na forma de 3D real; proposta de vistas.**

### 6.1 Por que 3D de verdade não entra agora

Rodar 3D em React Native passa obrigatoriamente por `expo-gl` (é o único caminho para
WebGL nativo). Os riscos são concretos e documentados:

- `expo-gl` + Nova Arquitetura tem relatos de [tela preta com nada carregando](https://github.com/gpujs/expo-gl/issues/7)
  e de [render travando quando gesture handlers entram e saem](https://github.com/expo/expo/issues/37725).
- Os mantenedores do react-three-fiber [registram problemas sérios de performance com ExpoGL](https://github.com/pmndrs/native).
- A Nova Arquitetura **não é opcional**: obrigatória desde o RN 0.82, e o projeto está no
  RN 0.86 (SDK 57). Não há como cair no legado para fugir do problema.
- O jogo depende de `react-native-gesture-handler` para arrastar peça — exatamente a
  combinação dos relatos acima.

Conteúdo 3D livre existe ([BodyParts3D](https://commons.wikimedia.org/wiki/File:BodyParts3D_Rib.stl)
e o Z-Anatomy derivado dele), mas é **CC BY-SA** (2.1 JP / 4.0): exige atribuição e
share-alike nos modelos, além de somar MB de malha ao bundle — e o app não tem OTA, então
todo MB volta como rebuild.

*(Conteúdo das fontes resumido/parafraseado por questões de licenciamento.)*

### 6.2 Proposta: vistas em vez de rotação contínua

Trocar "girar 360º" por **4 vistas** — anterior, posterior, lateral, medial — com setinhas
ou swipe. Cada vista é um `TabuleiroCorpo` 2D no motor que já existe: zero dependência
nova, zero risco de crash nativo, e o ganho pedagógico é praticamente o mesmo, porque o que
o aluno precisa saber é *em que vista* cada acidente ósseo aparece ("a patela só se vê na
anterior", "a cabeça da fíbula você acha na lateral").

Extensão de schema mínima (não quebra nada):

```ts
vista?: "anterior" | "posterior" | "lateral" | "medial";
/** regiões-filhas: o joelho é um recorte ampliado da perna */
paiId?: string;
```

Agrupar tabuleiros por `(regiao, vista)` e trocar a vista sem sair da tela — o progresso
por região continua igual, cada vista conta como um tabuleiro.

### 6.3 Regiões detalhadas (o que motivou a pergunta)

Hoje a perna inteira tem 4 peças, então o joelho aparece como "só a patela". Um tabuleiro
**joelho** ampliado pediria:

| Peça | Observação |
|---|---|
| fêmur distal — côndilo medial, côndilo lateral, tróclea | acidentes, não ossos separados |
| tíbia proximal — platô medial/lateral, tuberosidade | |
| **patela** | único osso exclusivo do joelho; sesamoide do tendão do quadríceps |
| cabeça da fíbula | articula com a tíbia (tibiofibular proximal), vizinha ao joelho |
| fabela | sesamoide inconstante, atrás do côndilo lateral; prevalência varia muito entre estudos |

Menisco e ligamentos não são osso — entram depois, se o jogo passar a aceitar peças de
tecido mole (aí o `sistema` do tabuleiro deixa de ser só `ossos`).

**O bloqueio aqui é conteúdo, não código.** Nomear "côndilo medial" a partir do recorte de
uma perna inteira significaria o gerador *afirmar* um nome que a ilustração não rotula — e
`gerar_montar.py` foi feito para falhar em vez de nomear osso errado em silêncio. O caminho
honesto é uma ilustração **rotulada** de joelho em domínio público (ou CC compatível)
passada pelo mesmo pipeline, com revisão por fisioterapeuta antes de publicar.

### 6.4 Busca de fontes no Commons — resultado (2026-09-10)

O pipeline de `gerar_montar.py` exige **três** coisas da ilustração, e é a terceira que
elimina quase tudo:

1. rótulos de texto **em inglês** (`<text>`);
2. **linhas-guia vermelhas** ligando rótulo → estrutura (é assim que o hotspot nasce);
3. cada osso como **grupo de topo separado** — sem isso não há o que recortar como peça.

Candidatas avaliadas, com o veredito medido (não estimado — rodei os próprios helpers do
projeto contra cada arquivo):

| Arquivo | Licença | Rótulos EN | Guia vermelha | Ossos separáveis | Veredito |
|---|---|---|---|---|---|
| `Human leg bones labeled.svg` *(em uso)* | PD | ✅ | ✅ | ✅ 4/4 | é o jogo hoje |
| `Knee diagram.svg` *(em uso nas pranchas)* | PD | ✅ 19 hotspots | ✅ | ❌ **0** — tudo numa camada que cobre 100% da largura | serve para prancha, não para montar |
| `Human arm bones diagram.svg` *(em uso)* | PD | ✅ 23 hotspots | ✅ | ❌ **1/5** — clavícula+escápula no grupo #49, rádio+ulna no #50, carpo+metacarpo+falanges no #52 | idem |
| `202108 Anterior/Lateral/Posterior view of knee joint.svg` (DBCLS) | CC BY 4.0 | ❌ nenhum `<text>` | ❌ | ❌ export do Illustrator (`<switch>` + `aipgf`) | **trio de vistas ideal no conceito, inútil no formato** |
| `Knee skeleton lateral anterior views.svg` (P. J. Lynch) | CC BY 2.5 | ❌ | ❌ | ~36 paths anônimos | precisaria nomear osso à mão |
| `Upper Limb Bones.svg` | checar | ✅ + "ANTERIOR VIEW"/"POSTERIOR VIEW" | ❌ | ❌ um `<g>` de 2,1 MB | tem as duas vistas rotuladas; guia não é vermelha |
| `Human Arm Bones (NIH BioArt)` | PD (NIH) | ❌ | ❌ | 26 paths de topo | precisaria nomear à mão |
| `Huesos del miembro superior.svg` | checar | ⚠ espanhol | ❌ | 126 filhos de topo (promissor) | rótulo fora do idioma do catálogo |

Tudo que se chama "bones labeled" no Commons é **tradução do mesmo arquivo da perna**.

Segunda rodada de busca (mesmo dia), descendo a árvore inteira dos SVGs em vez de só os
filhos da raiz — porque a restrição "grupo de topo" era minha, não do arquivo:

- `Knee diagram.svg`: 104 nós que pintam, profundidade até 3. **Fêmur, tíbia, patela,
  fíbula e cartilagem articular caem todos no MESMO path**, que cobre 100% da largura —
  os ossos estão desenhados como uma silhueta única. Não é limitação do gerador: não
  existe geometria separada para recortar. Encerrado.
- `Human skeleton front en.svg` + `Human skeleton back en.svg` (LadyofHats, PD): seriam o
  par anterior/posterior perfeito, e têm 729 nós com geometria bem separada. Mas os
  rótulos são uma **lista em coluna**, então o pareamento texto↔osso sai concatenado
  ("Femur Patella Tibia Fibula" como um rótulo só) e aponta para osso errado. Precisaria
  de um pareamento próprio para rótulo-em-lista, não do mecanismo de linha-guia.

**Conclusão da mineração de ilustrações: esgotada.** Nenhuma fonte 2D do Commons entrega
as três coisas ao mesmo tempo (nome confiável + geometria por osso + segundo ângulo).

### 6.4.1 O caminho que resolve os três de uma vez: BodyParts3D

Verificado como acessível em 2026-09-10:

| Recurso | URL | Fato medido |
|---|---|---|
| Malhas por estrutura | `dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_BP3D_4.0_obj_99.zip` | **136,3 MB** (só para o gerador; o app não embarca malha) |
| Nomes autoritativos | `.../isa_parts_list_e.txt` | **2906 estruturas** com id FMA + nome em inglês |
| Sistema de coordenadas | `.../coordinate_system.png` | documentado e **comum a todas as malhas** |

Ossos do joelho confirmados na lista, já lateralizados:
`FMA24475 left femur`, `FMA24478 left tibia`, `FMA24481 left fibula`, `FMA24487 left patella`
(e os direitos correspondentes). Também há `talus`, `hip bone`, `sacrum`, `humerus`,
`scapula`, `clavicle`, `radius`, `ulna` — ou seja, várias regiões novas.

Por que isso resolve tudo: as malhas **compartilham um sistema de coordenadas**, então
projetar o mesmo conjunto de ossos com uma matriz diferente dá anterior, lateral,
posterior e medial *já alinhados entre si* — `destino` e `tamanho` saem da mesma projeção.
Girar 360º deixa de depender de achar ilustração e passa a ser trocar a matriz. E o nome
vem do FMA, não de um palpite nosso.

Pipeline necessário (~300 linhas de Python novo, sem dependência externa):
malha OBJ → projeção ortográfica → rasterização dos triângulos → contorno por marching
squares → simplificação Douglas–Peucker → `path` SVG.

Duas coisas exigem decisão do dono do projeto antes de começar:

1. **Licença.** BodyParts3D é **CC BY-SA 2.1 JP**: exige atribuição (o jogo já mostra
   crédito) e **share-alike na geometria gerada** — os módulos `montar-*.ts` derivados
   passariam a carregar essa licença no cabeçalho. Não contamina o código do app, mas
   contamina os arquivos de dados gerados.
2. **Menisco não existe lá.** Busquei nas duas listas (`isa` e `partof`): **0 ocorrências**
   de `meniscus`, e nenhum cruzado. O acervo é osso e órgão; tecido mole do joelho está
   fora. Menisco e ligamentos precisariam de outra fonte ou de geometria autoral com
   revisão de fisioterapeuta — e aí o `sistema` do tabuleiro deixa de ser só `ossos`.

### 6.5 O que já está pronto

- **Zoom/pan no tabuleiro** (`Lente` em `src/games/montar.ts`): pinça, dois dedos para
  passear, duplo-toque que aproxima no ponto tocado, botões `−/+/⟲` para quem não faz
  pinça. Limitado a 4× e preso à moldura.
- A lente é **só visão**: o encaixe continua em frações do tabuleiro, então ampliar 3×
  triplica a folga em pixels sem afrouxar a exigência anatômica. É o que torna viável
  pedir osso pequeno em lugar específico — verificado em `scripts/verificar-montar.ts`
  (cenário 5e: com 3× de zoom, toda peça continua encaixando no lugar dela).
- **Mecanismo de vistas** (2026-09-10): `vista` e `regiaoId` no schema, `ORDEM_VISTAS`
  (anterior → lateral → posterior → medial, cíclico), `girarVista`, `vistasDaRegiao`,
  `regiaoConcluida`, `regiaoVizinha` e `regioesEmOrdem` em `src/games/montar.ts`.
  Setinhas `◀ ▶` no cabeçalho + swipe horizontal no tabuleiro.

  Duas decisões que valem registro:

  1. **`regiaoLiberada` passou a raciocinar por região, não por tabuleiro.** Dentro de uma
     região as vistas são livres; exigir a vista de frente para poder olhar a de lado
     trancaria justamente o giro. Uma região só conta como concluída quando **todas** as
     vistas dela foram montadas, e é isso que libera a região seguinte.
  2. ~~As setinhas nunca ficam mortas: enquanto a região tem uma vista só, elas trocam de
     região.~~ **Revertido no mesmo dia — era erro de projeto.** Na prática o gesto de
     girar passou a trocar de perna, que é o oposto do que ele promete: quem arrasta para o
     lado quer ver a MESMA região de outro ângulo. Agora setinha e swipe só giram vista, e
     ficam apagadas (mas explicam o motivo ao toque) quando a região tem ângulo único.
     Trocar de região virou intenção separada: o "região 1 de 2 ⇄" do HUD, que usa
     `regiaoVizinha` e respeita o desbloqueio.

     Lição para o resto do app: fallback silencioso que muda o SIGNIFICADO de um gesto é
     pior que botão desabilitado. O desabilitado ensina o estado do conteúdo; o fallback
     ensina errado.

  O giro está verificado com um **joelho fictício de 3 vistas** (cenário 6b): é a única
  forma de exercitar ciclagem e desbloqueio antes de existir a ilustração.
