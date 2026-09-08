# FisioPlay 💜

Aplicativo de estudos gamificado para fisioterapia: **8 jogos** sobre um banco de
**300 itens** distribuídos em **6 trilhas** clínicas. Funciona **100% offline**, sem
login e sem coletar nenhum dado.

Feito em React Native + Expo, com tema escuro e layout de coluna única pensado
para uso no celular durante intervalos de estudo.

> ⚠️ **Aviso médico.** Este é um app **educativo**, voltado a estudantes de
> fisioterapia. O conteúdo **não substitui** a orientação de um profissional de
> saúde e **não deve ser usado para decisão clínica**. O banco de itens ainda
> aguarda sign-off de fisioterapeuta licenciado — veja
> [PUBLICAR.md](PUBLICAR.md).

## Trilhas

| Trilha | id | itens |
|---|---|---|
| Anatomia | `anatomia` | 50 |
| Ortopedia | `ortopedia` | 50 |
| Neurofuncional | `neuro` | 50 |
| Cardiorrespiratória | `cardio` | 50 |
| Saúde da Mulher | `saude-mulher` | 50 |
| Saúde Geral | `saude-geral` | 50 |

Cada item carrega a **fonte** e a **URL da fonte**; a maioria também tem imagem
com crédito e licença próprios.

## Jogos

Seis jogos rodam em qualquer trilha. Dois são condicionais: aparecem só nas
trilhas que têm o banco de dados necessário.

| Jogo | Tela | O que treina |
|---|---|---|
| Quiz | `app/jogo/quiz.tsx` | definição → estrutura, contra o relógio |
| Forca | `app/jogo/forca.tsx` | recuperar o termo pela dica, letra a letra |
| Complete a palavra | `app/jogo/completar.tsx` | preencher as letras que faltam |
| Verdadeiro ou Falso | `app/jogo/vf.tsx` | julgar se a definição bate com o termo |
| Memória | `app/jogo/memoria.tsx` | casar estrutura com definição |
| Colunas A–B | `app/jogo/colunas.tsx` | ligar termo à definição |
| Arraste na prancha | `app/jogo/arrastar.tsx` | localizar estruturas no diagrama (só Anatomia) |
| Qual a conduta? | `app/jogo/conduta.tsx` | escolher conduta em mini-caso clínico |

Gamificação: XP e nível, streak de dias, pontos por trilha, confete, haptics e
som de feedback. Progresso persistido localmente via AsyncStorage.

## Rodando o projeto

```bash
npm install

# navegador (mais rápido para iterar)
npx expo start --web --port 8081   # http://127.0.0.1:8081

# celular
npx eas build -p android --profile preview   # gera um APK instalável
```

> **Expo Go não serve.** O projeto usa Expo SDK 57, que exige um *development
> build* ou o APK do perfil `preview`. Os perfis de build estão em
> [eas.json](eas.json).

Verificar o ambiente antes de abrir um issue de build:

```bash
npx expo-doctor     # deve dar 21/21
npx tsc --noEmit    # deve sair limpo
```

## Estrutura

```
app/            rotas (Expo Router) — telas e jogos
src/games/      lógica pura de cada jogo, sem UI e testável isolada
src/data/       banco de conteúdo: trilhas, casos clínicos, pranchas
src/lib/        carregadores de dados, geração de perguntas, feedback
src/store/      estado global (Zustand): progresso e perfil
src/components/ componentes visuais compartilhados
src/theme/      tokens de design, espelhados em tailwind.config.js
scripts/        verificação de lógica e geração de assets
```

A lógica de cada jogo vive em `src/games/` **separada da tela**, e cada uma tem um
verificador que roda sem UI:

```bash
npx tsx scripts/verificar-quiz.ts    # idem para forca, memoria, colunas, vf, …
npx tsx scripts/verificar-montar.ts  # jogo "Montar o corpo" (dados + encaixe)
npx tsx scripts/verificar-perfil.ts  # persistência das fotos do perfil
```

O jogo **Montar o corpo** tem os tabuleiros gerados a partir das mesmas
ilustrações de domínio público das pranchas, com cada osso extraído como peça
própria:

```bash
python3 scripts/gerar_montar.py --inspecionar   # mostra o que casaria, sem escrever
python3 scripts/gerar_montar.py                 # gera peças + anatomia-montar.json
```

