#!/usr/bin/env python3
"""
Gera os tabuleiros do jogo "Montar o corpo" a partir das mesmas ilustrações de
domínio público usadas pelas pranchas.

Diferença em relação a `gerar_pranchas.py`: lá o jogador arrasta um RÓTULO até um
ponto; aqui ele arrasta a PEÇA desenhada (o osso) até o lugar dela. Então em vez
de um hotspot por estrutura, precisamos de:

  - a geometria de cada peça isolada, com viewBox próprio;
  - o centro e o tamanho exatos da peça, relativos ao tabuleiro.

Por isso este script usa `achatar_curvas=True`: a bbox aproximada por pontos de
controle (boa o bastante para recortar prancha) superestimaria a peça e o encaixe
sairia torto.

Como cada peça é identificada — e por que é auditável:

  1. as peças do lado ROTULADO vêm do mesmo mecanismo do outro script: a
     linha-guia vermelha aponta um hotspot, e a peça é o MENOR grupo de topo que
     contém aquele hotspot (o "menor" desempata tíbia vs fíbula, cujas bboxes se
     sobrepõem);
  2. as peças do lado SEM rótulo são derivadas por ESPELHAMENTO: para cada peça
     do lado rotulado, procura-se o grupo cuja bbox seja a imagem espelhada dela.
     A qualidade do casamento é verificada e o script falha se passar da
     tolerância — em vez de nomear osso errado em silêncio.

O que NÃO é gerado de propósito: pé, pelve e sacro. A ilustração de origem não
rotula essas estruturas, e batizar geometria não-rotulada seria eu adivinhando
nome de osso num app de saúde. Elas precisam de fonte rotulada ou de conferência
de fisioterapeuta antes de virarem peça.

Rodar:  python3 scripts/gerar_montar.py
        python3 scripts/gerar_montar.py --inspecionar
"""
from __future__ import annotations

import json
import re
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gerar_pranchas import (  # noqa: E402
    TAGS_GEOMETRIA,
    baixar_svg,
    caminhar,
    coletar,
    eh_vermelho_el,
    nome_const,
    resolver_hotspots,
    tag_de,
)
from svgtools import (  # noqa: E402
    IDENTIDADE,
    SVG_NS,
    Matriz,
    Ponto,
    aplicar,
    bbox,
    coletar_css,
    multiplicar,
    parse_transform,
    pontos_do_elemento,
    unir_bbox,
)

RAIZ = Path(__file__).resolve().parent.parent
DIR_SVG = RAIZ / "src" / "components" / "pranchas" / "svg"
JSON_MONTAR = RAIZ / "src" / "data" / "anatomia-montar.json"

# Geometria com bbox menor que isto (em unidades do SVG) é sujeira do arquivo —
# no original da perna há três partículas de 1-2 px que puxavam a bbox do pé
# para o topo da imagem.
MINIMO_PECA = 4.0

# Folga em volta da peça isolada, em fração do seu maior lado.
MARGEM_PECA = 0.04

# Tolerância do casamento por forma, em fração de (largura + altura) da peça.
# Nos ossos da perna o par correto erra por 0.2 a 6.4 e o par errado por ~58, então
# 12% separa com folga larga dos dois lados.
TOLERANCIA_ESPELHO = 0.12

# Grupo que cobre mais que isto da largura do desenho não é osso: é camada de
# fundo ou marca de registro do arquivo de origem. Fica fora dos candidatos.
MAX_FRACAO_LARGURA = 0.9


# --- catálogo -----------------------------------------------------------------
# `pecas` é keyed pelo rótulo EM INGLÊS do SVG original: se o Commons renomear,
# o script falha em vez de gerar peça errada.

