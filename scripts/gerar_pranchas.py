#!/usr/bin/env python3
"""
Gera as pranchas do jogo "Arrastar na anatomia" a partir de ilustrações
anatômicas reais de domínio público do Wikimedia Commons.

O truque: as pranchas didáticas do Commons já vêm com rótulos ligados por uma
linha-guia vermelha terminando numa bolinha exatamente sobre a estrutura. Então:

  1. baixa o SVG original;
  2. descobre os hotspots — a ponta "de dentro" de cada linha-guia vermelha;
  3. descobre a que estrutura cada hotspot pertence, lendo o rótulo em inglês
     que a linha-guia conecta (o mapeamento inglês → português é declarado em
     PRANCHAS, então um rótulo novo/renomeado quebra o script em vez de gerar
     alvo errado em silêncio);
  4. remove os rótulos (<switch>/<text>) e toda a marcação vermelha, sobrando só
     o desenho anatômico;
  5. recorta o viewBox no desenho e normaliza os hotspots para 0..1;
  6. escreve o SVG limpo em src/components/pranchas/svg/ e faz merge dos alvos
     em src/data/anatomia-arrastar.json.

Resultado: desenho anatômico realista, vetorial, offline e sem rótulo entregando
a resposta — com os alvos nas coordenadas que o próprio ilustrador marcou.

Rodar:  python3 scripts/gerar_pranchas.py            (todas)
        python3 scripts/gerar_pranchas.py ossos-mmii (só uma)
        python3 scripts/gerar_pranchas.py --inspecionar ossos-mmii
"""
from __future__ import annotations

import json
import math
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from svgtools import (  # noqa: E402
    IDENTIDADE,
    SVG_NS,
    Matriz,
    Ponto,
    aplicar,
    bbox,
    coletar_css,
    cores_do_elemento,
    css_do_elemento,
    eh_vermelho,
    multiplicar,
    nao_pinta_nada,
    parse_transform,
    pintura,
    pontos_do_elemento,
    unir_bbox,
)

RAIZ = Path(__file__).resolve().parent.parent
DIR_SVG = RAIZ / "src" / "components" / "pranchas" / "svg"
JSON_PRANCHAS = RAIZ / "src" / "data" / "anatomia-arrastar.json"

USER_AGENT = (
    "FisioPlay/1.0.0 (app educativo de fisioterapia; "
    "https://expo.dev/@izaiasr/fisioplay)"
)

# Folga em volta do desenho, em % da maior dimensão do recorte.
MARGEM = 0.02


# --- catálogo -----------------------------------------------------------------
#
# `alvos` é keyed pelo rótulo EM INGLÊS que existe no SVG original. Assim o
# mapeamento é auditável: se o Commons renomear/remover um rótulo, o script falha
# em vez de gerar alvo errado em silêncio.
#
# Cada alvo aceita:
#   id      — id do alvo no jogo (obrigatório)
#   rotulo  — texto do chip, em português (obrigatório)
#   raio    — tolerância de acerto como fração da largura (default 0.1 no jogo).
#             Vale reduzir quando duas estruturas são vizinhas de verdade.
#   pos     — (x, y) em unidades do SVG de origem, para SOBRESCREVER o ponto que
#             a linha-guia marcava. Usar só com verificação visual, e sempre com
#             `nota` explicando o porquê.
#   nota    — justificativa de um `pos` manual (fica no código, não no app).

