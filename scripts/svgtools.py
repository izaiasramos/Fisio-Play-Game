#!/usr/bin/env python3
"""
Utilidades de geometria SVG usadas por `gerar_pranchas.py`.

Só stdlib. O que precisamos é modesto mas tem que estar certo:
  - compor `transform` dos ancestrais (matrix/translate/scale/rotate) para saber
    onde um elemento realmente cai na tela;
  - varrer o `d` de um <path> respeitando comandos relativos, para calcular
    bounding box (usado tanto para achar as bolinhas dos rótulos quanto para
    recortar o viewBox em volta do desenho).

Não é um renderizador. Por padrão, curvas são aproximadas pelos pontos de
controle, o que superestima levemente a bbox — para recorte de prancha e
classificação de bolinha é de sobra.

Quando a bbox precisa ser fiel à forma (extrair uma peça de osso e saber o
tamanho e o centro exatos dela), passe `achatar_curvas=True`: aí as curvas são
amostradas de verdade. O padrão continua sendo o modo aproximado, para o
pipeline de pranchas não mudar de resultado.
"""
from __future__ import annotations

import math
import re
from typing import Iterable, Iterator

SVG_NS = "http://www.w3.org/2000/svg"

# --- matrizes afins (a, b, c, d, e, f) equivalentes a matrix(a b c d e f) ------

IDENTIDADE = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

Matriz = tuple[float, float, float, float, float, float]
Ponto = tuple[float, float]


def multiplicar(m: Matriz, n: Matriz) -> Matriz:
    """m ∘ n — aplica n primeiro, depois m."""
    a1, b1, c1, d1, e1, f1 = m
    a2, b2, c2, d2, e2, f2 = n
    return (
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1,
    )


def aplicar(m: Matriz, p: Ponto) -> Ponto:
    a, b, c, d, e, f = m
    x, y = p
    return (a * x + c * y + e, b * x + d * y + f)


_NUM = r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?"
_FUNC_TRANSFORM = re.compile(r"(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)")


def _numeros(texto: str) -> list[float]:
    return [float(n) for n in re.findall(_NUM, texto)]


def parse_transform(valor: str | None) -> Matriz:
    """Converte um atributo `transform` completo numa única matriz."""
    if not valor:
        return IDENTIDADE
    m = IDENTIDADE
    for nome, args in _FUNC_TRANSFORM.findall(valor):
        v = _numeros(args)
        if nome == "matrix" and len(v) >= 6:
            atual: Matriz = (v[0], v[1], v[2], v[3], v[4], v[5])
        elif nome == "translate":
            tx = v[0] if v else 0.0
            ty = v[1] if len(v) > 1 else 0.0
            atual = (1, 0, 0, 1, tx, ty)
        elif nome == "scale":
            sx = v[0] if v else 1.0
            sy = v[1] if len(v) > 1 else sx
            atual = (sx, 0, 0, sy, 0, 0)
        elif nome == "rotate":
            ang = math.radians(v[0] if v else 0.0)
            cos, sen = math.cos(ang), math.sin(ang)
            rot: Matriz = (cos, sen, -sen, cos, 0, 0)
            if len(v) >= 3:  # rotate(a cx cy) = translate ∘ rot ∘ -translate
                cx, cy = v[1], v[2]
                atual = multiplicar(
                    multiplicar((1, 0, 0, 1, cx, cy), rot), (1, 0, 0, 1, -cx, -cy)
                )
            else:
                atual = rot
        elif nome == "skewX":
            atual = (1, 0, math.tan(math.radians(v[0] if v else 0.0)), 1, 0, 0)
        elif nome == "skewY":
            atual = (1, math.tan(math.radians(v[0] if v else 0.0)), 0, 1, 0, 0)
        else:
            continue
        m = multiplicar(m, atual)
    return m


# --- varredura de <path d="..."> ----------------------------------------------

_TOKEN = re.compile(rf"([MmZzLlHhVvCcSsQqTtAa])|({_NUM})")


def _tokens(d: str) -> Iterator[tuple[str | None, float | None]]:
    for cmd, num in _TOKEN.findall(d):
        yield (cmd, None) if cmd else (None, float(num))


# Amostras por curva no modo achatado. 16 deixa o erro de bbox bem abaixo de 1%
# do tamanho da peça, e o custo é irrelevante (roda offline, no gerador).
AMOSTRAS_CURVA = 16


def _bezier3(p0: Ponto, p1: Ponto, p2: Ponto, p3: Ponto, t: float) -> Ponto:
    u = 1 - t
    a, b, c, d = u * u * u, 3 * u * u * t, 3 * u * t * t, t * t * t
    return (
        a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
        a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    )


