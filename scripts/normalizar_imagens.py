#!/usr/bin/env python3
"""
Reescreve as URLs de `imagem` de anatomia.json para o formato canônico e estável
do Commons: https://commons.wikimedia.org/wiki/Special:FilePath/<arquivo>?width=800
(evita thumbs construídos à mão que retornam 400).

Rodar:  python3 scripts/normalizar_imagens.py
"""
import json, re, urllib.parse

JSON_PATH = "src/data/trilhas/anatomia.json"

def filename_from_url(u: str) -> str:
    u = u.split("?")[0]
    parts = u.split("/")
    nome = parts[-2] if "/thumb/" in u else parts[-1]
    return urllib.parse.unquote(nome)

def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        linhas = f.readlines()

    n = 0
    for i, linha in enumerate(linhas):
        m = re.search(r'"imagem": "([^"]+)"', linha)
        if not m:
            continue
        nome = filename_from_url(m.group(1))
        nova = ("https://commons.wikimedia.org/wiki/Special:FilePath/"
                + urllib.parse.quote(nome, safe="") + "?width=800")
        linhas[i] = linha.replace(m.group(0), f'"imagem": "{nova}"', 1)
        n += 1

    texto = "".join(linhas)
    json.loads(texto)
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        f.write(texto)
    print(f"URLs de imagem normalizadas: {n}")

if __name__ == "__main__":
    main()