PRANCHAS: list[dict] = [
    {
        "id": "ossos-mmii",
        "trilhaId": "anatomia",
        "titulo": "Ossos do membro inferior",
        "arquivo": "Human leg bones labeled.svg",
        "diagrama": "prancha-mmii",
        # A prancha completa (crista ilíaca aos dedos) dá proporção ~1:3, que não
        # cabe em tela de celular sem virar um filete. Enquadra do acetábulo aos
        # maléolos: mantém os 4 alvos com contexto de quadril e tornozelo.
        "recorte": {"y0": 72, "y1": 448},
        "alvos": {
            "Femur": {"id": "femur", "rotulo": "Fêmur"},
            "Patella": {"id": "patela", "rotulo": "Patela"},
            "Tibia": {"id": "tibia", "rotulo": "Tíbia"},
            "Fibula": {"id": "fibula", "rotulo": "Fíbula"},
        },
        "fonte": "Wikimedia Commons — domínio público (rótulos removidos)",
        "credito": "Jecowa · Wikimedia Commons · domínio público",
    },
    {
        "id": "joelho",
        "trilhaId": "anatomia",
        "titulo": "Articulação do joelho",
        "arquivo": "Knee diagram.svg",
        "diagrama": "prancha-joelho",
        # Esta prancha tem 13 rótulos, vários deles ligamentos vizinhos (LCA/LCP,
        # menisco, cartilagem) com linhas-guia curtas saindo dos DOIS lados. O
        # pareamento automático texto↔linha erra nesses casos, e ligamento trocado
        # num app de estudo ensina errado — pior que desenho feio.
        #
        # Então aqui entram só os 4 alvos cuja linha-guia é longa, única e
        # inequívoca (os mesmos 4 do diagrama antigo, agora com desenho real).
        # Os ligamentos ficam para uma rodada com revisão de fisioterapeuta,
        # que o ROADMAP já prevê na Fase 6.
        "alvos": {
            "Femur": {"id": "femur", "rotulo": "Fêmur"},
            "Patella": {"id": "patela", "rotulo": "Patela"},
            "Tibia": {"id": "tibia", "rotulo": "Tíbia"},
            "Fibula": {"id": "fibula", "rotulo": "Fíbula"},
        },
        "fonte": "Wikimedia Commons — domínio público (rótulos removidos)",
        "credito": "Mysid · Wikimedia Commons · domínio público",
    },
    {
        "id": "ossos-mmss",
        "trilhaId": "anatomia",
        "titulo": "Ossos do membro superior",
        "arquivo": "Human arm bones diagram.svg",
        "diagrama": "prancha-mmss",
        # Dois recortes desta mesma prancha, e o motivo importa:
        #
        # O arquivo tem um painel de visão geral do membro à esquerda e um zoom de
        # acidentes ósseos à direita (epicôndilos, tubérculos, fossas). x1=430
        # corta na linha média da coluna, mantendo só o painel esquerdo.
        #
        # y1=610 corta ANTES do punho. Os 8 ossos rotulados não caberiam num único
        # recorte: membro inferior/superior inteiro dá proporção perto de 1:2, e a
        # ~200px de largura carpo, metacarpo e falanges ficam a ~20px um do outro,
        # menos que o dedo consegue mirar. Então a mão virou a prancha "ossos-mao",
        # com recorte próprio — ali ela ocupa a tela toda e os alvos sobram espaço.
        # Nenhum alvo foi perdido: 5 aqui + 3 lá.
        "recorte": {"x1": 430, "y0": 20, "y1": 610},
        "alvos": {
            "Clavicle": {"id": "clavicula", "rotulo": "Clavícula"},
            "Scapula": {
                "id": "escapula",
                "rotulo": "Escápula",
                "pos": (271.5, 159.5),
                "nota": (
                    "A linha-guia original aponta para o acrômio, a 19px do alvo "
                    "da clavícula — perto demais, os dois ficariam ambíguos ao "
                    "toque. Movido para o corpo da escápula (área contornada em "
                    "verde atrás das costelas), que é a mesma estrutura e fica "
                    "bem separada."
                ),
            },
            "Humerus": {"id": "umero", "rotulo": "Úmero"},
            # rádio e ulna correm lado a lado no antebraço, então raio menor
            "Radius": {"id": "radio", "rotulo": "Rádio", "raio": 0.08},
            "Ulna": {"id": "ulna", "rotulo": "Ulna", "raio": 0.08},
            # carpo/metacarpo/falanges vivem na prancha "ossos-mao"
        },
        "fonte": "Wikimedia Commons — domínio público (rótulos removidos)",
        "credito": "LadyofHats (Mariana Ruiz Villarreal) · Wikimedia Commons · domínio público",
    },
    {
        "id": "ossos-mao",
        "trilhaId": "anatomia",
        "titulo": "Ossos da mão",
        # Mesma prancha do membro superior, recortada só na mão. Aproveitar o
        # zoom é o que torna carpo/metacarpo/falanges jogáveis: no recorte do
        # membro inteiro eles ficavam a ~20px de distância, aqui passam de 100px.
        "arquivo": "Human arm bones diagram.svg",
        "diagrama": "prancha-mao",
        "recorte": {"x1": 205, "y0": 560, "y1": 745},
        "alvos": {
            "Carpus": {"id": "carpo", "rotulo": "Carpo"},
            "Metacarpus": {"id": "metacarpo", "rotulo": "Metacarpo"},
            "Phalanges": {"id": "falanges", "rotulo": "Falanges"},
        },
        "fonte": "Wikimedia Commons — domínio público (rótulos removidos)",
        "credito": "LadyofHats (Mariana Ruiz Villarreal) · Wikimedia Commons · domínio público",
    },
    # --- COLUNA VERTEBRAL: pendente, e o motivo fica registrado -----------------
    #
    # "Spinal column curvature numbered.svg" seria ideal: vista lateral, coluna
    # em gravura realista, cada região numa FAIXA COLORIDA numerada de 1 a 4
    # (cervical/torácica/lombar/sacral) — bastaria remover os números.
    #
    # O problema é que o arquivo não é vetor de verdade: a coluna é um PNG de
    # ~1,26 MB embutido em base64 (<image xlink:href="data:image/png;base64,...">),
    # e só as faixas e a silhueta são vetor. Gerar a prancha dá um módulo de
    # 1,26 MB para o bundle, sem nenhum ganho de nitidez — o desenho é raster
    # de qualquer jeito.
    #
    # Caminhos possíveis, se valer a pena depois:
    #   1. extrair o PNG embutido (que já vem SEM números e sem faixas),
    #      reamostrar para ~300px de largura e empacotar em assets/pranchas/ —
    #      exige suportar asset local no schema, que hoje só tem `diagrama`
    #      (componente SVG) e `imagem` (URL remota);
    #   2. usar como `imagem` remota, aceitando dependência de rede na partida.
    #
    # Até então a coluna segue no esquemático "diag-coluna".
    #
    # A detecção por cor (alvos_por_cor) já está implementada e testada nesta
    # prancha: achou as 4 faixas e os 4 centros corretamente. Fica pronta para
    # quando aparecer uma prancha de regiões coloridas em vetor de verdade.
]