def _bezier2(p0: Ponto, p1: Ponto, p2: Ponto, t: float) -> Ponto:
    u = 1 - t
    a, b, c = u * u, 2 * u * t, t * t
    return (a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1])


def _pontos_arco(
    p0: Ponto,
    rx: float,
    ry: float,
    rot_graus: float,
    arco_grande: bool,
    varredura: bool,
    p1: Ponto,
    n: int,
) -> list[Ponto]:
    """
    Amostra um arco elíptico (A/a). Conversão endpoint → centro conforme o
    apêndice F.6.5 da especificação SVG.
    """
    if rx == 0 or ry == 0 or p0 == p1:
        return [p1]

    rx, ry = abs(rx), abs(ry)
    phi = math.radians(rot_graus)
    cosp, sinp = math.cos(phi), math.sin(phi)

    dx2, dy2 = (p0[0] - p1[0]) / 2, (p0[1] - p1[1]) / 2
    x1p = cosp * dx2 + sinp * dy2
    y1p = -sinp * dx2 + cosp * dy2

    # raios pequenos demais para ligar os dois pontos: escala até caber
    lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry)
    if lam > 1:
        s = math.sqrt(lam)
        rx *= s
        ry *= s

    den = rx * rx * y1p * y1p + ry * ry * x1p * x1p
    if den == 0:
        return [p1]
    co = math.sqrt(max(0.0, (rx * rx * ry * ry - den) / den))
    if arco_grande == varredura:
        co = -co

    cxp = co * rx * y1p / ry
    cyp = -co * ry * x1p / rx
    cx = cosp * cxp - sinp * cyp + (p0[0] + p1[0]) / 2
    cy = sinp * cxp + cosp * cyp + (p0[1] + p1[1]) / 2

    def angulo(ux: float, uy: float, vx: float, vy: float) -> float:
        d = math.hypot(ux, uy) * math.hypot(vx, vy)
        if d == 0:
            return 0.0
        c = max(-1.0, min(1.0, (ux * vx + uy * vy) / d))
        a = math.acos(c)
        return -a if (ux * vy - uy * vx) < 0 else a

    ux, uy = (x1p - cxp) / rx, (y1p - cyp) / ry
    vx, vy = (-x1p - cxp) / rx, (-y1p - cyp) / ry
    theta1 = angulo(1, 0, ux, uy)
    dtheta = angulo(ux, uy, vx, vy)
    if not varredura and dtheta > 0:
        dtheta -= 2 * math.pi
    elif varredura and dtheta < 0:
        dtheta += 2 * math.pi

    saida: list[Ponto] = []
    for i in range(1, n + 1):
        th = theta1 + dtheta * (i / n)
        cost, sint = math.cos(th), math.sin(th)
        saida.append(
            (
                cosp * rx * cost - sinp * ry * sint + cx,
                sinp * rx * cost + cosp * ry * sint + cy,
            )
        )
    return saida


