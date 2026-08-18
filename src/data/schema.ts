// Schema de dados do FisioPlay (rascunho no CONCEITO.md, seção 9).

/** Uma área de conhecimento (ex: Anatomia, Cinesiologia). */
export type Trilha = {
  id: string;
  nome: string;
  cor: string;
  icone: string;
};

/** Item de conteúdo de uma trilha — matéria-prima dos jogos. */
export type Item = {
  id: string;
  trilhaId: string;
  /** ex: "Escápula" */
  termo: string;
  /** usado em quiz/memória/complete */
  definicao: string;
  /** opcional (anatomia) */
  imagem?: string;
  /** crédito curto da imagem: "<autor> · <licença>" */
  imagemCredito?: string;
  /** URL da página do arquivo no Wikimedia Commons (atribuição/licença completas) */
  imagemFonte?: string;
  dificuldade: 1 | 2 | 3;
  /** nome da fonte, ex: "OpenStax A&P 2e (CC BY 4.0)" */
  fonte: string;
  /** link p/ o aluno conferir a fonte */
  urlFonte: string;
};

/** Pergunta de quiz — derivada de um Item ou própria. */
export type Pergunta = {
  id: string;
  trilhaId: string;
  enunciado: string;
  alternativas: string[];
  /** índice da alternativa correta em `alternativas` */
  correta: number;
};

/**
 * Nível de evidência de uma conduta (alinhado ao ESQUEMA-REVISAO.md).
 * Ordenado do mais forte ao mais fraco.
 */
export type NivelEvidencia =
  | "comprovado"
  | "convencional"
  | "nao_convencional_aceito"
  | "controverso"
  | "insuficiente";

/**
 * Uma conduta clinicamente válida para um caso. Um mesmo caso pode ter
 * VÁRIAS condutas válidas (multi-conduta) — a melhor escolha depende do
 * perfil do paciente, capturado em `indicadoQuando`.
 */
export type CondutaValida = {
  /** texto da conduta/opção exibida ao jogador */
  conduta: string;
  /** força da evidência que sustenta esta conduta */
  nivelEvidencia: NivelEvidencia;
  /** contexto: em que perfil de caso esta conduta é a indicada */
  indicadoQuando?: string;
  /** justificativa específica (feedback pós-resposta) */
  justificativa?: string;
  /** fonte específica desta conduta (opcional; senão usa a do caso) */
  fonte?: string;
  /** link da fonte específica (opcional) */
  urlFonte?: string;
};

/**
 * Item de raciocínio clínico — matéria-prima do jogo "Qual a conduta?".
 *
 * Suporta dois formatos (o loader/jogo aceitam ambos):
 *  - **legado (conduta única):** `opcoes` + `correta` — uma resposta certa.
 *  - **multi-conduta:** `condutas[]` (todas válidas) + `distratores[]`
 *    (condutas inadequadas) — o jogador marca TODAS as adequadas.
 */
export type CasoClinico = {
  id: string;
  trilhaId: string;
  /** enunciado do mini-caso clínico */
  caso: string;
  /** explicação mostrada no feedback */
  explicacao: string;
  fonte: string;
  urlFonte: string;

  // --- formato legado (conduta única) ---
  /** condutas/hipóteses possíveis */
  opcoes?: string[];
  /** índice da opção correta em `opcoes` */
  correta?: number;

  // --- formato multi-conduta ---
  /** condutas válidas (>= 1). Se presente, o caso é multi-conduta. */
  condutas?: CondutaValida[];
  /** condutas inadequadas/incorretas (opções erradas) */
  distratores?: string[];
};

/**
 * Perfil personalizável do usuário (a Isa 💜). 100% local/offline: as fotos
 * são guardadas como data URI (base64) no AsyncStorage — nada é enviado.
 */
export type Perfil = {
  /** nome/apelido exibido na home */
  nome: string;
  /** frase carinhosa/motivacional que aparece junto do avatar */
  frase: string;
  /** avatar em data URI (base64) para persistir offline em qualquer plataforma */
  avatarUri: string | null;
  /** cor de destaque escolhida (hex) usada nos elementos personalizados */
  corTema: string;
  /** fotos "momentos" (data URIs) que viram a torcida animada na home */
  momentos: string[];
};

/** Progresso persistido do usuário. */
export type Progresso = {
  pontosPorTrilha: Record<string, number>;
  xp: number;
  streakDias: number;
  ultimoJogoISO: string | null;
};

/** Um alvo (hotspot) numa prancha do jogo "Arrastar na anatomia". */
export type AlvoAnatomia = {
  id: string;
  /** texto do chip a arrastar, ex: "Fêmur" */
  rotulo: string;
  /** centro do alvo, proporção da largura da imagem (0..1) */
  x: number;
  /** centro do alvo, proporção da altura da imagem (0..1) */
  y: number;
  /** tolerância de acerto (fração da largura); default no jogo */
  raio?: number;
};

/** Uma prancha (imagem com vários alvos) do jogo "Arrastar na anatomia". */
export type PranchaAnatomia = {
  id: string;
  trilhaId: string;
  titulo: string;
  /** chave de um diagrama SVG autoral (ver components/pranchas). Alternativo a `imagem`. */
  diagrama?: string;
  /** URL da imagem (verificada); alternativo a `diagrama` */
  imagem?: string;
  imagemCredito?: string;
  imagemFonte?: string;
  /** proporção largura/altura da imagem, para layout responsivo */
  aspecto: number;
  alvos: AlvoAnatomia[];
  fonte: string;
  urlFonte?: string;
};