REGIOES: list[dict] = [
    {
        "id": "perna-esquerda",
        "ordem": 1,
        "trilhaId": "anatomia",
        "titulo": "Perna esquerda",
        "subtitulo": "Monte os quatro ossos do membro inferior",
        "arquivo": "Human leg bones labeled.svg",
        "modulo": "montar-perna-esq",
        "lado": "esquerdo",
        "pecas": {
            "Femur": ("femur", "Fêmur"),
            "Patella": ("patela", "Patela"),
            "Tibia": ("tibia", "Tíbia"),
            "Fibula": ("fibula", "Fíbula"),
        },
        "fonte": "Wikimedia Commons — domínio público (rótulos removidos)",
        "credito": "Jecowa · Wikimedia Commons · domínio público",
    },
    {
        "id": "perna-direita",
        "ordem": 2,
        "trilhaId": "anatomia",
        "titulo": "Perna direita",
        "subtitulo": "Agora do outro lado — repare no que troca de lugar",
        "arquivo": "Human leg bones labeled.svg",
        "modulo": "montar-perna-dir",
        "lado": "direito",
        # sem rótulo na fonte: derivada espelhando as peças do lado esquerdo
        "espelhar_de": "perna-esquerda",
        "pecas": {
            "Femur": ("femur", "Fêmur"),
            "Patella": ("patela", "Patela"),
            "Tibia": ("tibia", "Tíbia"),
            "Fibula": ("fibula", "Fíbula"),
        },
        "fonte": "Wikimedia Commons — domínio público (rótulos removidos)",
        "credito": "Jecowa · Wikimedia Commons · domínio público",
    },
]


# --- geometria ----------------------------------------------------------------

VAZIO = (None, "none", "transparent")


def pinta_de_verdade(tinta: dict) -> bool:
    """True se a tinta efetiva produz alguma marca na tela."""
    return tinta.get("fill") not in VAZIO or tinta.get("stroke") not in VAZIO


def relevante(el, tinta: dict) -> bool:
    """True se o elemento produz tinta anatômica (não é marcação nem invisível)."""
    return (
        tag_de(el) in TAGS_GEOMETRIA
        and not eh_vermelho_el(el, tinta)
        and pinta_de_verdade(tinta)
    )


def bbox_subarvore(el, m: Matriz = IDENTIDADE, css=None, herdado=None, ignorar_micro=True):
    """Bbox exata (curvas achatadas) de tudo que o elemento pinta."""
    total = None
    for e, mm, _pai, tinta in caminhar(el, m, None, herdado, css):
        if not relevante(e, tinta):
            continue
        b = bbox([aplicar(mm, p) for p in pontos_do_elemento(e, True)])
        if b is None:
            continue
        if ignorar_micro and max(b[2] - b[0], b[3] - b[1]) < MINIMO_PECA:
            continue
        total = unir_bbox(total, b)
    return total


def com_margem(bb, fracao: float = MARGEM_PECA):
    x0, y0, x1, y1 = bb
    folga = max(x1 - x0, y1 - y0) * fracao
    return (x0 - folga, y0 - folga, x1 + folga, y1 + folga)


def contem(bb, p: Ponto) -> bool:
    return bb[0] <= p[0] <= bb[2] and bb[1] <= p[1] <= bb[3]


def area(bb) -> float:
    return max(0.0, bb[2] - bb[0]) * max(0.0, bb[3] - bb[1])


# --- localização das peças ----------------------------------------------------

def grupos_de_topo(root, css) -> list[tuple[int, object, Matriz, tuple]]:
    """
    (índice, elemento, transform do pai, bbox exata) dos filhos que pintam.

    Descarta o que claramente não é osso: micro-partículas e camadas que cobrem
    quase toda a largura (fundo/registro). No arquivo da perna há um grupo que
    mede a imagem inteira e, se entrasse, estragaria o eixo de simetria.
    """
    saida = []
    m_raiz = parse_transform(root.get("transform"))
    brutos = []
    for i, ch in enumerate(root):
        if tag_de(ch) in ("defs", "metadata", "style", "title", "desc", "marker"):
            continue
        bb = bbox_subarvore(ch, m_raiz, css)
        if bb is None or max(bb[2] - bb[0], bb[3] - bb[1]) < MINIMO_PECA:
            continue
        brutos.append((i, ch, m_raiz, bb))

    if not brutos:
        return []
    largura_total = max(b[3][2] for b in brutos) - min(b[3][0] for b in brutos)
    for item in brutos:
        larg = item[3][2] - item[3][0]
        if largura_total > 0 and larg / largura_total > MAX_FRACAO_LARGURA:
            print(
                f"  (ignorando grupo #{item[0]}: cobre {larg / largura_total:.0%} "
                "da largura, é camada de fundo e não osso)"
            )
            continue
        saida.append(item)
    return saida


def peca_do_hotspot(grupos, ponto: Ponto):
    """
    Menor grupo que contém o hotspot. O "menor" é o que desempata bboxes
    sobrepostas: o hotspot da fíbula cai dentro da bbox da tíbia também, mas a
    bbox da fíbula é bem menor.
    """
    candidatos = [g for g in grupos if contem(g[3], ponto)]
    if not candidatos:
        return None
    return min(candidatos, key=lambda g: area(g[3]))