def pontos_do_path(
    d: str, achatar_curvas: bool = False, amostras: int = AMOSTRAS_CURVA
) -> list[Ponto]:
    """
    Pontos percorridos pelo path, em coordenadas locais do elemento.
    Comandos relativos são resolvidos.

    Com `achatar_curvas=False` (padrão) os pontos de controle entram na lista:
    aproximação por excesso, suficiente para recorte de prancha. Com `True`, as
    curvas C/S/Q/T/A são amostradas e a bbox resultante é fiel à forma — é o que
    a extração de peças precisa.
    """
    pts: list[Ponto] = []
    cx = cy = 0.0          # ponto atual
    sx = sy = 0.0          # início do subpath (para Z)
    ctrl_ant: Ponto | None = None   # último controle, para espelhar S/s e T/t
    tipo_ant = ""                   # "C" ou "Q" se o comando anterior foi curva
    cmd = ""
    args: list[float] = []

    def consumir() -> None:
        """Consome `args` de acordo com `cmd`, avançando o ponto atual."""
        nonlocal cx, cy, sx, sy, args, ctrl_ant, tipo_ant
        rel = cmd.islower()
        c = cmd.upper()
        passo = {"M": 2, "L": 2, "T": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "A": 7}.get(c)
        if passo is None:
            return
        i = 0
        primeiro = True
        while i + passo <= len(args):
            bloco = args[i : i + passo]

            if c in ("M", "L"):
                x, y = bloco
                cx, cy = (cx + x, cy + y) if rel else (x, y)
                if c == "M" and primeiro:
                    sx, sy = cx, cy
                pts.append((cx, cy))
                ctrl_ant, tipo_ant = None, ""

            elif c == "H":
                cx = cx + bloco[0] if rel else bloco[0]
                pts.append((cx, cy))
                ctrl_ant, tipo_ant = None, ""

            elif c == "V":
                cy = cy + bloco[0] if rel else bloco[0]
                pts.append((cx, cy))
                ctrl_ant, tipo_ant = None, ""

            elif c in ("C", "S", "Q", "T"):
                p0 = (cx, cy)
                if c == "C":
                    c1 = (cx + bloco[0], cy + bloco[1]) if rel else (bloco[0], bloco[1])
                    c2 = (cx + bloco[2], cy + bloco[3]) if rel else (bloco[2], bloco[3])
                    fim = (cx + bloco[4], cy + bloco[5]) if rel else (bloco[4], bloco[5])
                elif c == "S":
                    # 1º controle = espelho do último controle da curva anterior
                    c1 = (
                        (2 * cx - ctrl_ant[0], 2 * cy - ctrl_ant[1])
                        if ctrl_ant is not None and tipo_ant == "C"
                        else p0
                    )
                    c2 = (cx + bloco[0], cy + bloco[1]) if rel else (bloco[0], bloco[1])
                    fim = (cx + bloco[2], cy + bloco[3]) if rel else (bloco[2], bloco[3])
                elif c == "Q":
                    c1 = (cx + bloco[0], cy + bloco[1]) if rel else (bloco[0], bloco[1])
                    c2 = c1
                    fim = (cx + bloco[2], cy + bloco[3]) if rel else (bloco[2], bloco[3])
                else:  # T
                    c1 = (
                        (2 * cx - ctrl_ant[0], 2 * cy - ctrl_ant[1])
                        if ctrl_ant is not None and tipo_ant == "Q"
                        else p0
                    )
                    c2 = c1
                    fim = (cx + bloco[0], cy + bloco[1]) if rel else (bloco[0], bloco[1])

                if achatar_curvas:
                    for k in range(1, amostras + 1):
                        t = k / amostras
                        pts.append(
                            _bezier2(p0, c1, fim, t)
                            if c in ("Q", "T")
                            else _bezier3(p0, c1, c2, fim, t)
                        )
                elif c in ("Q", "T"):
                    pts.extend([c1, fim])
                else:
                    pts.extend([c1, c2, fim])

                ctrl_ant = c1 if c in ("Q", "T") else c2
                tipo_ant = "Q" if c in ("Q", "T") else "C"
                cx, cy = fim

            elif c == "A":
                p0 = (cx, cy)
                rx, ry, rot = bloco[0], bloco[1], bloco[2]
                grande, varre = bool(bloco[3]), bool(bloco[4])
                fim = (cx + bloco[5], cy + bloco[6]) if rel else (bloco[5], bloco[6])
                if achatar_curvas:
                    pts.extend(_pontos_arco(p0, rx, ry, rot, grande, varre, fim, amostras))
                else:
                    pts.append(fim)
                cx, cy = fim
                ctrl_ant, tipo_ant = None, ""

            i += passo
            primeiro = False
        args = []

    for tok_cmd, num in _tokens(d):
        if tok_cmd is not None:
            consumir()
            cmd = tok_cmd
            if cmd in ("Z", "z"):
                cx, cy = sx, sy
                pts.append((cx, cy))
                cmd = ""
                ctrl_ant, tipo_ant = None, ""
        elif num is not None:
            args.append(num)
    consumir()
    return pts


# --- pontos de qualquer elemento geométrico ----------------------------------

def _f(el, nome: str, padrao: float = 0.0) -> float:
    try:
        return float(el.get(nome, padrao))
    except (TypeError, ValueError):
        return padrao


def pontos_do_elemento(el, achatar_curvas: bool = False) -> list[Ponto]:
    """
    Pontos que delimitam o elemento, em coordenadas locais (sem transform).
    Ver `pontos_do_path` para o efeito de `achatar_curvas`.
    """
    tag = el.tag.split("}")[-1]
    if tag == "path":
        return pontos_do_path(el.get("d", ""), achatar_curvas)
    if tag in ("circle", "ellipse"):
        cx, cy = _f(el, "cx"), _f(el, "cy")
        r = _f(el, "r")
        rx = _f(el, "rx", r) or r
        ry = _f(el, "ry", r) or r
        return [(cx - rx, cy - ry), (cx + rx, cy + ry)]
    if tag == "rect":
        x, y = _f(el, "x"), _f(el, "y")
        return [(x, y), (x + _f(el, "width"), y + _f(el, "height"))]
    if tag == "line":
        return [(_f(el, "x1"), _f(el, "y1")), (_f(el, "x2"), _f(el, "y2"))]
    if tag in ("polygon", "polyline"):
        v = _numeros(el.get("points", ""))
        return list(zip(v[0::2], v[1::2]))
    if tag == "text":
        return [(_f(el, "x"), _f(el, "y"))]
    return []


