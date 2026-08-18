#!/usr/bin/env python3
"""
Popula imagem/imagemFonte/imagemCredito de QUALQUER trilha, a partir de um mapa
id->título-de-artigo-da-Wikipedia(EN). Reutiliza o mesmo pipeline verificado do
anatomia.json:
  1. REST summary API da Wikipedia -> thumbnail/originalimage (URL REAL do Commons)
  2. normaliza para https://commons.wikimedia.org/wiki/Special:FilePath/<arquivo>?width=800
  3. confirma HTTP 200 (só grava se 200)
  4. crédito (autor · licença) via Commons API extmetadata (em lote)

Uso:  python3 scripts/imagens_trilha.py <trilha.json> <mapa.json>
onde <mapa.json> é { "ort-031": "Plantar fasciitis", ... }
NÃO inventa URL: usa só o que as APIs retornam e o que responde 200.
"""
import html, json, re, sys, time, urllib.parse, urllib.request

UA = {"User-Agent": "FisioPlay/1.0 (educational; https://fisioplay.local)"}


def rest_image(title: str):
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title, safe="")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
            data = json.load(r)
    except Exception as e:
        return None, f"erro: {e}"
    src = (data.get("thumbnail") or {}).get("source") or (data.get("originalimage") or {}).get("source")
    return (src, "ok") if src else (None, "sem imagem")


def filename_from_url(u: str) -> str:
    u = u.split("?")[0]
    parts = u.split("/")
    nome = parts[-2] if "/thumb/" in u else parts[-1]
    return urllib.parse.unquote(nome)


def canonical(filename: str) -> str:
    return ("https://commons.wikimedia.org/wiki/Special:FilePath/"
            + urllib.parse.quote(filename, safe="") + "?width=800")


def http_ok(url: str) -> bool:
    try:
        req = urllib.request.Request(url, headers=UA, method="HEAD")
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.status == 200
    except Exception:
        # alguns servem só GET; tenta GET leve
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
                return r.status == 200
        except Exception:
            return False


def limpar(txt: str) -> str:
    txt = re.sub(r"<[^>]+>", " ", txt)
    txt = html.unescape(txt)
    txt = re.sub(r"\s+", " ", txt).strip()
    txt = txt.replace('"', "'").replace("\\", "")
    return txt[:110]


def creditos_lote(nomes):
    creditos = {}
    for i in range(0, len(nomes), 25):
        chunk = nomes[i:i + 25]
        titles = "|".join("File:" + n for n in chunk)
        api = ("https://commons.wikimedia.org/w/api.php?action=query&format=json"
               "&prop=imageinfo&iiprop=extmetadata&titles=" + urllib.parse.quote(titles))
        try:
            data = json.load(urllib.request.urlopen(urllib.request.Request(api, headers=UA), timeout=30))
        except Exception as e:
            print("erro no lote de créditos:", e)
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
    if len(sys.argv) != 3:
        print("uso: python3 scripts/imagens_trilha.py <trilha.json> <mapa.json>")
        sys.exit(2)
    json_path, mapa_path = sys.argv[1], sys.argv[2]
    with open(mapa_path, encoding="utf-8") as f:
        MAP = json.load(f)
    with open(json_path, encoding="utf-8") as f:
        texto = f.read()

    escolhidos = {}  # id -> (url_canonica, filename)
    faltou = []
    for id_, title in MAP.items():
        linha_re = re.compile(r'(\{ "id": "' + re.escape(id_) + r'",[^\n]*?)(\}\s*,?)$', re.M)
        m = linha_re.search(texto)
        if not m:
            faltou.append((id_, "linha nao encontrada"))
            continue
        if '"imagem"' in m.group(1):
            continue
        src, status = rest_image(title)
        time.sleep(0.15)
        if not src:
            faltou.append((id_, f"{title}: {status}"))
            continue
        fname = filename_from_url(src)
        url = canonical(fname)
        if not http_ok(url):
            faltou.append((id_, f"{title}: Special:FilePath != 200"))
            continue
        escolhidos[id_] = (url, fname.replace(" ", "_"))

    creditos = creditos_lote(sorted({fn for _, fn in escolhidos.values()}))

    add = 0
    for id_, (url, fname) in escolhidos.items():
        cred = creditos.get(fname, "Wikimedia Commons")
        fonte = "https://commons.wikimedia.org/wiki/File:" + fname
        linha_re = re.compile(r'(\{ "id": "' + re.escape(id_) + r'",[^\n]*?)(\}\s*,?)$', re.M)
        m = linha_re.search(texto)
        bloco = (f'"imagem": "{url}", "imagemFonte": "{fonte}", '
                 f'"imagemCredito": "{cred}", "dificuldade"')
        novo = m.group(1).replace('"dificuldade"', bloco, 1)
        texto = texto[: m.start(1)] + novo + texto[m.end(1):]
        add += 1
        print(f"{id_}  ->  {url}  |  {cred}")

    json.loads(texto)  # valida antes de gravar
    with open(json_path, "w", encoding="utf-8") as f:
        f.write(texto)

    print(f"\n{json_path}: imagens adicionadas={add}")
    if faltou:
        print("Sem imagem (ok, campo opcional):")
        for id_, why in faltou:
            print(f"  - {id_}: {why}")


if __name__ == "__main__":
    main()
