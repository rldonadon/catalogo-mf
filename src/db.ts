// Banco local IndexedDB via Dexie — substitui SQLite do app Android
import Dexie, { type Table } from 'dexie'

export interface Produto {
  codigo: string
  nome: string
  descricao: string
  referencia: string
  aplicacao: string
  grupo: string
  subgrupo: string
  referencias_busca: string
  tags_busca: string
  data_lancamento: string
  imagem_url?: string
}

export interface Meta {
  chave: string
  valor: string
}

export interface Favorito {
  codigo: string
  nome: string
  grupo: string
  imagem_url?: string
  adicionado_em: string
}

export interface ItemOrcamento {
  id?: number
  codigo: string
  nome: string
  quantidade: number
  imagem_url?: string
}

class CatalogoDB extends Dexie {
  produtos!: Table<Produto>
  meta!: Table<Meta>
  favoritos!: Table<Favorito>
  orcamento!: Table<ItemOrcamento>

  constructor() {
    super('CatalogoDB')
    this.version(1).stores({
      produtos: 'codigo, nome, grupo, subgrupo, tags_busca',
      meta: 'chave',
      favoritos: 'codigo',
      orcamento: '++id, codigo',
    })
  }
}

export const db = new CatalogoDB()

// ─── URL do catalogo.json no GitHub Pages ───────────────────────────────────
const CATALOGO_URL =
  'https://raw.githubusercontent.com/rldonadon/catalogo-mf/main/public/catalogo.json'

export async function sincronizarCatalogo(): Promise<{ total: number; versao: string }> {
  const resp = await fetch(CATALOGO_URL, { cache: 'no-cache' })
  if (!resp.ok) throw new Error(`Falha ao buscar catálogo: ${resp.status}`)

  const data = await resp.json()
  const { meta = [], produtos = [] } = data

  await db.transaction('rw', db.produtos, db.meta, async () => {
    await db.produtos.clear()
    await db.meta.clear()
    await db.produtos.bulkAdd(produtos)
    for (const m of meta) await db.meta.put(m)
  })

  const versao = meta.find((m: Meta) => m.chave === 'versao')?.valor ?? '1.0'
  return { total: produtos.length, versao }
}

export async function precisaAtualizar(): Promise<boolean> {
  const count = await db.produtos.count()
  return count === 0
}