def bbox(pontos: Iterable[Ponto]) -> tuple[float, float, float, float] | None:
    """(minx, miny, maxx, maxy) ou None se não houver pontos."""
    xs: list[float] = []
    ys: list[float] = []
    for x, y in pontos:
        xs.append(x)
        ys.append(y)
    if not xs:
        return None
    return (min(xs), min(ys), max(xs), max(ys))


def unir_bbox(a, b):
    if a is None:
        return b
    if b is None:
        return a
    return (min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3]))


# --- cor ----------------------------------------------------------------------

def _canal(h: str) -> tuple[int, int, int] | None:
    h = h.strip().lower()
    if not h.startswith("#"):
        return None
    h = h[1:]
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return None
    try:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except ValueError:
        return None


def eh_vermelho(valor: str | None) -> bool:
    """
    True só para o vermelho SATURADO de marcação (linha-guia e bolinha do rótulo).

    O limite é apertado de propósito. Pranchas do Commons usam variações como
    #FF0303/#FF0707 na marcação, mas também usam vermelho escuro (#CC0000) como
    CONTORNO DE OSSO — se o teste fosse frouxo, apagaria anatomia de verdade.
    """
    if not valor:
        return False
    v = valor.strip().lower()
    if v in ("red", "#f00", "#ff0000"):
        return True
    rgb = _canal(v)
    if rgb is None:
        return False
    r, g, b = rgb
    return r >= 230 and g <= 30 and b <= 30


# --- CSS embutido (<style>) ---------------------------------------------------

def coletar_css(root) -> dict[str, dict[str, str]]:
    """
    Regras de <style> num mapa {seletor: {prop: valor}}.

    Suporta só os seletores simples que as pranchas usam (`text`, `.leader`,
    `#id`) — o bastante, e nada além. Importa por dois motivos: a marcação
    vermelha pode estar declarada por classe (e não por atributo), e o SvgXml do
    react-native-svg não aplica CSS, então tudo precisa virar atributo depois.
    """
    regras: dict[str, dict[str, str]] = {}
    for el in root.iter():
        if el.tag.split("}")[-1] != "style":
            continue
        css = "".join(el.itertext())
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
        for bloco in re.finditer(r"([^{}]+)\{([^{}]*)\}", css):
            seletores = [s.strip() for s in bloco.group(1).split(",") if s.strip()]
            decls: dict[str, str] = {}
            for par in bloco.group(2).split(";"):
                if ":" in par:
                    k, v = par.split(":", 1)
                    decls[k.strip().lower()] = v.strip()
            for sel in seletores:
                regras.setdefault(sel, {}).update(decls)
    return regras


def css_do_elemento(el, regras: dict[str, dict[str, str]]) -> dict[str, str]:
    """Declarações que valem para o elemento (tag < .classe < #id)."""
    saida: dict[str, str] = {}
    tag = el.tag.split("}")[-1]
    if tag in regras:
        saida.update(regras[tag])
    for classe in (el.get("class") or "").split():
        if f".{classe}" in regras:
            saida.update(regras[f".{classe}"])
    ident = el.get("id")
    if ident and f"#{ident}" in regras:
        saida.update(regras[f"#{ident}"])
    return saida


def cores_do_elemento(el) -> list[str]:
    """fill/stroke declarados por atributo ou dentro de style=."""
    saida = [el.get("fill"), el.get("stroke")]
    estilo = el.get("style") or ""
    for prop in ("fill", "stroke"):
        m = re.search(rf"(?:^|;)\s*{prop}\s*:\s*([^;]+)", estilo)
        if m:
            saida.append(m.group(1))
    return [c for c in saida if c]


def pintura(el, prop: str) -> str | None:
    """Valor efetivo de fill/stroke no próprio elemento (atributo ou style)."""
    estilo = el.get("style") or ""
    m = re.search(rf"(?:^|;)\s*{prop}\s*:\s*([^;]+)", estilo)
    if m:
        return m.group(1).strip().lower()
    v = el.get(prop)
    return v.strip().lower() if v else None


def nao_pinta_nada(el) -> bool:
    """
    True para elementos que não produzem tinta — típicos de arquivos do Commons:
    linhas de registro com `fill` mas sem `stroke` (uma <line> só aparece com
    stroke), ou formas com fill:none e stroke:none. Precisam ficar fora do
    cálculo de recorte, senão esticam o viewBox para nada.
    """
    tag = el.tag.split("}")[-1]
    fill = pintura(el, "fill")
    stroke = pintura(el, "stroke")
    sem_stroke = stroke in (None, "none", "transparent")
    sem_fill = fill in (None, "none", "transparent")

    if tag in ("line", "polyline") and sem_stroke:
        return True
    if sem_stroke and sem_fill:
        return True
    return False
