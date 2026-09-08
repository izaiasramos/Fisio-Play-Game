#!/usr/bin/env python3
"""
Utilidades de geometria SVG usadas por `gerar_pranchas.py`.

Só stdlib. O que precisamos é modesto mas tem que estar certo:
  - compor `transform` dos ancestrais (matrix/translate/scale/rotate) para saber
    onde um elemento realmente cai na tela;
  - varrer o `d` de um <path> respeitando comandos relativos, para calcular
    bounding box (usado tanto para achar as bolinhas dos rótulos quanto para
    recortar o viewBox em volta do desenho).

Não é um renderizador: curvas são aproximadas pelos pontos de controle, o que
superestima levemente a bbox. Para recorte e classificação de bolinha é de sobra.
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


def pontos_do_path(d: str) -> list[Ponto]:
    """
    Pontos percorridos pelo path, em coordenadas locais do elemento.
    Comandos relativos são resolvidos; pontos de controle entram na lista
    (aproximação segura por excesso para fins de bbox).
    """
    pts: list[Ponto] = []
    cx = cy = 0.0          # ponto atual
    sx = sy = 0.0          # início do subpath (para Z)
    cmd = ""
    args: list[float] = []

    def consumir() -> None:
        """Consome `args` de acordo com `cmd`, avançando o ponto atual."""
        nonlocal cx, cy, sx, sy, args
        rel = cmd.islower()
        c = cmd.upper()
        passo = {"M": 2, "L": 2, "T": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "A": 7}.get(c)
        if passo is None:
            return
        i = 0
        primeiro = True
        while i + passo <= len(args):
            bloco = args[i : i + passo]
            if c in ("M", "L", "T"):
                x, y = bloco
                cx, cy = (cx + x, cy + y) if rel else (x, y)
                if c == "M" and primeiro:
                    sx, sy = cx, cy
                pts.append((cx, cy))
            elif c == "H":
                cx = cx + bloco[0] if rel else bloco[0]
                pts.append((cx, cy))
            elif c == "V":
                cy = cy + bloco[0] if rel else bloco[0]
                pts.append((cx, cy))
            elif c in ("C", "S", "Q"):
                # pares (x,y) sequenciais; o último é o ponto final
                for j in range(0, passo, 2):
                    x, y = bloco[j], bloco[j + 1]
                    px, py = (cx + x, cy + y) if rel else (x, y)
                    pts.append((px, py))
                fx, fy = bloco[passo - 2], bloco[passo - 1]
                cx, cy = (cx + fx, cy + fy) if rel else (fx, fy)
            elif c == "A":
                x, y = bloco[5], bloco[6]
                cx, cy = (cx + x, cy + y) if rel else (x, y)
                pts.append((cx, cy))
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


def pontos_do_elemento(el) -> list[Ponto]:
    """Pontos que delimitam o elemento, em coordenadas locais (sem transform)."""
    tag = el.tag.split("}")[-1]
    if tag == "path":
        return pontos_do_path(el.get("d", ""))
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
    True para vermelhos "de marcação" (linha-guia e bolinha dos rótulos).
    Aceita variações tipo #FF0303/#FF0707 que os arquivos do Commons usam,
    mas rejeita tons de pele/osso alaranjados (que têm verde/azul altos).
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
    return r >= 200 and g <= 60 and b <= 60


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