Duas coisas valem saber sobre esse gerador. Ele identifica as peças pelo rótulo
em inglês da ilustração (mesma lógica auditável do `gerar_pranchas.py`) e, no
lado sem rótulo, por **espelhamento com verificação**: casa por forma e falha se
os eixos de simetria implícitos discordarem, em vez de nomear osso errado em
silêncio. E ele usa `pontos_do_path(..., achatar_curvas=True)`, porque a
aproximação por pontos de controle — boa para recortar prancha — superestimaria a
peça e o encaixe sairia torto.

As fotos do perfil (avatar e "momentos") são gravadas **uma por chave** do
AsyncStorage, e não junto do resto do perfil: no Android cada registro é lido por
um CursorWindow do SQLite, com teto de ~2 MB **por linha**, e avatar + 8 fotos em
base64 na mesma chave passavam desse teto. A leitura falhava, o `persist` do
zustand engolia o erro e o app abria com o perfil zerado — as fotos "sumiam" sem
aviso. Detalhes em `src/lib/fotosPerfil.ts`.

Antes de gravar, a foto é reduzida para no máximo 1024 px no maior lado e
comprimida (`expo-image-manipulator`, regras em `src/lib/reduzirFoto.ts`), então
o orçamento por foto quase nunca é atingido.

> ⚠️ `expo-image-manipulator` é **módulo nativo**: depois de instalá-lo é preciso
> gerar um build novo (`eas build`, ou `npx expo run:android`/`run:ios` no
> desenvolvimento). Recarregar o JS num build antigo não basta — o módulo não
> existe lá e a escolha de foto vai falhar.

O banco de conteúdo tem um verificador próprio, que trava conteúdo duplicado:

```bash
npx tsx scripts/verificar-duplicatas.ts            # falha se houver duplicação
npx tsx scripts/verificar-duplicatas.ts --listar   # top 25 pares, p/ calibrar
```

Um conceito **pode** aparecer em mais de uma trilha, desde que cada trilha o
aborde pelo seu recorte — "Frequência cardíaca" é controle autonômico em Cardio
e técnica de aferição do pulso em Saúde Geral. O que o verificador reprova é a
mesma definição repetida, porque os jogos leem todos os mesmos `itens` da trilha
e o quiz usa `definicao` como enunciado: definição repetida vira a mesma
pergunta em dois lugares, e definição parecida dentro de uma trilha vira
pergunta ambígua.

## Stack

React Native 0.86 · Expo SDK 57 · Expo Router · NativeWind 4 (Tailwind) ·
Zustand 5 + AsyncStorage · Reanimated 4 · Moti · react-native-svg ·
expo-audio · expo-haptics

## Privacidade

O app é offline-first: **não** tem login, **não** faz requisição de telemetria e
**não** envia nada para servidor. Fotos escolhidas no perfil e o progresso ficam
apenas no aparelho. Detalhes em [POLITICA_PRIVACIDADE.md](POLITICA_PRIVACIDADE.md).

Os botões "Ver fonte" abrem o navegador do sistema numa URL pública — é a única
saída de rede do app.

## Conteúdo e licenças

O **código** está sob [MIT](LICENSE). O **conteúdo** tem procedências distintas:

- **Textos e definições** — redação própria, baseada em
  [OpenStax Anatomy & Physiology 2e](https://openstax.org/details/books/anatomy-and-physiology-2e)
  (CC BY 4.0, adaptado).
- **Imagens** — Wikimedia Commons, com crédito e licença exibidos por imagem
  dentro do app.
- **StatPearls** — usado apenas como referência por link (CC BY-NC-ND), nunca
  copiado.
- **Sons** (`assets/sounds/*.wav`) — gerados por síntese pelo próprio projeto via
  [`scripts/gerar_sons.py`](scripts/gerar_sons.py); sem amostra de terceiros.

A tela "Sobre & créditos" dentro do app (`app/sobre.tsx`) reproduz esses créditos
para o usuário final.

## Documentos do projeto

- [CONCEITO.md](CONCEITO.md) — visão e decisões de produto
- [ESTADO.md](ESTADO.md) — estado atual, para retomar o trabalho
- [ROADMAP.md](ROADMAP.md) — fases de desenvolvimento
- [MATERIAS.md](MATERIAS.md) — plano de conteúdo das trilhas
- [JOGOS-FUTUROS.md](JOGOS-FUTUROS.md) — jogos ainda não implementados
- [PUBLICAR.md](PUBLICAR.md) — checklist de publicação nas lojas

A revisão clínica do banco (pasta `revisao/`) é mantida **fora** deste
repositório até o sign-off profissional, para que relatórios gerados por IA não
sejam citados como se fossem material revisado.