def centro_x(bb) -> float:
    return (bb[0] + bb[2]) / 2


def distancia_forma(a, b) -> float:
    """
    Quão diferentes duas bboxes são como FORMA e ALTURA na imagem.

    Deliberadamente não olha x: o par espelhado tem x oposto, mas tem que ter a
    mesma largura, a mesma altura e ocupar a mesma faixa vertical. Nos ossos da
    perna isso separa muito bem — a tíbia erra por ~4 e a fíbula por ~6, enquanto
    confundir uma com a outra erraria por ~58.
    """
    la, ha = a[2] - a[0], a[3] - a[1]
    lb, hb = b[2] - b[0], b[3] - b[1]
    return abs(la - lb) + abs(ha - hb) + abs(a[1] - b[1]) + abs(a[3] - b[3])


def casar_espelho(grupos, bb_origem, usados: set, tolerancia_rel: float):
    """
    Par espelhado de `bb_origem`: mesma forma, mesma faixa vertical, do outro
    lado. Devolve (grupo, erro_de_forma) ou (None, melhor_erro).
    """
    escala = (bb_origem[2] - bb_origem[0]) + (bb_origem[3] - bb_origem[1])
    limite = escala * tolerancia_rel
    melhor = None
    for g in grupos:
        if g[0] in usados:
            continue
        # tem que estar do outro lado do osso de origem
        if centro_x(g[3]) <= centro_x(bb_origem):
            continue
        d = distancia_forma(bb_origem, g[3])
        if melhor is None or d < melhor[0]:
            melhor = (d, g)
    if melhor is None:
        return None, float("inf")
    if melhor[0] > limite:
        return None, melhor[0]
    return melhor[1], melhor[0]


# --- serialização da peça -----------------------------------------------------

DESCARTAR = {"text", "switch", "title", "desc", "metadata", "marker", "foreignObject"}

ATRIBUTOS_INUTEIS = ("id", "overflow", "version", "font-family", "font-size", "xml:space")


def limpar_peca(el, css=None, herdado=None) -> None:
    """Tira texto, marcação vermelha, metadados e micro-sujeira de dentro da peça."""
    for pai in list(el.iter()):
        for filho in list(pai):
            t = tag_de(filho)
            if t in DESCARTAR or not isinstance(filho.tag, str):
                pai.remove(filho)

    # vermelho de marcação e micro-partículas: precisa da tinta efetiva e do
    # transform, então percorre com caminhar já com a árvore sem texto
    fora = []
    for e, mm, pai, tinta in caminhar(el, IDENTIDADE, None, herdado, css):
        if pai is None or tag_de(e) not in TAGS_GEOMETRIA:
            continue
        if eh_vermelho_el(e, tinta):
            fora.append((pai, e))
            continue
        b = bbox([aplicar(mm, p) for p in pontos_do_elemento(e, True)])
        if b is not None and max(b[2] - b[0], b[3] - b[1]) < MINIMO_PECA:
            fora.append((pai, e))
    for pai, e in fora:
        pai.remove(e)

    for e in el.iter():
        for attr in ATRIBUTOS_INUTEIS:
            e.attrib.pop(attr, None)


def encolher_numeros(svg: str) -> str:
    return re.sub(r"-?\d+\.\d{3,}", lambda m: f"{round(float(m.group(0)), 2):g}", svg)


def svg_da_peca(el, m_pai: Matriz, bb, css=None) -> str:
    """
    Peça isolada num <svg> com viewBox na própria bbox.

    O transform acumulado dos ancestrais é reaplicado num <g> em volta, para a
    geometria cair nas mesmas coordenadas em que a bbox foi medida.
    """
    copia = ET.fromstring(ET.tostring(el))
    limpar_peca(copia, css)

    x0, y0, x1, y1 = com_margem(bb)
    svg = ET.Element(f"{{{SVG_NS}}}svg")
    svg.set("viewBox", f"{x0:g} {y0:g} {x1 - x0:g} {y1 - y0:g}")
    envelope = ET.SubElement(svg, f"{{{SVG_NS}}}g")
    a, b, c, d, e, f = m_pai
    if m_pai != IDENTIDADE:
        envelope.set("transform", f"matrix({a:g} {b:g} {c:g} {d:g} {e:g} {f:g})")
    envelope.append(copia)

    ET.register_namespace("", SVG_NS)
    bruto = ET.tostring(svg, encoding="unicode")
    bruto = re.sub(r"\s*\n\s*", "", bruto)
    return encolher_numeros(bruto)


