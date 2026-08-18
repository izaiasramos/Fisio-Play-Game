#!/usr/bin/env python3
"""Gera os sons de feedback do FisioPlay por síntese, sem dependências externas.

Motivo de existir: os .wav do app são gerados por ESTE script, então são obra
própria do projeto (licença MIT, igual ao resto do repositório). Não há amostra
de terceiro, banco de sons ou atribuição pendente — o que importa num
repositório público, onde publicar um arquivo é redistribuí-lo.

Uso:
    python3 scripts/gerar_sons.py

Sobrescreve assets/sounds/{acerto,erro,flatline}.wav mantendo o mesmo formato
que o app já consumia (mono, 16 bits; 22050 Hz nos curtos, 44100 Hz no flatline).
"""

from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

SAIDA = Path(__file__).resolve().parent.parent / "assets" / "sounds"

# Amplitude de pico deixada em 0.62 do fundo de escala: dá volume audível no
# alto-falante do celular sem clipar quando os harmônicos se somam.
PICO = 0.62


def escrever_wav(caminho: Path, amostras: list[float], taxa: int) -> None:
    """Grava amostras em [-1, 1] como WAV PCM mono de 16 bits."""
    quadros = bytearray()
    for x in amostras:
        # trava em [-1, 1] antes de escalar, senão o int16 dá overflow e estala
        v = max(-1.0, min(1.0, x))
        quadros += struct.pack("<h", int(v * 32767))

    with wave.open(str(caminho), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(taxa)
        w.writeframes(bytes(quadros))


def envelope(i: int, total: int, ataque: float = 0.02, decaimento: float = 0.75) -> float:
    """Ataque rápido + decaimento exponencial — evita o clique de início/fim."""
    pos = i / total
    if pos < ataque:
        return pos / ataque
    resto = (pos - ataque) / (1.0 - ataque)
    return math.exp(-decaimento * 6.0 * resto)


def nota(freq: float, dur: float, taxa: int, harmonico: float = 0.0) -> list[float]:
    """Senoide com um pouco de 2º harmônico para não soar oca demais."""
    total = int(dur * taxa)
    out = []
    for i in range(total):
        t = i / taxa
        v = math.sin(2 * math.pi * freq * t)
        if harmonico:
            v += harmonico * math.sin(2 * math.pi * freq * 2 * t)
        v /= 1.0 + harmonico
        out.append(v * envelope(i, total) * PICO)
    return out


def gerar_acerto(taxa: int = 22050) -> list[float]:
    """Arpejo ascendente C6-E6-G6: sobe, então é lido como recompensa."""
    amostras: list[float] = []
    for freq in (1046.50, 1318.51, 1567.98):
        amostras += nota(freq, 0.073, taxa, harmonico=0.25)
    return amostras


def gerar_erro(taxa: int = 22050) -> list[float]:
    """Duas notas graves descendentes, com harmônico forte pra soar 'áspero'."""
    amostras: list[float] = []
    for freq in (233.08, 174.61):  # Bb3 -> F3
        amostras += nota(freq, 0.11, taxa, harmonico=0.6)
    return amostras


def gerar_flatline(taxa: int = 44100, dur: float = 1.5) -> list[float]:
    """Bip contínuo de monitor cardíaco em assistolia.

    O app toca este arquivo EM LOOP, então ele precisa emendar sem estalo:
    1050 Hz a 44100 Hz dá exatamente 42 amostras por ciclo, e 1.5 s dá 1575
    ciclos inteiros. Começando e terminando em fase zero, a volta do loop é
    contínua. Por isso não há fade — um fade-out criaria o buraco audível.
    """
    total = int(dur * taxa)
    out = []
    for i in range(total):
        t = i / taxa
        v = math.sin(2 * math.pi * 1050.0 * t)
        v += 0.18 * math.sin(2 * math.pi * 2100.0 * t)  # brilho de monitor
        out.append(v / 1.18 * PICO)
    return out


def main() -> None:
    SAIDA.mkdir(parents=True, exist_ok=True)
    tarefas = [
        ("acerto.wav", gerar_acerto(), 22050),
        ("erro.wav", gerar_erro(), 22050),
        ("flatline.wav", gerar_flatline(), 44100),
    ]
    for nome, amostras, taxa in tarefas:
        destino = SAIDA / nome
        escrever_wav(destino, amostras, taxa)
        print(f"✓ {nome}: {len(amostras)} amostras @ {taxa} Hz ({destino.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
