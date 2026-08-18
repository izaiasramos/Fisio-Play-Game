#!/usr/bin/env python3
"""
Busca autor + licença das imagens no Wikimedia Commons EM LOTE (poucas requisições,
sem rate limit) e grava/atualiza em anatomia.json:
  - "imagemFonte":   URL da página do arquivo no Commons (licença/autor completos)
  - "imagemCredito": "<autor> · <licença>" (texto curto para o app)

Rodar:  python3 scripts/creditos_imagens.py
"""
import html, json, re, urllib.parse, urllib.request

JSON_PATH = "src/data/trilhas/anatomia.json"
UA = {"User-Agent": "FisioPlay/1.0 (educational; https://fisioplay.local)"}

def filename_from_url(u: str) -> str:
    u = u.split("?")[0]
    parts = u.split("/")
    nome = parts[-2] if "/thumb/" in u else parts[-1]
    return urllib.parse.unquote(nome)

def limpar(txt: str) -> str:
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = html.unescape(txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    txt = txt.replace('"', "'").replace("\\", "")
    return txt[:110]

def buscar_lote(nomes):
    """Retorna {filename_com_underscore: 'autor · licença'} para uma lista de nomes."""
    creditos = {}
    for i in range(0, len(nomes), 25):
        chunk = nomes[i:i + 25]
        titles = "|".join("File:" + n for n in chunk)
        api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json"
               "&prop=imageinfo&iiprop=extmetadata&titles=" + urllib.parse.quote(titles))
        try:
            data = json.load(urllib.request.urlopen(urllib.request.Request(api, headers=UA), timeout=30))
        except Exception as e:
            print("erro no lote:", e)
            continue
        for p in data.get("query", {}).get("pages", {}).values():
            titulo = p.get("title", "").replace("File:", "", 1).replace(" ", "_")
            try:
                ext = p["imageinfo"][0]["extmetadata"]
            except Exception:
                continue
            autor = limpar(ext.get("Artist", {}).get("value", ""))
            lic = limpar(ext.get("LicenseShortName", {}).get("value", ""))
            creditos[titulo] = " · ".join([x for x in [autor, lic] if x]) or "Wikimedia Commons"
    return creditos

def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        linhas = f.readlines()

    alvos = []  # (indice_linha, filename)
    for i, linha in enumerate(linhas):
        m = re.search(r'"imagem": "([^"]+)"', linha)
        if m:
            alvos.append((i, filename_from_url(m.group(1))))

    nomes_unicos = sorted({n for _, n in alvos})
    creditos = buscar_lote(nomes_unicos)

    for i, nome in alvos:
        cred = creditos.get(nome, "Wikimedia Commons")
        fonte = "https://commons.wikimedia.org/wiki/File:" + nome
        linha = linhas[i]
        if '"imagemCredito"' in linha:
            linha = re.sub(r'"imagemCredito": "[^"]*"', f'"imagemCredito": "{cred}"', linha)
        else:
            linha = linha.replace('"dificuldade"', f'"imagemCredito": "{cred}", "dificuldade"', 1)
        if '"imagemFonte"' in linha:
            linha = re.sub(r'"imagemFonte": "[^"]*"', f'"imagemFonte": "{fonte}"', linha)
        else:
            linha = linha.replace('"imagemCredito"', f'"imagemFonte": "{fonte}", "imagemCredito"', 1)
        linhas[i] = linha

    texto = "".join(linhas)
    json.loads(texto)  # valida antes de gravar
    with open(JSON_PATH, "w", encoding="utf-8") as f:
        f.write(texto)

    reais = sum(1 for _, n in alvos if creditos.get(n, "Wikimedia Commons") != "Wikimedia Commons")
    print(f"Itens processados: {len(alvos)} · com autor+licença reais: {reais}")

if __name__ == "__main__":
    main()