def escrever_modulo(modulo: str, pecas: list[dict], meta: dict) -> Path:
    DIR_SVG.mkdir(parents=True, exist_ok=True)
    destino = DIR_SVG / f"{modulo}.ts"
    linhas = [
        "// GERADO por scripts/gerar_montar.py — não editar à mão.",
        f"// Origem: {meta['arquivo']} (Wikimedia Commons)",
        f"// Crédito: {meta['credito']}",
        "// Cada peça é um osso isolado, com viewBox na própria bbox.",
        "",
    ]
    for p in pecas:
        literal = p["svg"].replace("\\", "\\\\").replace("`", "\\`").replace("${", "\\${")
        linhas.append(f"const {nome_const(p['id'])} = `{literal}`;")
        linhas.append("")
    corpo = ",\n".join(f"  {p['id']!r}: {nome_const(p['id'])}" for p in pecas)
    linhas.append(f"export const {nome_const(modulo)}: Record<string, string> = {{")
    linhas.append(corpo)
    linhas.append("};")
    destino.write_text("\n".join(linhas) + "\n", encoding="utf-8")
    return destino


# --- orquestração -------------------------------------------------------------

def localizar(cfg: dict, root, grupos, hotspots, achados_por_regiao: dict):
    """[(id, nome, elemento, transform do pai, bbox)] das peças da região."""
    mapa: dict[str, tuple[str, str]] = cfg["pecas"]

    if "espelhar_de" not in cfg:
        por_rotulo = {r: p for r, p in hotspots}
        faltando = set(mapa) - set(por_rotulo)
        if faltando:
            raise RuntimeError(f"rótulos ausentes na fonte: {sorted(faltando)}")

        saida = []
        usados: set[int] = set()
        for rotulo_en, (pid, nome) in mapa.items():
            g = peca_do_hotspot(grupos, por_rotulo[rotulo_en])
            if g is None:
                raise RuntimeError(f'nenhum grupo contém o hotspot de "{rotulo_en}"')
            if g[0] in usados:
                raise RuntimeError(
                    f'grupo #{g[0]} casaria com duas peças (rótulo "{rotulo_en}")'
                )
            usados.add(g[0])
            saida.append((pid, nome, g[1], g[2], g[3]))
            print(f"    {nome:10} grupo #{g[0]:<3} bbox={tuple(round(v,1) for v in g[3])}")
        return saida

    # --- lado sem rótulo: espelha o lado já resolvido ---
    origem = achados_por_regiao[cfg["espelhar_de"]]

    # os grupos do lado de origem estão fora do jogo
    usados: set[int] = set()
    for _pid, _nome, _el, _m, bb in origem:
        for g in grupos:
            if g[3] == bb:
                usados.add(g[0])

    saida = []
    eixos = []
    for pid, nome, _el, _m, bb in origem:
        g, erro = casar_espelho(grupos, bb, usados, TOLERANCIA_ESPELHO)
        if g is None:
            raise RuntimeError(
                f'nenhum grupo espelha "{nome}" com forma compatível '
                f"(melhor erro {erro:.2f})"
            )
        usados.add(g[0])
        eixo = (centro_x(bb) + centro_x(g[3])) / 2
        eixos.append(eixo)
        saida.append((pid, nome, g[1], g[2], g[3]))
        print(
            f"    {nome:10} grupo #{g[0]:<3} bbox={tuple(round(v,1) for v in g[3])} "
            f"· erro de forma {erro:5.2f} · eixo implícito x={eixo:.2f}"
        )

    # Todos os pares têm que implicar o MESMO eixo de simetria. Se um par
    # discordar, o casamento por forma pegou a peça errada — falha alto em vez de
    # gerar um tabuleiro com osso trocado de lado.
    espalhamento = max(eixos) - min(eixos)
    largura_media = sum(bb[2] - bb[0] for *_x, bb in [(p[0], p[4]) for p in origem]) / len(origem)
    if espalhamento > largura_media:
        raise RuntimeError(
            f"eixos de simetria discordam entre si (espalhamento {espalhamento:.2f} > "
            f"largura média {largura_media:.2f}): pareamento suspeito"
        )
    print(f"    eixo de simetria consistente: {espalhamento:.2f} de espalhamento")
    return saida