# --- download -----------------------------------------------------------------

def baixar_svg(nome_arquivo: str) -> bytes:
    url = (
        "https://commons.wikimedia.org/wiki/Special:FilePath/"
        + urllib.parse.quote(nome_arquivo.replace(" ", "_"), safe="")
    )
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=60) as r:
        if r.status != 200:
            raise RuntimeError(f"HTTP {r.status} ao baixar {nome_arquivo}")
        return r.read()


# --- travessia ----------------------------------------------------------------

TAGS_GEOMETRIA = {"path", "circle", "ellipse", "rect", "line", "polygon", "polyline"}

# Subárvores que descrevem "receitas" e não desenho posicionado na tela: o que
# está aqui só aparece quando referenciado por url(#id), então não conta nem para
# hotspot nem para recorte. (A bolinha vermelha dos rótulos vive num <marker>.)
TAGS_NAO_RENDERIZADAS = {"defs", "marker", "clipPath", "mask", "pattern", "symbol"}


def tag_de(el) -> str:
    return el.tag.split("}")[-1]


def caminhar(el, m: Matriz = IDENTIDADE, pai=None, herdado: dict | None = None, css=None):
    """
    (elemento, transform acumulado, pai, tinta efetiva) em pré-ordem, pulando
    não-renderizados.

    A tinta tem que ser resolvida de verdade, não só lida do atributo:
      - herdada do <g> pai (comum declarar `stroke` no grupo);
      - vinda de CSS por classe (a prancha do braço declara as linhas-guia com
        `.leader { stroke:#FF0000 }`, sem nenhum atributo de cor no elemento).
    Precedência: CSS < herdado < atributo/style inline.
    """
    herdado = herdado or {}
    css = css if css is not None else {}
    m2 = multiplicar(m, parse_transform(el.get("transform")))

    tinta = dict(herdado)
    do_css = css_do_elemento(el, css)
    for prop in ("fill", "stroke"):
        if prop in do_css:
            tinta[prop] = do_css[prop]
    for prop in ("fill", "stroke"):
        v = pintura(el, prop)
        if v:
            tinta[prop] = v

    yield el, m2, pai, tinta
    for filho in el:
        if tag_de(filho) in TAGS_NAO_RENDERIZADAS:
            continue
        yield from caminhar(filho, m2, el, tinta, css)


def viewbox_declarado(root) -> tuple[float, float, float, float] | None:
    vb = root.get("viewBox")
    if vb:
        v = [float(n) for n in re.findall(r"[-+]?[\d.]+(?:[eE][-+]?\d+)?", vb)]
        if len(v) == 4:
            return (v[0], v[1], v[0] + v[2], v[1] + v[3])
    try:
        return (0.0, 0.0, float(root.get("width")), float(root.get("height")))
    except (TypeError, ValueError):
        return None


def eh_vermelho_el(el, tinta: dict | None = None) -> bool:
    """Marcação de rótulo: vermelho saturado na tinta efetiva do elemento."""
    if tinta and any(eh_vermelho(v) for v in tinta.values()):
        return True
    return any(eh_vermelho(c) for c in cores_do_elemento(el))


# --- extração de hotspots -----------------------------------------------------

def texto_em_ingles(el) -> str | None:
    """
    Conteúdo de um <text>, se ele for a variante inglesa. Nas pranchas
    traduzidas do Commons cada rótulo é um <switch> com um <text> por idioma
    (systemLanguage="en", "bn", ...); a variante sem systemLanguage é o fallback,
    que também é o inglês.
    """
    if tag_de(el) != "text":
        return None
    lang = el.get("systemLanguage")
    if lang is not None and not lang.startswith("en"):
        return None
    txt = " ".join("".join(el.itertext()).split())
    return txt or None


def eh_segmento_reto(el, m: Matriz) -> tuple[Ponto, Ponto] | None:
    """
    Se o elemento é um segmento reto (dois pontos distintos), devolve as pontas.

    Serve para separar LINHA-GUIA de BOLINHA: nas pranchas do Commons a linha é
    um path reto (`m x,y h dx`) e a bolinha da ponta é um path com arcos, que
    gera muitos pontos. Sem essa distinção as bolinhas entram na conta como se
    fossem guias.
    """
    pts = [aplicar(m, p) for p in pontos_do_elemento(el)]
    distintos = sorted({(round(x, 3), round(y, 3)) for x, y in pts})
    if len(distintos) != 2:
        return None
    return distintos[0], distintos[1]


def extremos_de_linha_guia(el, m: Matriz) -> tuple[Ponto, Ponto] | None:
    """As duas pontas de uma linha-guia (line ou path reto), já transformadas."""
    pts = [aplicar(m, p) for p in pontos_do_elemento(el)]
    if len(pts) < 2:
        return None
    # ponta a ponta: o par mais distante entre si
    melhor = None
    for i in range(len(pts)):
        for j in range(i + 1, len(pts)):
            d = math.dist(pts[i], pts[j])
            if melhor is None or d > melhor[0]:
                melhor = (d, pts[i], pts[j])
    if melhor is None or melhor[0] <= 0:
        return None
    return melhor[1], melhor[2]


