import Dexie, { type Table } from 'dexie'
import { CATALOGO_JSON_URL } from './config'

export interface Produto {
  codigo: string; nome: string; descricao: string; referencia: string
  aplicacao: string; grupo: string; subgrupo: string
  referencias_busca: string; tags_busca: string; data_lancamento: string
}
export interface Meta { chave: string; valor: string }
export interface Favorito { codigo: string; adicionado_em: string }
export interface ItemOrcamento { id?: number; codigo: string; nome: string; quantidade: number }
export interface Cadastro {
  idioma: string; tipoPessoa: string; cnpjCpf: string; nome: string
  telefone: string; estado: string; cidade: string; email: string; data_cadastro: string
  token_verificacao?: string; timestamp_aceite?: string; ip_registrado?: string
  codigoCadastro?: string
}
export interface Informativo {
  id: number;
  numero: number;
  titulo: string;
  tipo: string;
  data: string;
  arquivo: string;
  destaque: number;
  imagem: string | null;
}

class CatalogoDB extends Dexie {
  produtos!: Table<Produto>; meta!: Table<Meta>
  favoritos!: Table<Favorito>; orcamento!: Table<ItemOrcamento>
  cadastro!: Table<Cadastro & { id?: number }>
  informativos!: Table<Informativo>

  constructor() {
    super('CatalogoDB')
    this.version(3).stores({
      produtos: 'codigo, nome, grupo, subgrupo, data_lancamento',
      meta: 'chave',
      favoritos: 'codigo',
      orcamento: '++id, codigo',
      cadastro: '++id',
      informativos: 'id, numero, destaque',
    })
  }
}

export const db = new CatalogoDB()

// ── Cadastro ─────────────────────────────────────────────────────────────────
export async function isCadastrado(): Promise<boolean> {
  return (await db.cadastro.count()) > 0
}
export async function getCadastro(): Promise<(Cadastro & { id?: number }) | null> {
  const all = await db.cadastro.toArray()
  return all[0] ?? null
}
export async function salvarCadastro(dados: Cadastro): Promise<void> {
  await db.cadastro.clear()
  await db.cadastro.add(dados)
}
export async function resetarCadastro(): Promise<void> {
  await db.cadastro.clear()
}

// ── Sincronização com o JSON publicado ───────────────────────────────────────
export async function sincronizarCatalogo(
  onProgress?: (pct: number, msg: string) => void
): Promise<{ total: number; versao: string }> {
  onProgress?.(10, 'Verificando versão…')
  const resp = await fetch(`${CATALOGO_JSON_URL}?t=${Date.now()}`, { cache: 'no-cache' })
  if (!resp.ok) throw new Error(`Falha HTTP ${resp.status}`)

  onProgress?.(50, 'Baixando catálogo…')
  const data = await resp.json()
  const { meta = [], produtos = [], informativos = [] } = data

  onProgress?.(80, 'Salvando offline…')
  await db.transaction('rw', db.produtos, db.meta, db.informativos, async () => {
    await db.produtos.clear()
    await db.meta.clear()
    await db.informativos.clear()
    await db.produtos.bulkAdd(produtos)
    await db.informativos.bulkAdd(informativos)
    for (const m of meta) await db.meta.put(m)
  })

  onProgress?.(100, 'Pronto!')
  const versao = (meta as Meta[]).find(m => m.chave === 'versao')?.valor ?? '1.0'
  return { total: produtos.length, versao }
}

export async function precisaAtualizar(): Promise<boolean> {
  const count = await db.produtos.count()
  if (count === 0) return true

  try {
    const resp = await fetch(`${CATALOGO_JSON_URL}?t=${Date.now()}`, { cache: 'no-cache' })
    if (!resp.ok) return false
    const data = await resp.json()
    const versaoRemota = data.meta?.find((m: any) => m.chave === 'versao')?.valor
    const localMeta = await db.meta.get('versao')
    const versaoLocal = localMeta?.valor
    
    return !!versaoRemota && versaoRemota !== versaoLocal
  } catch (e) {
    console.warn("Erro ao verificar atualizações automáticas:", e)
    return false
  }
}

// ── Busca de produtos ─────────────────────────────────────────────────────────
export async function buscarProdutos(termo: string): Promise<Produto[]> {
  if (!termo.trim()) return []
  const q = normalizar(termo)
  const tokens = q.split(' ').filter(t => t.length > 1)
  if (!tokens.length) return []

  return db.produtos.filter(p => {
    const campos = normalizar(
      `${p.codigo} ${p.nome} ${p.descricao} ${p.referencias_busca} ${p.tags_busca} ${p.aplicacao}`
    )
    return tokens.every(tk => campos.includes(tk))
  }).limit(60).toArray()
}

function normalizar(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}