def processar(cfg: dict, root, grupos, hotspots, achados: dict, inspecionar: bool, css=None):
    print(f"\n=== {cfg['id']} — {cfg['titulo']}")
    encontradas = localizar(cfg, root, grupos, hotspots, achados)
    achados[cfg["id"]] = encontradas

    # tabuleiro = união das peças da região
    tab = None
    for *_r, bb in [(p[0], p[4]) for p in encontradas]:
        tab = unir_bbox(tab, bb)
    tab = com_margem(tab, 0.06)
    tw, th = tab[2] - tab[0], tab[3] - tab[1]
    print(f"    tabuleiro {tuple(round(v,1) for v in tab)} aspecto={tw/th:.4f}")

    if inspecionar:
        print("    (inspeção: nada escrito)")
        return None

    pecas_json = []
    pecas_svg = []
    for pid, nome, el, m, bb in encontradas:
        cxp = ((bb[0] + bb[2]) / 2 - tab[0]) / tw
        cyp = ((bb[1] + bb[3]) / 2 - tab[1]) / th
        # com a margem da peça, para o viewBox dela casar com o tamanho anunciado
        mx0, my0, mx1, my1 = com_margem(bb)
        pecas_json.append(
            {
                "id": pid,
                "nome": nome,
                "destino": {"x": round(cxp, 4), "y": round(cyp, 4)},
                "tamanho": {"w": round((mx1 - mx0) / tw, 4), "h": round((my1 - my0) / th, 4)},
            }
        )
        pecas_svg.append({"id": pid, "svg": svg_da_peca(el, m, bb, css)})

    pecas_json.sort(key=lambda p: (p["destino"]["y"], p["destino"]["x"]))
    destino = escrever_modulo(cfg["modulo"], pecas_svg, cfg)
    kb = sum(len(p["svg"]) for p in pecas_svg) / 1024
    print(f"    SVG das peças: {destino.relative_to(RAIZ)} ({kb:.1f} KB)")
    for p in pecas_json:
        print(
            f"      {p['nome']:10} destino=({p['destino']['x']:.4f},{p['destino']['y']:.4f}) "
            f"tamanho=({p['tamanho']['w']:.4f}×{p['tamanho']['h']:.4f})"
        )

    return {
        "id": cfg["id"],
        "ordem": cfg["ordem"],
        "trilhaId": cfg["trilhaId"],
        "sistema": "ossos",
        "titulo": cfg["titulo"],
        "subtitulo": cfg["subtitulo"],
        "modulo": cfg["modulo"],
        "lado": cfg["lado"],
        "aspecto": round(tw / th, 4),
        "pecas": pecas_json,
        "fonte": cfg["fonte"],
        "urlFonte": "https://commons.wikimedia.org/wiki/File:"
        + cfg["arquivo"].replace(" ", "_"),
        "imagemCredito": cfg["credito"],
    }


def main() -> None:
    inspecionar = "--inspecionar" in sys.argv

    # a fonte é a mesma para as duas regiões: baixa e analisa uma vez
    arquivos = {cfg["arquivo"] for cfg in REGIOES}
    if len(arquivos) != 1:
        raise RuntimeError("catálogo com múltiplas fontes ainda não suportado")
    arquivo = arquivos.pop()

    print(f"baixando {arquivo} ...")
    root = ET.fromstring(baixar_svg(arquivo))
    css = coletar_css(root)
    coleta = coletar(root)
    hotspots = resolver_hotspots(coleta)
    grupos = grupos_de_topo(root, css)
    print(f"grupos que pintam: {len(grupos)} · hotspots: {len(hotspots)}")

    achados: dict = {}
    entradas = []
    for cfg in REGIOES:
        e = processar(cfg, root, grupos, hotspots, achados, inspecionar, css)
        if e:
            entradas.append(e)

    if not entradas:
        return

    entradas.sort(key=lambda t: t["ordem"])
    JSON_MONTAR.write_text(
        json.dumps(
            {
                "_nota": (
                    "Tabuleiros do jogo 'Montar o corpo' — GERADO por "
                    "scripts/gerar_montar.py, NÃO editar à mão. `destino` é o centro "
                    "correto da peça e `tamanho` o tamanho dela, ambos em fração do "
                    "tabuleiro (0..1). A geometria de cada peça fica em "
                    "src/components/pranchas/svg/montar-*.ts."
                ),
                "tabuleiros": entradas,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"\n✅ {len(entradas)} tabuleiro(s) em {JSON_MONTAR.relative_to(RAIZ)}")


if __name__ == "__main__":
    main()