def catalogo_alvos(cfg: dict) -> dict[str, dict]:
    """
    Mapa de alvos do catálogo, seja ele keyed por rótulo inglês (`alvos`) ou por
    cor da faixa (`alvos_por_cor`). O resto do pipeline não precisa saber qual é.
    """
    return cfg.get("alvos_por_cor") or cfg.get("alvos") or {}


def hotspots_por_cor(cfg: dict, coleta: dict) -> list[tuple[str, Ponto]]:
    """Hotspot no centro de cada faixa colorida declarada no catálogo."""
    saida: list[tuple[str, Ponto]] = []
    disponiveis = coleta["por_cor"]
    for cor in cfg["alvos_por_cor"]:
        chave = normalizar_cor(cor)
        bb = disponiveis.get(chave)
        if bb is None:
            raise RuntimeError(
                f"cor {cor} não encontrada na prancha. Cores presentes: "
                f"{sorted(disponiveis)[:20]}"
            )
        saida.append((cor, ((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2)))
    return saida


def coletar(root) -> dict:
    """Levanta desenho, marcação vermelha e rótulos ingleses com posição."""
    vb = viewbox_declarado(root)
    css = coletar_css(root)
    bb_desenho = None
    guias: list[tuple[Ponto, Ponto]] = []
    retas: list[tuple[Ponto, Ponto]] = []
    rotulos: list[tuple[str, Ponto]] = []

    for el, m, _pai, tinta in caminhar(root, css=css):
        t = tag_de(el)

        ingles = texto_em_ingles(el)
        if ingles:
            pts = [aplicar(m, p) for p in pontos_do_elemento(el)]
            if pts:
                rotulos.append((ingles, pts[0]))
            continue
        if t == "text":
            continue

        if t not in TAGS_GEOMETRIA:
            continue

        if eh_vermelho_el(el, tinta):
            ext = extremos_de_linha_guia(el, m)
            if ext:
                guias.append(ext)
            reto = eh_segmento_reto(el, m)
            if reto:
                retas.append(reto)
            continue

        if nao_pinta_nada(el):
            continue

        pts = [aplicar(m, p) for p in pontos_do_elemento(el)]
        bb = bbox(pts)
        if bb:
            bb_desenho = unir_bbox(bb_desenho, bb)

    # o viewBox declarado é a intenção do autor: recorta artefatos fora dele
    if vb and bb_desenho:
        bb_desenho = (
            max(bb_desenho[0], vb[0]),
            max(bb_desenho[1], vb[1]),
            min(bb_desenho[2], vb[2]),
            min(bb_desenho[3], vb[3]),
        )

    return {
        "bb_desenho": bb_desenho,
        "guias": guias,
        "retas": retas,
        "rotulos": rotulos,
        "viewbox": vb,
        "por_cor": bboxes_por_cor(root, css),
    }


def normalizar_cor(v: str | None) -> str | None:
    """#ABC -> #aabbcc, para comparar cor declarada com cor do catálogo."""
    if not v:
        return None
    v = v.strip().lower()
    if not v.startswith("#"):
        return v
    h = v[1:]
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return f"#{h}"


def bboxes_por_cor(root, css) -> dict[str, tuple[float, float, float, float]]:
    """
    Área ocupada por cada cor de preenchimento.

    Serve para pranchas que marcam regiões por COR em vez de linha-guia — o caso
    da coluna vertebral, onde cada faixa (cervical, torácica, lombar, sacral) é um
    path de cor própria. O centro da faixa vira o hotspot.
    """
    saida: dict[str, tuple[float, float, float, float]] = {}
    for el, m, _pai, tinta in caminhar(root, css=css):
        if tag_de(el) not in TAGS_GEOMETRIA:
            continue
        cor = normalizar_cor(tinta.get("fill"))
        if not cor or cor in ("none", "transparent"):
            continue
        bb = bbox([aplicar(m, p) for p in pontos_do_elemento(el)])
        if bb:
            saida[cor] = unir_bbox(saida.get(cor), bb)
    return saida


def agrupar_rotulos(
    rotulos: list[tuple[str, Ponto]], escala: float
) -> list[tuple[str, list[Ponto]]]:
    """
    Junta os <text> que formam um mesmo rótulo. Prancha do Commons costuma quebrar
    "Anterior cruciate ligament" em três <text> empilhados; sem juntar, o
    pareamento com a linha-guia pega só um fragmento.

    Agrupa por ligação simples (single-linkage) com limiar proporcional ao
    tamanho da prancha.
    """
    limiar = escala * 0.045
    grupos: list[dict] = []
    for txt, p in rotulos:
        alvo = None
        for g in grupos:
            if any(math.dist(p, q) <= limiar for q in g["pts"]):
                alvo = g
                break
        if alvo is None:
            grupos.append({"itens": [(txt, p)], "pts": [p]})
        else:
            alvo["itens"].append((txt, p))
            alvo["pts"].append(p)

    # funde grupos que encostaram entre si depois de crescer
    mudou = True
    while mudou:
        mudou = False
        for i in range(len(grupos)):
            for j in range(i + 1, len(grupos)):
                if any(
                    math.dist(a, b) <= limiar for a in grupos[i]["pts"] for b in grupos[j]["pts"]
                ):
                    grupos[i]["itens"] += grupos[j]["itens"]
                    grupos[i]["pts"] += grupos[j]["pts"]
                    del grupos[j]
                    mudou = True
                    break
            if mudou:
                break

    saida = []
    for g in grupos:
        itens = sorted(g["itens"], key=lambda it: (round(it[1][1], 1), it[1][0]))
        # dedup preservando ordem (arquivos multilíngues repetem a variante inglesa)
        vistos = set()
        partes = []
        for txt, _ in itens:
            if txt not in vistos:
                vistos.add(txt)
                partes.append(txt)
        saida.append((" ".join(partes), g["pts"]))
    return saida


def blocos_por_coluna(
    rotulos: list[tuple[str, Ponto]], gap: float = 34.0
) -> list[dict]:
    """
    Agrupa os <text> em blocos de rótulo, por COLUNA.

    Pranchas didáticas alinham todos os rótulos em uma ou duas colunas de x fixo
    ("Anterior cruciate" / "ligament" empilhados). Agrupando por x idêntico e
    depois por proximidade vertical, cada bloco fica sendo um rótulo inteiro, e o
    y da PRIMEIRA linha é o que a linha-guia acompanha.
    """
    colunas: dict[float, list[tuple[str, Ponto]]] = {}
    for txt, p in rotulos:
        colunas.setdefault(round(p[0], 1), []).append((txt, p))

    blocos: list[dict] = []
    for cx, itens in colunas.items():
        itens.sort(key=lambda it: it[1][1])
        atual: list[tuple[str, Ponto]] = []
        for item in itens:
            if atual and item[1][1] - atual[-1][1][1] > gap:
                blocos.append({"coluna": cx, "y": atual[0][1][1],
                               "texto": " ".join(t for t, _ in atual)})
                atual = []
            atual.append(item)
        if atual:
            blocos.append({"coluna": cx, "y": atual[0][1][1],
                           "texto": " ".join(t for t, _ in atual)})
    return blocos


def hotspots_por_coluna(coleta: dict) -> list[tuple[str, Ponto]]:
    """
    Pareamento EXATO para pranchas de rótulos em coluna com linha-guia reta.

    Nada de heurística geométrica aqui — usa a construção do arquivo:

      1. cada linha-guia é um segmento reto, e uma das pontas encosta na coluna
         de rótulos: essa é a ponta do rótulo, a outra é o hotspot. (A direção do
         path não serve como regra: nesta prancha do joelho 13 linhas saem do
         rótulo para a estrutura e 1 faz o contrário.)
      2. o rótulo é o bloco daquela coluna com o y mais próximo do y da linha.

    É determinístico, e é o que permite mapear LCA, LCP, meniscos e colaterais
    sem chutar — o que o pareamento por distância errava.
    """
    blocos = blocos_por_coluna(coleta["rotulos"])
    if not blocos:
        raise RuntimeError("nenhum rótulo encontrado para pareamento por coluna")
    colunas = sorted({b["coluna"] for b in blocos})

    saida: list[tuple[str, Ponto]] = []
    for a, b in coleta["retas"]:
        # ponta do rótulo = a que fica mais perto de alguma coluna de texto
        cand = []
        for ponta, outra in ((a, b), (b, a)):
            for cx in colunas:
                cand.append((abs(ponta[0] - cx), cx, ponta, outra))
        dist, cx, ponta_rotulo, hotspot = min(cand, key=lambda c: c[0])

        na_coluna = [x for x in blocos if x["coluna"] == cx]
        bloco = min(na_coluna, key=lambda x: abs(x["y"] - ponta_rotulo[1]))
        saida.append((bloco["texto"], hotspot))

    # duas linhas não deveriam cair no mesmo rótulo
    vistos: dict[str, Ponto] = {}
    for rotulo, p in saida:
        if rotulo in vistos:
            print(
                f'  ⚠  rótulo "{rotulo}" pareado com duas linhas-guia '
                f"({vistos[rotulo]} e {p}) — confira no overlay"
            )
        vistos[rotulo] = p
    return saida


def resolver_hotspots(coleta: dict) -> list[tuple[str, Ponto]]:
    """
    Para cada linha-guia devolve (rótulo inglês, hotspot).

    Duas decisões que precisam ser robustas:

    - qual ponta é o hotspot: é a MAIS LONGE de qualquer rótulo. A linha-guia
      nasce ao lado do próprio texto e termina na estrutura, então "distância ao
      texto mais próximo" separa as pontas bem melhor que "distância ao centro"
      (que falha quando os rótulos ficam nos dois lados da prancha, como no joelho).

    - guias duplicadas: muitas pranchas desenham a linha duas vezes (contorno
      escuro + preenchimento vermelho). Hotspots quase coincidentes são o mesmo
      alvo, então colapsam num só.
    """
    bb = coleta["bb_desenho"]
    if not bb:
        raise RuntimeError("não foi possível determinar a área do desenho")
    if not coleta["rotulos"]:
        raise RuntimeError("nenhum rótulo em inglês encontrado na prancha")

    escala = max(bb[2] - bb[0], bb[3] - bb[1])
    grupos = agrupar_rotulos(coleta["rotulos"], escala)

    def perto_de_rotulo(p: Ponto) -> float:
        return min(math.dist(p, q) for _, pts in grupos for q in pts)

    brutos: list[tuple[str, Ponto]] = []
    for a, b in coleta["guias"]:
        da, db = perto_de_rotulo(a), perto_de_rotulo(b)
        hotspot, junto_ao_texto = (a, b) if da > db else (b, a)
        rotulo, _ = min(
            grupos, key=lambda g: min(math.dist(junto_ao_texto, q) for q in g[1])
        )
        brutos.append((rotulo, hotspot))

    # colapsa guias duplicadas: mesmo rótulo e hotspots praticamente no mesmo ponto
    tolerancia = escala * 0.02
    final: list[tuple[str, Ponto]] = []
    for rotulo, p in brutos:
        gemeo = next(
            (
                i
                for i, (r, q) in enumerate(final)
                if r == rotulo and math.dist(p, q) <= tolerancia
            ),
            None,
        )
        if gemeo is None:
            final.append((rotulo, p))
        else:
            # média das duplicatas, para cair no meio do traço
            r, q = final[gemeo]
            final[gemeo] = (r, ((p[0] + q[0]) / 2, (p[1] + q[1]) / 2))

    # Aviso honesto: hotspots quase no mesmo ponto com rótulos DIFERENTES indicam
    # que o pareamento texto↔linha-guia não é confiável nessa prancha (acontece
    # quando há rótulos dos dois lados e linhas curtas). Melhor gritar do que
    # gerar alvo plausível e errado.
    for i, (ra, pa) in enumerate(final):
        for rb, pb in final[i + 1 :]:
            if ra != rb and math.dist(pa, pb) <= tolerancia:
                print(
                    f'  ⚠  pareamento duvidoso: "{ra}" e "{rb}" apontam para '
                    f"praticamente o mesmo ponto ({pa[0]:.0f},{pa[1]:.0f}) — "
                    f"confira no overlay antes de mapear qualquer um dos dois"
                )
    return final


# --- limpeza do SVG -----------------------------------------------------------

DESCARTAR = {
    "text",
    "switch",
    "title",
    "desc",
    "metadata",
    "marker",
    "foreignObject",
    # o CSS é embutido nos elementos antes de descartar o <style>, porque o
    # SvgXml do react-native-svg não aplica folha de estilo
    "style",
}


def fora_do_recorte(el, m: Matriz, recorte: tuple[float, float, float, float]) -> bool:
    """True se o elemento não encosta na área recortada (não seria visto)."""
    bb = bbox([aplicar(m, p) for p in pontos_do_elemento(el)])
    if bb is None:
        return False
    x0, y0, x1, y1 = recorte
    return bb[2] < x0 or bb[0] > x1 or bb[3] < y0 or bb[1] > y1


def limpar(root, recorte: tuple[float, float, float, float]) -> None:
    """
    Remove rótulos, marcação vermelha, metadados e — importante para o bundle —
    a geometria que ficou fora do recorte. Sem isso os ossos do pé continuariam
    no arquivo, invisíveis, pesando no bundle e no tempo de render.
    """
    css = coletar_css(root)

    # 0) CSS vira atributo, senão o estilo se perde ao remover o <style>
    for el, _m, _pai, _t in caminhar(root, css=css):
        for prop, valor in css_do_elemento(el, css).items():
            if prop in ("fill", "stroke", "stroke-width", "opacity", "fill-rule") and (
                el.get(prop) is None
            ):
                el.set(prop, valor)

    # 1) o que sai por natureza (texto, metadado) e o vermelho de marcação —
    #    este último precisa da tinta efetiva, então usa a travessia com contexto
    vermelhos = {
        id(el)
        for el, _m, _pai, tinta in caminhar(root, css=css)
        if tag_de(el) in TAGS_GEOMETRIA and eh_vermelho_el(el, tinta)
    }
    for pai in list(root.iter()):
        for filho in list(pai):
            t = tag_de(filho)
            if t in DESCARTAR:
                pai.remove(filho)
            elif id(filho) in vermelhos:
                pai.remove(filho)
            elif not isinstance(filho.tag, str):  # comentários / PI
                pai.remove(filho)

    # 2) o que sai por estar fora do enquadramento (precisa do transform do pai,
    #    então percorre de novo já com a árvore limpa)
    descartar = []
    for el, m, pai, _tinta in caminhar(root, css=css):
        if pai is None or tag_de(el) not in TAGS_GEOMETRIA:
            continue
        if fora_do_recorte(el, m, recorte):
            descartar.append((pai, el))
    for pai, el in descartar:
        pai.remove(el)

    # 3) grupos e defs que ficaram vazios
    for _ in range(4):  # poda em cascata (grupo vazio dentro de grupo vazio)
        vazios = []
        for pai in list(root.iter()):
            for filho in list(pai):
                if tag_de(filho) in ("g", "defs") and len(filho) == 0:
                    vazios.append((pai, filho))
        if not vazios:
            break
        for pai, filho in vazios:
            pai.remove(filho)

    return len(descartar)


def encolher_numeros(svg: str) -> str:
    """
    Arredonda coordenadas para 1 casa decimal.

    As pranchas vêm com 3–4 casas, precisão que não sobrevive à tela: o viewBox
    tem algumas centenas de unidades e é desenhado em ~200px, então 0,1 unidade
    vale menos de 0,1 pixel. Corta bundle sem alterar o traço.
    """

    def corta(m: re.Match) -> str:
        return f"{round(float(m.group(0)), 1):g}"

    return re.sub(r"-?\d+\.\d{2,}", corta, svg)


# Atributos que não afetam o render da prancha: identificadores do editor de
# origem e herança de fonte (não sobrou texto nenhum aqui).
ATRIBUTOS_INUTEIS = (
    "id",
    "overflow",
    "version",
    "font-family",
    "font-size",
    "xml:space",
    "enable-background",
)


def podar_atributos(root) -> None:
    for el in root.iter():
        if el is root:
            continue
        for attr in ATRIBUTOS_INUTEIS:
            el.attrib.pop(attr, None)


def com_margem(bb: tuple[float, float, float, float]) -> tuple[float, float, float, float]:
    """Aplica a folga visual em volta do desenho."""
    x0, y0, x1, y1 = bb
    folga = max(x1 - x0, y1 - y0) * MARGEM
    return (x0 - folga, y0 - folga, x1 + folga, y1 + folga)


def serializar(root, recorte: tuple[float, float, float, float]):
    x0, y0, x1, y1 = recorte
    w, h = x1 - x0, y1 - y0

    root.set("viewBox", f"{x0:g} {y0:g} {w:g} {h:g}")
    # sem width/height o SvgXml respeita o tamanho que a tela mandar
    root.attrib.pop("width", None)
    root.attrib.pop("height", None)

    podar_atributos(root)
    ET.register_namespace("", SVG_NS)
    bruto = ET.tostring(root, encoding="unicode")
    bruto = re.sub(r"\s*\n\s*", "", bruto)
    bruto = re.sub(r"<(\w+)([^>]*?)\s*/>", r"<\1\2/>", bruto)
    return encolher_numeros(bruto), (w / h)


# --- saída --------------------------------------------------------------------

def escrever_modulo_svg(diagrama: str, svg: str, meta: dict) -> Path:
    DIR_SVG.mkdir(parents=True, exist_ok=True)
    destino = DIR_SVG / f"{diagrama}.ts"
    literal = svg.replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
    destino.write_text(
        "// GERADO por scripts/gerar_pranchas.py — não editar à mão.\n"
        f"// Origem: {meta['arquivo']} (Wikimedia Commons)\n"
        f"// Crédito: {meta['credito']}\n"
        "// Rótulos e linhas-guia removidos para servir de prancha muda no jogo.\n"
        f"export const {nome_const(diagrama)} = `{literal}`;\n",
        encoding="utf-8",
    )
    return destino


def nome_const(diagrama: str) -> str:
    partes = re.split(r"[^A-Za-z0-9]+", diagrama)
    return "SVG_" + "_".join(p.upper() for p in partes if p)


def merge_json(entradas: list[dict]) -> None:
    dados = json.loads(JSON_PRANCHAS.read_text(encoding="utf-8"))
    atuais = dados.get("pranchas", [])
    por_id = {p["id"]: i for i, p in enumerate(atuais)}
    for nova in entradas:
        if nova["id"] in por_id:
            atuais[por_id[nova["id"]]] = nova
        else:
            atuais.append(nova)
    dados["pranchas"] = atuais
    JSON_PRANCHAS.write_text(
        json.dumps(dados, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


# --- orquestração -------------------------------------------------------------

def processar(cfg: dict, inspecionar: bool) -> dict | None:
    print(f"\n=== {cfg['id']} — {cfg['arquivo']}")
    root = ET.fromstring(baixar_svg(cfg["arquivo"]))
    coleta = coletar(root)
    if cfg.get("alvos_por_cor"):
        hotspots = hotspots_por_cor(cfg, coleta)
    elif cfg.get("pareamento") == "colunas":
        hotspots = hotspots_por_coluna(coleta)
    else:
        hotspots = resolver_hotspots(coleta)

    bb = coleta["bb_desenho"]
    print(f"  desenho: {tuple(round(v, 1) for v in bb)}")
    print(f"  linhas-guia encontradas: {len(hotspots)}")
    for rotulo, p in hotspots:
        print(f"    {rotulo:22} -> ({p[0]:7.2f}, {p[1]:7.2f})")

    # enquadramento: bbox do desenho, com os overrides de ergonomia do catálogo
    ov = cfg.get("recorte") or {}
    bb = (
        ov.get("x0", bb[0]),
        ov.get("y0", bb[1]),
        ov.get("x1", bb[2]),
        ov.get("y1", bb[3]),
    )
    if ov:
        print(f"  recorte ajustado: {tuple(round(v, 1) for v in bb)}")
    # só os rótulos que o catálogo usa precisam sobreviver ao enquadramento;
    # pranchas com painel de detalhe têm hotspots que a gente descarta de propósito
    for rotulo, (px, py) in hotspots:
        if rotulo not in catalogo_alvos(cfg):
            continue
        if not (bb[0] <= px <= bb[2] and bb[1] <= py <= bb[3]):
            raise RuntimeError(
                f'alvo "{rotulo}" em ({px:.1f},{py:.1f}) caiu fora do recorte {bb}'
            )

    if inspecionar:
        # não escreve prancha nenhuma, mas alimenta o conferidor visual com TODOS
        # os hotspots detectados — é assim que se descobre qual é qual numa prancha
        # cheia de rótulos, onde o pareamento automático não dá conta
        rec = com_margem(bb)
        cw, ch = rec[2] - rec[0], rec[3] - rec[1]
        print("  (modo inspeção: nada foi escrito)")
        return {
            "_conferencia": {
                "id": cfg["id"],
                "arquivo": cfg["arquivo"],
                "viewBoxOrigem": [
                    coleta["viewbox"][0],
                    coleta["viewbox"][1],
                    coleta["viewbox"][2] - coleta["viewbox"][0],
                    coleta["viewbox"][3] - coleta["viewbox"][1],
                ],
                "viewBoxGerado": [rec[0], rec[1], cw, ch],
                "alvos": [
                    {
                        "id": f"det{i}",
                        "rotulo": r,
                        "x": round((px - rec[0]) / cw, 4),
                        "y": round((py - rec[1]) / ch, 4),
                        "raio": 0.03,
                    }
                    for i, (r, (px, py)) in enumerate(hotspots)
                ],
            },
            "_somente_inspecao": True,
        }

    # mapeia inglês -> (id, rótulo PT); erra alto se o catálogo divergir
    mapa = catalogo_alvos(cfg)
    achados = {r for r, _ in hotspots}
    faltando = set(mapa) - achados
    sobrando = achados - set(mapa)
    if faltando:
        raise RuntimeError(
            f"rótulos do catálogo não encontrados na prancha: {sorted(faltando)}"
        )
    if sobrando:
        print(f"  (ignorando rótulos sem mapeamento: {sorted(sobrando)})")

    recorte = com_margem(bb)
    removidos = limpar(root, recorte)
    svg, aspecto = serializar(root, recorte)
    print(f"  geometria fora do enquadramento removida: {removidos} elemento(s)")

    vb = [float(v) for v in root.get("viewBox").split()]
    x0, y0, vw, vh = vb

    alvos = []
    for rotulo_en, (px, py) in hotspots:
        if rotulo_en not in mapa:
            continue
        entrada = mapa[rotulo_en]
        if entrada.get("pos"):
            px, py = entrada["pos"]
            print(f"    ({entrada['id']}: posição sobrescrita à mão)")
        alvo = {
            "id": entrada["id"],
            "rotulo": entrada["rotulo"],
            "x": round((px - x0) / vw, 4),
            "y": round((py - y0) / vh, 4),
        }
        if entrada.get("raio"):
            alvo["raio"] = entrada["raio"]
        alvos.append(alvo)
    alvos.sort(key=lambda a: (a["y"], a["x"]))

    destino = escrever_modulo_svg(cfg["diagrama"], svg, cfg)
    print(f"  SVG limpo: {destino.relative_to(RAIZ)} ({len(svg) / 1024:.1f} KB)")
    print(f"  aspecto: {aspecto:.4f}  ·  alvos: {len(alvos)}")
    for a in alvos:
        print(f"    {a['rotulo']:12} x={a['x']:.4f} y={a['y']:.4f}")

    vb_origem = coleta["viewbox"]
    return {
        "id": cfg["id"],
        "trilhaId": cfg["trilhaId"],
        "titulo": cfg["titulo"],
        "diagrama": cfg["diagrama"],
        "aspecto": round(aspecto, 4),
        "alvos": alvos,
        "fonte": cfg["fonte"],
        "urlFonte": "https://commons.wikimedia.org/wiki/File:"
        + cfg["arquivo"].replace(" ", "_"),
        "imagemCredito": cfg["credito"],
        # consumido por escrever_sidecar() e removido antes de ir para o JSON
        "_conferencia": {
            "id": cfg["id"],
            "arquivo": cfg["arquivo"],
            "viewBoxOrigem": [vb_origem[0], vb_origem[1], vb_origem[2] - vb_origem[0], vb_origem[3] - vb_origem[1]],
            "viewBoxGerado": [x0, y0, vw, vh],
            "alvos": alvos,
        },
    }


SIDECAR = Path("/tmp/fisioplay-pranchas-conferencia.json")


def escrever_sidecar(entradas: list[dict]) -> None:
    """
    Dados que o conferidor visual (scripts/conferir_prancha.cjs) precisa para
    recortar o raster de origem no mesmo enquadramento e marcar os alvos por cima.
    Vai para /tmp porque é material de verificação, não de build.
    """
    SIDECAR.write_text(
        json.dumps(entradas, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nconferência: node scripts/conferir_prancha.cjs <id>   (dados em {SIDECAR})")


def main() -> None:
    args = [a for a in sys.argv[1:]]
    inspecionar = "--inspecionar" in args
    args = [a for a in args if not a.startswith("--")]
    alvo_ids = set(args)

    escolhidas = [p for p in PRANCHAS if not alvo_ids or p["id"] in alvo_ids]
    if not escolhidas:
        print(f"nenhuma prancha casou com {sorted(alvo_ids)}", file=sys.stderr)
        sys.exit(1)

    entradas = []
    conferencia = []
    for cfg in escolhidas:
        e = processar(cfg, inspecionar)
        if not e:
            continue
        conferencia.append(e.pop("_conferencia"))
        if not e.pop("_somente_inspecao", False):
            entradas.append(e)

    if entradas:
        merge_json(entradas)
        print(f"\n✅ {len(entradas)} prancha(s) em {JSON_PRANCHAS.relative_to(RAIZ)}")
    if conferencia:
        escrever_sidecar(conferencia)


if __name__ == "__main__":
    main()
