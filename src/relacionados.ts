// Relações entre produtos: kit completo, kit parcial, cruzados (mesma referência
// em outro fabricante/família) e componentes. Derivadas dos campos
// `referencias_busca` (separados por "|") e do nome — sem depender de tabela nova.

export interface ProdRel {
  codigo: string;
  nome: string;
  descricao: string;
  referencia: string;
  aplicacao: string;
  grupo: string;
  subgrupo?: string;
  referencias_busca: string;
  data_lancamento?: string;
  ncm?: string;
  ipi?: string;
  st?: string;
}

export type RelTipo = "COMPLETO" | "PARCIAL" | "CRUZADO" | "COMPONENTE";

export interface RelItem {
  produto: ProdRel;
  tipo: RelTipo;
  via: string; // referência em comum que justifica a relação
}

export const REL_TITULOS: Record<RelTipo, string> = {
  COMPLETO: "Kit de reparo completo",
  PARCIAL: "Kit de reparo parcial",
  CRUZADO: "Relacionados",
  COMPONENTE: "Peças do mesmo conjunto",
};

const ORDEM: RelTipo[] = ["COMPLETO", "PARCIAL", "CRUZADO", "COMPONENTE"];

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

function tokens(p: ProdRel): string[] {
  const own = norm(p.codigo);
  const out = new Set<string>();
  for (const raw of (p.referencias_busca || "").split("|")) {
    const t = norm(raw);
    // ignora tokens sem número (ex.: "KNORR") e curtos demais
    if (t.length < 4 || !/\d/.test(t) || t === own) continue;
    out.add(t);
  }
  return [...out];
}

// QA1062MP / QA1062P / QA1062M -> QA1062 (família do código cruzado)
const familia = (t: string) => {
  const m = /^(QA\d+)[A-Z]*$/.exec(t);
  return m ? m[1] : null;
};

const ehKit = (p: ProdRel) => /(^|\s)JG(\s|$)|\bREPARO\b|\bREP\b/.test((p.nome || "").toUpperCase());
const ehParcial = (p: ProdRel) => /PARCIAL/.test((p.nome || "").toUpperCase());

// Ligação curada no ERP (aba "relacoes" da planilha mestre, tabela `relacoes` do catalogo.db).
// `tipo` vem como COMPLETO | PARCIAL | SIMILAR; SIMILAR é exibido como CRUZADO.
export interface RelacaoTabela {
  codigo_origem: string;
  codigo_relacionado: string;
  tipo: string;
}

// Na tabela, `tipo` descreve o kit da PRÓPRIA linha (codigo_origem), não o relacionado.
// Para rotular o relacionado usa o tipo declarado na linha dele; sem ela, o oposto.
function tipoDoRelacionado(r: RelacaoTabela, relacoes: RelacaoTabela[]): RelTipo {
  if (r.tipo !== "COMPLETO" && r.tipo !== "PARCIAL") return "CRUZADO";
  const proprio = relacoes.find(x =>
    x.codigo_origem === r.codigo_relacionado && (x.tipo === "COMPLETO" || x.tipo === "PARCIAL"));
  if (proprio) return proprio.tipo as RelTipo;
  return r.tipo === "COMPLETO" ? "PARCIAL" : "COMPLETO";
}

export function calcularRelacionadosTabela(
  sel: ProdRel, todos: ProdRel[], relacoes: RelacaoTabela[], limite = 16
): RelItem[] {
  const porCodigo = new Map(todos.map(p => [p.codigo, p]));
  const resultado: RelItem[] = [];
  for (const r of relacoes) {
    if (r.codigo_origem !== sel.codigo) continue;
    const produto = porCodigo.get(r.codigo_relacionado);
    if (!produto) continue;
    resultado.push({ produto, tipo: tipoDoRelacionado(r, relacoes), via: "cadastrado no ERP" });
  }
  resultado.sort((a, b) =>
    ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo) || a.produto.codigo.localeCompare(b.produto.codigo));
  return resultado.slice(0, limite);
}

// Regra única para os apps: kit completo/parcial vem somente da tabela curada no ERP.
// Os demais itens com referência em comum aparecem como relacionados (ou peças do conjunto).
// Sem nenhuma relação cadastrada, mantém a regra antiga por referência.
export function relacionadosDoCatalogo(
  sel: ProdRel, todos: ProdRel[], relacoes: RelacaoTabela[], limite = 16
): RelItem[] {
  if (relacoes.length === 0) return calcularRelacionados(sel, todos, limite);
  const daTabela = calcularRelacionadosTabela(sel, todos, relacoes, limite);
  const jaListados = new Set(daTabela.map(x => x.produto.codigo));
  const outros = calcularRelacionados(sel, todos, todos.length)
    .filter(x => !jaListados.has(x.produto.codigo))
    .map((x): RelItem => (x.tipo === "COMPONENTE" ? x : { ...x, tipo: "CRUZADO" }))
    .sort((a, b) =>
      ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo) || a.produto.codigo.localeCompare(b.produto.codigo));
  return [...daTabela, ...outros].slice(0, limite);
}

export function calcularRelacionados(sel: ProdRel, todos: ProdRel[], limite = 16): RelItem[] {
  const tSel = tokens(sel);
  if (tSel.length === 0) return [];
  const setSel = new Set(tSel);
  const famSel = new Set(tSel.map(familia).filter((f): f is string => !!f));
  const resultado: RelItem[] = [];

  for (const c of todos) {
    if (c.codigo === sel.codigo) continue;
    const tc = tokens(c);
    let via = tc.find(t => setSel.has(t));
    let familiaApenas = false;
    if (!via) {
      via = tc.find(t => { const f = familia(t); return !!f && famSel.has(f); });
      familiaApenas = !!via;
    }
    if (!via) continue;

    let tipo: RelTipo;
    if (ehKit(c)) {
      if (ehParcial(c)) tipo = "PARCIAL";
      else tipo = "COMPLETO";
    } else {
      tipo = "COMPONENTE";
    }
    // Mesmo conjunto mas fabricante/linha diferente, ou só família de código => cruzado
    const outraLinha = (c.subgrupo || "") !== (sel.subgrupo || "");
    if (familiaApenas && ehKit(c) && outraLinha) tipo = "CRUZADO";
    else if (!ehKit(c) && outraLinha) tipo = "CRUZADO";

    resultado.push({ produto: c, tipo, via: via! });
  }

  resultado.sort((a, b) =>
    ORDEM.indexOf(a.tipo) - ORDEM.indexOf(b.tipo) || a.produto.codigo.localeCompare(b.produto.codigo));
  return resultado.slice(0, limite);
}
