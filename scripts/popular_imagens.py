#!/usr/bin/env python3
"""
Popula o campo `imagem` dos itens de anatomia.json com imagens REAIS e verificadas
da Wikipedia/Wikimedia Commons (via REST summary API). Não inventa URL: usa o que a
API retorna e reduz para ~640px (mais leve). Só insere em itens que ainda não têm imagem.

Rodar:  python3 scripts/popular_imagens.py
"""
import json, re, sys, time, urllib.parse, urllib.request

JSON_PATH = "src/data/trilhas/anatomia.json"

# id do item -> título do artigo na Wikipedia (EN, onde as imagens de anatomia são mais completas)
MAP = {
    "ana-002": "Clavicle",
    "ana-003": "Humerus",
    "ana-004": "Radius (bone)",
    "ana-005": "Ulna",
    "ana-007": "Tibia",
    "ana-008": "Fibula",
    "ana-009": "Patella",
    "ana-010": "Sternum",
    "ana-011": "Vertebra",
    "ana-012": "Rib",
    "ana-013": "Phalanx bone",
    "ana-014": "Calcaneus",
    "ana-015": "Hip bone",
    "ana-016": "Mandible",
    "ana-017": "Diaphysis",
    "ana-019": "Periosteum",
    "ana-020": "Osteocyte",
    "ana-021": "Osteoblast",
    "ana-022": "Osteoclast",
    "ana-023": "Bone marrow",
    "ana-024": "Hyaline cartilage",
    "ana-025": "Synovial joint",
    "ana-026": "Synovial fluid",
    "ana-027": "Ligament",
    "ana-028": "Tendon",
    "ana-029": "Meniscus (anatomy)",
    "ana-030": "Joint capsule",
    "ana-031": "Deltoid muscle",
    "ana-032": "Biceps",
    "ana-033": "Triceps",
    "ana-034": "Quadriceps femoris muscle",
    "ana-035": "Hamstring",
    "ana-036": "Gastrocnemius muscle",
    "ana-037": "Soleus muscle",
    "ana-038": "Pectoralis major muscle",
    "ana-039": "Trapezius",
    "ana-040": "Latissimus dorsi muscle",
    "ana-041": "Rectus abdominis muscle",
    "ana-042": "Gluteus maximus",
    "ana-043": "Thoracic diaphragm",
    "ana-044": "Sarcomere",
    "ana-045": "Actin",
    "ana-046": "Myosin",
    "ana-047": "Myocyte",
    "ana-048": "Standard anatomical position",
    "ana-049": "Sagittal plane",
    "ana-050": "Anatomical terms of motion",
}

UA = {"User-Agent": "FisioPlay/1.0 (educational, contact: dev@fisioplay.local)"}

def shrink(url: str) -> str:
    """Reduz um thumbnail do Commons para ~640px de largura (mais leve)."""
    return re.sub(r"/(\d+)px-", "/640px-", url)

def fetch_img(title: str):
    url = "https://en.wikipedia.org/api/rest_v1/page/summary/" + urllib.parse.quote(title, safe="")
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=25) as r:
            data = json.load(r)
    except Exception as e:
        return None, f"erro: {e}"
    thumb = (data.get("thumbnail") or {}).get("source")
    orig = (data.get("originalimage") or {}).get("source")
    if thumb:
        return shrink(thumb), "ok(thumb)"
    if orig:
        return orig, "ok(orig)"
    return None, "sem imagem"

def main():
    with open(JSON_PATH, encoding="utf-8") as f:
        texto = f.read()

    achou, faltou = 0, []
    for id_, title in MAP.items():
        # pula se o item já tem imagem
        linha_re = re.compile(r'(\{ "id": "' + re.escape(id_) + r'",[^\n]*?)(\}\s*,?)$', re.M)
        m = linha_re.search(texto)
        if not m:
            faltou.append((id_, "linha nao encontrada"))
            continue
        if '"imagem"' in m.group(1):
            achou += 1
            continue
        img, status = fetch_img(title)
        time.sleep(0.2)
        if not img:
            faltou.append((id_, f"{title}: {status}"))
            continue
        # insere "imagem": "..." logo antes de "dificuldade"
        novo = m.group(1).replace(
            '"dificuldade"', f'"imagem": "{img}", "dificuldade"', 1
        )
        texto = texto[: m.start(1)] + novo + texto[m.end(1):]
        achou += 1
        print(f"{id_}  {title}  ->  {img}")

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        f.write(texto)

    print(f"\nItens com imagem agora: {achou}")
    if faltou:
        print("Sem imagem (revisar manualmente):")
        for id_, why in faltou:
            print(f"  - {id_}: {why}")

if __name__ == "__main__":
    main()
