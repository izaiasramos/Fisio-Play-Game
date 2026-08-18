/// <reference types="node" />
/**
 * Gera as "planilhas de trabalho" de revisão, uma por trilha, juntando os itens
 * (termo+definição) e os casos clínicos, já com os campos de revisão vazios que o
 * Agente Revisor Clínico vai preencher (ver revisao/AGENTE-REVISOR-CLINICO.md e
 * revisao/ESQUEMA-REVISAO.md).
 *
 * Saída: revisao/worksheets/<trilha>.json
 * Rodar:  npx tsx scripts/preparar-revisao.ts
 *
 * Determinístico e leve (só leitura dos JSON + escrita) — não faz rede.
 */
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { carregarTrilha, listarTrilhasIds } from "../src/lib/loadTrilha";
import { carregarCasos, temCasos } from "../src/lib/loadCasos";

type Ref = { titulo: string; url: string; tipo: string };
type Alt = { conduta: string; nivelEvidencia: string; indicadoQuando: string; fonte: string };

type ItemRevisado = {
  id: string;
  tipo: "item" | "caso";
  termo: string;
  // contexto para o revisor (não é preenchido por ele)
  _conteudo: Record<string, unknown>;
  // campos que o revisor preenche
  veredito: "" | "correto" | "impreciso" | "incorreto";
  nivelEvidencia: "" | "comprovado" | "convencional" | "nao_convencional_aceito" | "controverso" | "insuficiente";
  confianca: "" | "alta" | "media" | "baixa";
  oQueEstaCerto: string;
  oQueMelhorar: string;
  oQueEstaErrado: string;
  sugestaoCorrecao: string;
  referencias: Ref[];
  fonteDoItemConfere: boolean | null;
  condutasAlternativas: Alt[];
  precisaEspecialistaHumano: boolean | null;
  notas: string;
  revisorHumano: null;
  aprovadoParaPublicar: false;
};

function itemVazio(id: string, tipo: "item" | "caso", termo: string, conteudo: Record<string, unknown>): ItemRevisado {
  return {
    id,
    tipo,
    termo,
    _conteudo: conteudo,
    veredito: "",
    nivelEvidencia: "",
    confianca: "",
    oQueEstaCerto: "",
    oQueMelhorar: "",
    oQueEstaErrado: "",
    sugestaoCorrecao: "",
    referencias: [],
    fonteDoItemConfere: null,
    condutasAlternativas: [],
    precisaEspecialistaHumano: null,
    notas: "",
    revisorHumano: null,
    aprovadoParaPublicar: false,
  };
}

function main() {
  const outDir = join("revisao", "worksheets");
  mkdirSync(outDir, { recursive: true });

  let totalItens = 0;
  let totalCasos = 0;

  for (const id of listarTrilhasIds()) {
    const banco = carregarTrilha(id);
    const revisados: ItemRevisado[] = [];

    for (const it of banco.itens) {
      revisados.push(
        itemVazio(it.id, "item", it.termo, {
          definicao: it.definicao,
          fonte: it.fonte,
          urlFonte: it.urlFonte,
          imagem: it.imagem ?? null,
        })
      );
      totalItens++;
    }

    if (temCasos(id)) {
      for (const c of carregarCasos(id)) {
        const ehMulti = Array.isArray(c.condutas) && c.condutas.length > 0;
        const opcoes = ehMulti
          ? [...(c.condutas ?? []).map((cv) => cv.conduta), ...(c.distratores ?? [])]
          : c.opcoes ?? [];
        const respostaCorreta = ehMulti
          ? (c.condutas ?? []).map((cv) => cv.conduta)
          : c.opcoes && typeof c.correta === "number"
            ? c.opcoes[c.correta]
            : null;
        revisados.push(
          itemVazio(c.id, "caso", c.caso.slice(0, 60) + "…", {
            caso: c.caso,
            multiConduta: ehMulti,
            opcoes,
            respostaCorreta,
            condutasAlternativas: ehMulti ? c.condutas : undefined,
            explicacao: c.explicacao,
            fonte: c.fonte,
            urlFonte: c.urlFonte,
          })
        );
        totalCasos++;
      }
    }

    const worksheet = {
      trilha: id,
      nome: banco.trilha.nome,
      geradoEm: new Date().toISOString().slice(0, 10),
      instrucoes: "Preencha cada objeto conforme revisao/ESQUEMA-REVISAO.md. Não invente referências.",
      itens: revisados,
    };

    const dest = join(outDir, `${id}.json`);
    writeFileSync(dest, JSON.stringify(worksheet, null, 2) + "\n", "utf-8");
    console.log(`✓ ${dest} — ${revisados.length} entradas (itens + casos)`);
  }

  console.log(`\nTotal: ${totalItens} itens + ${totalCasos} casos para revisar.`);
}

main();
