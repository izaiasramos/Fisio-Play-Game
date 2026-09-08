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
# `alvos` é keyed pelo rótulo EM INGLÊS que existe no SVG original. Assim o
# mapeamento é auditável: se o Commons renomear/remover um rótulo, o script falha.

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
            "Femur": ("femur", "Fêmur"),
            "Patella": ("patela", "Patela"),
            "Tibia": ("tibia", "Tíbia"),
            "Fibula": ("fibula", "Fíbula"),
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
        "alvos": {},
        "fonte": "Wikimedia Commons — domínio público (rótulos removidos)",
        "credito": "Mysid · Wikimedia Commons · domínio público",
    },
    {
        "id": "ossos-mmss",
        "trilhaId": "anatomia",
        "titulo": "Ossos do membro superior",
        "arquivo": "Human arm bones diagram.svg",
        "diagrama": "prancha-mmss",
        # A prancha tem dois painéis: visão geral do membro à esquerda e um zoom
        # de acidentes ósseos (epicôndilos, tubérculos, fossas) à direita. Só o
        # painel esquerdo interessa aqui; corta na linha média da coluna, que dá
        # um recorte natural, e descarta os hotspots do painel de detalhe.
        "recorte": {"x1": 430, "y0": 20, "y1": 745},
        "alvos": {
            "Clavicle": ("clavicula", "Clavícula"),
            # "Scapula" fica de fora: nesta vista ANTERIOR a escápula aparece só
            # como sombra atrás das costelas, e o hotspot dela cai a 19px do da
            # clavícula — abaixo da tolerância de toque, o que deixaria os dois
            # alvos ambíguos. Escápula pede uma prancha de vista posterior.
            "Humerus": ("umero", "Úmero"),
            "Radius": ("radio", "Rádio"),
            "Ulna": ("ulna", "Ulna"),
            # Carpo, metacarpo e falanges ficam empilhados numa mão pequena: a
            # tolerância padrão (10% da largura) faria um invadir o outro. Raio
            # menor mantém os três jogáveis, e o anel na tela acompanha o raio.
            "Carpus": ("carpo", "Carpo", 0.07),
            "Metacarpus": ("metacarpo", "Metacarpo", 0.07),
            "Phalanges": ("falanges", "Falanges", 0.07),
        },
        "fonte": "Wikimedia Commons — domínio público (rótulos removidos)",
        "credito": "LadyofHats (Mariana Ruiz Villarreal) · Wikimedia Commons · domínio público",
    },
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


def coletar(root) -> dict:
    """Levanta desenho, marcação vermelha e rótulos ingleses com posição."""
    vb = viewbox_declarado(root)
    css = coletar_css(root)
    bb_desenho = None
    guias: list[tuple[Ponto, Ponto]] = []
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

    return {"bb_desenho": bb_desenho, "guias": guias, "rotulos": rotulos, "viewbox": vb}


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
        if rotulo not in cfg["alvos"]:
            continue
        if not (bb[0] <= px <= bb[2] and bb[1] <= py <= bb[3]):
            raise RuntimeError(
                f'alvo "{rotulo}" em ({px:.1f},{py:.1f}) caiu fora do recorte {bb}'
            )

    if inspecionar:
        print("  (modo inspeção: nada foi escrito)")
        return None

    # mapeia inglês -> (id, rótulo PT); erra alto se o catálogo divergir
    mapa: dict[str, tuple] = cfg["alvos"]
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
        alvo_id, rotulo_pt = entrada[0], entrada[1]
        alvo = {
            "id": alvo_id,
            "rotulo": rotulo_pt,
            "x": round((px - x0) / vw, 4),
            "y": round((py - y0) / vh, 4),
        }
        if len(entrada) > 2 and entrada[2]:
            alvo["raio"] = entrada[2]
        alvos.append(alvo)
    alvos.sort(key=lambda a: (a["y"], a["x"]))

    destino = escrever_modulo_svg(cfg["diagrama"], svg, cfg)
    print(f"  SVG limpo: {destino.relative_to(RAIZ)} ({len(svg) / 1024:.1f} KB)")
    print(f"  aspecto: {aspecto:.4f}  ·  alvos: {len(alvos)}")
    for a in alvos:
        print(f"    {a['rotulo']:12} x={a['x']:.4f} y={a['y']:.4f}")

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
    }


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
    for cfg in escolhidas:
        e = processar(cfg, inspecionar)
        if e:
            entradas.append(e)

    if entradas:
        merge_json(entradas)
        print(f"\n✅ {len(entradas)} prancha(s) em {JSON_PRANCHAS.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
