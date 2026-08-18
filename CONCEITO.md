# FisioPlay — App de Jogos Educativos de Fisioterapia

> Documento de conceito (v1). Nome de trabalho: **FisioPlay** (aberto a mudança).

## 1. Visão

Um app mobile (Android + iOS) que ensina e fixa conhecimento de fisioterapia
através de **minijogos rápidos e viciantes**. O usuário escolhe uma **trilha**
(área de conhecimento) e acumula pontos por área conforme joga — cada formato de
jogo treina um tipo diferente de memória (evocação, reconhecimento, associação,
raciocínio clínico).

**Princípio central:** sessões curtas (1–3 min), feedback imediato e satisfatório,
progressão visível. É isso que gera retorno diário ("vício saudável").

## 2. Público

Estudantes e profissionais de fisioterapia que querem revisar/fixar conteúdo de
forma leve, no celular, em qualquer momento livre.

## 3. Stack técnica

Single codebase em JavaScript/TypeScript:

- **React Native + Expo** (managed workflow) — build para iOS e Android
- **Expo Router** — navegação baseada em arquivos
- **TypeScript** — segurança de tipos (recomendado mesmo vindo de JS)
- **Reanimated 3 + Gesture Handler** — animações a 60fps na UI thread (fluidez sem travar)
- **Moti** — animações declarativas (fade/scale/spring)
- **Lottie (lottie-react-native)** — animações ricas de celebração/feedback
- **NativeWind** — Tailwind no RN para um design system moderno e consistente
- **Zustand** — estado global simples (progresso, pontuação)
- **expo-sqlite** ou **AsyncStorage** — persistência local do progresso
- **expo-haptics** + **expo-av** — vibração e sons de feedback (reforço do "vício")

## 4. Arquitetura de trilhas e pontuação

- Cada **trilha** = uma área de conhecimento (ex: Anatomia, Cinesiologia).
- Cada trilha tem um **banco de conteúdo** (termos, definições, perguntas, imagens).
- Qualquer minijogo consome o banco da trilha selecionada.
- O usuário pontua **por trilha/área**, não só num placar geral → mostra em quais
  áreas ele é forte/fraco.

Trilhas iniciais sugeridas:
- Anatomia
- Cinesiologia
- Ortopedia / Traumatologia
- Neurofuncional
- Cardiorrespiratória
- Eletrotermofototerapia

## 5. Catálogo de minijogos

Agrupados pelo tipo de aprendizado que treinam:

**Evocação (lembrar do zero)**
- Jogo da forca — termos técnicos
- Complete a palavra — lacunas em definições/conceitos
- Cruzadinha temática

**Reconhecimento e velocidade**
- Quiz de múltipla escolha (com timer + streak de acertos)
- Verdadeiro ou Falso relâmpago
- Caça-palavras por área

**Associação (ligar conceitos)**
- Jogo da memória — pares "termo ↔ definição" / "músculo ↔ função"
- Colunas A-B — associar (ex: patologia ↔ conduta, origem ↔ inserção)
- Arrastar e soltar sobre imagem de anatomia

**Raciocínio clínico**
- Ordene os passos — sequência de um protocolo de reabilitação
- "Qual a conduta?" — mini-casos clínicos

## 6. Gamificação (o motor de retenção)

- **Pontos por área de conhecimento** (dashboard de forças/fraquezas)
- **XP e níveis** globais
- **Ofensiva diária (streak)** — jogar todo dia mantém a chama
- **Medalhas** por trilha concluída e por marcos (ex: 100 acertos seguidos)
- **Feedback multissensorial**: animação (Lottie/confete) + som + haptic a cada acerto
- Opcional (futuro): ranking / desafios entre amigos

## 7. Diretrizes de design

Meta: moderno, impactante e "viciante", com performance impecável.

- **Visual**: cores vibrantes com bom contraste, cantos arredondados generosos,
  tipografia forte, dark mode nativo. Referências de vibe: Duolingo, Elevate, Peak.
- **Movimento**: micro-interações em tudo (botão que "afunda" ao tocar, cards com
  spring, transições de tela suaves). Nunca uma tela estática/sem vida.
- **Feedback**: acerto = explosão de cor + som curto + haptic; erro = shake sutil +
  cor de alerta, sem punir demais.
- **Performance**: animações sempre via Reanimated (UI thread), listas com
  FlashList, imagens otimizadas. Regra: **nada bloqueia a thread de JS durante o jogo.**
- **Sessão curta**: cada partida cabe em 1–3 minutos.

## 8. MVP (primeira versão jogável)

Escopo enxuto pra validar rápido:

1. **1 trilha** com conteúdo real (ex: Anatomia) — banco de ~50 itens
2. **3 minijogos**: Quiz, Jogo da Forca, Jogo da Memória
3. Tela inicial com escolha de trilha + jogo
4. Sistema de pontuação por trilha (persistência local)
5. Streak diária + animações de acerto/erro
6. Dark mode + design system base (NativeWind)

