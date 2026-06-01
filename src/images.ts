// Serviço de carregamento de imagens com autenticação GitHub
import { GITHUB_IMG_TOKEN, IMG_BASE, IMG_INDEX_URL } from './config'

// Cache de blob URLs em memória (evita refetch)
const blobCache = new Map<string, string>()

// Índice de imagens {codigo: {reparo?, valvula?}}
let imagensIndex: Record<string, { reparo?: string; valvula?: string }> | null = null
let indexLoading: Promise<Record<string, { reparo?: string; valvula?: string }>> | null = null

const AUTH_HEADERS = {
  Authorization: `token ${GITHUB_IMG_TOKEN}`,
  'User-Agent': 'CatalogoMF-PWA',
}

export async function carregarIndice(): Promise<Record<string, { reparo?: string; valvula?: string }>> {
  if (imagensIndex) return imagensIndex
  if (indexLoading) return indexLoading

  indexLoading = fetch(IMG_INDEX_URL, { headers: AUTH_HEADERS })
    .then(r => {
      if (!r.ok) throw new Error(`Índice não encontrado: ${r.status}`)
      return r.json()
    })
    .then(data => {
      imagensIndex = data
      return data as Record<string, { reparo?: string; valvula?: string }>
    })
    .catch(() => {
      imagensIndex = {}
      return {} as Record<string, { reparo?: string; valvula?: string }>
    })
    .finally(() => { indexLoading = null })

  return indexLoading
}

export interface ImagensProduto {
  reparo?: string
  valvula?: string
}

// Busca URLs das imagens do produto (usando índice)
export async function buscarImagensProduto(codigo: string): Promise<ImagensProduto> {
  if (!codigo) return {}
  const index = await carregarIndice()
  const reg = index[codigo]
  if (!reg) return {}

  const result: ImagensProduto = {}
  if (reg.reparo) result.reparo = `${IMG_BASE}/pasta_reparos/${reg.reparo}`
  if (reg.valvula) result.valvula = `${IMG_BASE}/pasta_valvulas/${reg.valvula}`
  return result
}

// Carrega uma imagem privada via fetch com token e retorna blob URL
export async function carregarImagemPrivada(url: string): Promise<string> {
  if (!url) return ''
  if (blobCache.has(url)) return blobCache.get(url)!

  try {
    const resp = await fetch(url, { headers: AUTH_HEADERS })
    if (!resp.ok) return ''
    const blob = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    blobCache.set(url, blobUrl)
    return blobUrl
  } catch {
    return ''
  }
}

// URL da figura de diagrama por grupo
export async function buscarImagemFigura(grupo: string): Promise<string> {
  if (!grupo) return ''
  const { MAPA_FIGURAS } = await import('./config')
  const grupoLower = grupo.toLowerCase().trim()
  const nome = MAPA_FIGURAS[grupoLower] ?? `img_${grupoLower.replace(/[^a-z0-9]/g, '_')}`
  const exts = ['.png', '.jpg', '.PNG', '.JPG']
  for (const ext of exts) {
    const url = `${IMG_BASE}/pasta_figuras/${nome}${ext}`
    try {
      const r = await fetch(url, { method: 'HEAD', headers: AUTH_HEADERS })
      if (r.ok) return url
    } catch { /* ignora */ }
  }
  return ''
}