Depois do MVP: mais trilhas, mais jogos, ranking, sincronização em nuvem, conta de usuário.

## 9. Modelo de dados (rascunho)

```ts
type Trilha = { id: string; nome: string; cor: string; icone: string };

type Item = {
  id: string;
  trilhaId: string;
  termo: string;          // ex: "Escápula"
  definicao: string;      // usado em quiz/memória/complete
  imagem?: string;        // opcional (anatomia)
  dificuldade: 1 | 2 | 3;
  fonte: string;          // nome da fonte, ex: "OpenStax A&P 2e (CC BY 4.0)"
  urlFonte: string;       // link de redirecionamento p/ o aluno conferir
};

type Pergunta = {           // derivada de Item ou própria
  id: string;
  trilhaId: string;
  enunciado: string;
  alternativas: string[];
  correta: number;          // índice
};

type Progresso = {
  pontosPorTrilha: Record<string, number>;
  xp: number;
  streakDias: number;
  ultimoJogoISO: string;
};
```

## 10. Próximos passos

- [ ] Validar/ajustar o conceito e o nome
- [ ] Definir a 1ª trilha e reunir o banco de conteúdo (com fonte confiável)
- [ ] Criar o projeto Expo + design system base
- [ ] Implementar o primeiro jogo (sugestão: Quiz — é a base pros outros)

## 11. Fontes de conteúdo

Regra de ouro: **fonte confiável ≠ conteúdo copiável.** Todo item exibe a fonte
com link de redirecionamento (campos `fonte` + `urlFonte`), para o aluno conferir.

⚠️ **Decisão do projeto:** o app é **GRATUITO / não-comercial**. Isso libera reusar
conteúdo `CC BY`, `CC BY-SA`, `CC BY-NC` e `CC BY-NC-SA` (sempre com atribuição; e
com ShareAlike quando a licença for `SA`). Continua **proibido** reusar/adaptar
conteúdo `ND` (NoDerivatives) — esse é só citação/link.
Atenção futura: se um dia entrar **anúncio/monetização**, o conteúdo `NC` deixa de
ser permitido → por segurança, manter o núcleo do banco em `CC BY` / domínio público.

### 11.1 Extraíveis (licença aberta — pode copiar/adaptar/traduzir com atribuição)

| Fonte | Licença | Uso |
|---|---|---|
| OpenStax — Anatomy & Physiology 2e | CC BY 4.0 | Base de Anatomia/Fisiologia. Em inglês → traduzir. https://openstax.org/books/anatomy-and-physiology-2e |
| LibreTexts — Human Anatomy (OERI) e A&P 2e | CC BY (checar; alguns CC BY-NC-SA) | Capítulos organizados. https://med.libretexts.org |
| OpenTextBC / BCcampus | CC BY (checar por livro) | Livros-texto abertos. https://opentextbc.ca |
| OER Commons (Anatomy & Physiology) | varia (checar por recurso) | Quizzes, diagramas. https://oercommons.org |
| SciELO Brasil | maioria CC BY | Artigos em PT para conduta/patologias. https://www.scielo.br |
| Wikimedia Commons | domínio público / CC (checar por imagem) | Imagens de anatomia |

### 11.2 Autoridade — CITAR e LINKAR (não copiar/alterar o texto)

| Fonte | Observação |
|---|---|
| StatPearls / NCBI Bookshelf | CC BY-NC-ND 4.0 → distribuir sim, alterar/comercializar não → só link. https://www.ncbi.nlm.nih.gov/books |
| Physiopedia | Revisada por fisioterapeutas. ToS restritivo + licença paga p/ dataset → só link. https://www.physio-pedia.com |
| PEDro | +68.000 ensaios/revisões/diretrizes, interface PT. https://pedro.org.au/portuguese |
| Kenhub / TeachMeAnatomy | Referência de anatomia, proprietária → só link |
| COFFITO / Ministério da Saúde (BVS-MS) | Autoridade oficial no Brasil. https://bvsms.saude.gov.br |
| WHO Rehabilitation | Diretrizes internacionais |

### 11.3 Universidades e repositórios (licença MISTA — verificar item a item)

Cada tese/artigo tem a própria licença. Use como referência/citação; só extraia
itens explicitamente marcados como CC.

| Fonte | Link |
|---|---|
| Repositório da Produção USP (inclui EEFE/Fisioterapia) | https://repositorio.usp.br |
| Repositório Institucional UNIFESP | https://repositorio.unifesp.br |
| Portal de Periódicos CAPES (acesso aberto) | https://www.periodicos.capes.gov.br |
| BVS Regional (América Latina) | https://bvsalud.org |

**Fluxo de produção do banco:** extrair conceitos das fontes 11.1 (CC BY/PD) →
traduzir/adaptar para PT-BR → revisão por um fisioterapeuta antes de publicar →
cada item guarda `fonte` + `urlFonte`. As fontes 11.2 e 11.3 entram como link
"Saiba mais / Ver fonte", nunca como cópia.
