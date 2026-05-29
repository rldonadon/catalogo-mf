import { useState, useEffect, useCallback } from 'react'
import './App.css'
import { db, sincronizarCatalogo, precisaAtualizar, type Produto } from './db'

// ─── Tipos de navegação ──────────────────────────────────────────────────────
type Aba = 'busca' | 'figura' | 'favoritos' | 'orcamento' | 'informativos'
type Tab = 'busca' | 'marca' | 'categoria'

interface ItemOrc { codigo: string; nome: string; quantidade: number }

// ─── URL base das imagens no GitHub ─────────────────────────────────────────
const IMG_BASE = 'https://raw.githubusercontent.com/rldonadon/Catalogo_Imagens_MF/main'

function imgUrl(codigo: string) {
  return `${IMG_BASE}/${codigo}.jpg`
}

// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [abaAtiva, setAbaAtiva] = useState<Aba>('busca')
  const [tabAtiva, setTabAtiva]   = useState<Tab>('busca')
  const [drawerAberto, setDrawer] = useState(false)
  const [sincStatus, setSincStatus] = useState<'idle'|'sync'|'ok'|'erro'>('idle')

  // Produto em detalhe
  const [produtoDetalhe, setProdutoDetalhe] = useState<Produto | null>(null)

  // Orçamento
  const [orcamento, setOrcamento] = useState<ItemOrc[]>(() => {
    try { return JSON.parse(localStorage.getItem('orcamento') || '[]') } catch { return [] }
  })

  // Favoritos
  const [favCodigos, setFavCodigos] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('favoritos') || '[]')) } catch { return new Set() }
  })
  const [favProdutos, setFavProdutos] = useState<Produto[]>([])

  // ── Sincronização inicial ────────────────────────────────────────────────
  useEffect(() => {
    precisaAtualizar().then(precisa => {
      if (precisa) sincronizar()
    })
  }, [])

  async function sincronizar() {
    setSincStatus('sync')
    try {
      await sincronizarCatalogo()
      setSincStatus('ok')
      setTimeout(() => setSincStatus('idle'), 3000)
    } catch {
      setSincStatus('erro')
    }
  }

  // ── Persistência ─────────────────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('orcamento', JSON.stringify(orcamento))
  }, [orcamento])

  useEffect(() => {
    localStorage.setItem('favoritos', JSON.stringify([...favCodigos]))
    if (favCodigos.size > 0) {
      db.produtos.where('codigo').anyOf([...favCodigos]).toArray().then(setFavProdutos)
    } else { setFavProdutos([]) }
  }, [favCodigos])

  // ── Orçamento helpers ─────────────────────────────────────────────────────
  function addOrc(p: Produto) {
    setOrcamento(prev => {
      const idx = prev.findIndex(i => i.codigo === p.codigo)
      if (idx >= 0) {
        const copia = [...prev]; copia[idx].quantidade++; return copia
      }
      return [...prev, { codigo: p.codigo, nome: p.nome, quantidade: 1 }]
    })
  }
  function removeOrc(codigo: string) {
    setOrcamento(prev => prev.filter(i => i.codigo !== codigo))
  }
  function ajustarQty(codigo: string, delta: number) {
    setOrcamento(prev => prev.map(i =>
      i.codigo === codigo ? { ...i, quantidade: Math.max(1, i.quantidade + delta) } : i
    ))
  }

  function toggleFav(p: Produto) {
    setFavCodigos(prev => {
      const s = new Set(prev)
      s.has(p.codigo) ? s.delete(p.codigo) : s.add(p.codigo)
      return s
    })
  }

  // ── Renderização da tela principal ────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* Header */}
      <header className="header">
        <button className="header-menu-btn" onClick={() => setDrawer(true)}>☰</button>
        <div className="header-logo-area">
          <img src="/catalogo-mf/logo.png" alt="MF" className="header-logo-img"
               onError={e => (e.currentTarget.style.display='none')} />
          <div className="header-brand">
            <span className="header-brand-name">MF Sistemas Automotivos</span>
            <span className="header-brand-sub">Divisão Freios a Ar</span>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <div className="page-content">
        {produtoDetalhe ? (
          <DetalheView
            produto={produtoDetalhe}
            favCodigos={favCodigos}
            onVoltar={() => setProdutoDetalhe(null)}
            onToggleFav={toggleFav}
            onAddOrc={addOrc}
          />
        ) : (
          <>
            {abaAtiva === 'busca'       && <BuscaView    tabAtiva={tabAtiva} setTab={setTabAtiva} onProduto={setProdutoDetalhe} sincStatus={sincStatus} onSync={sincronizar} />}
            {abaAtiva === 'figura'      && <FiguraView   onProduto={setProdutoDetalhe} />}
            {abaAtiva === 'favoritos'   && <FavoritosView produtos={favProdutos} favCodigos={favCodigos} onProduto={setProdutoDetalhe} onToggleFav={toggleFav} />}
            {abaAtiva === 'orcamento'   && <OrcamentoView itens={orcamento} onRemove={removeOrc} onAjustar={ajustarQty} onLimpar={() => setOrcamento([])} />}
            {abaAtiva === 'informativos'&& <InformativosView />}
          </>
        )}
      </div>

      {/* Bottom Nav */}
      {!produtoDetalhe && (
        <nav className="bottom-nav">
          {([
            { id: 'busca',        icon: '🔍', label: 'Busca' },
            { id: 'figura',       icon: '🚛', label: 'Por Figura' },
            { id: 'favoritos',    icon: '⭐', label: 'Favoritos' },
            { id: 'orcamento',    icon: '📋', label: 'Orçamento' },
            { id: 'informativos', icon: '📰', label: 'Informativos' },
          ] as const).map(b => (
            <button key={b.id} className={`bottom-btn${abaAtiva===b.id?' active':''}`}
              onClick={() => setAbaAtiva(b.id)}>
              <span className="bottom-icon">{b.icon}</span>
              {b.label}
            </button>
          ))}
        </nav>
      )}

      {/* Drawer */}
      {drawerAberto && (
        <DrawerMenu onClose={() => setDrawer(false)} onSync={sincronizar} />
      )}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TELA: Busca
// ════════════════════════════════════════════════════════════════════════════
function BuscaView({ tabAtiva, setTab, onProduto, sincStatus, onSync }: {
  tabAtiva: Tab
  setTab: (t: Tab) => void
  onProduto: (p: Produto) => void
  sincStatus: string
  onSync: () => void
}) {
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<Produto[]>([])
  const [buscando, setBuscando] = useState(false)
  const [marcas, setMarcas] = useState<string[]>([])
  const [categorias, setCategorias] = useState<string[]>([])
  const [marcaSel, setMarcaSel] = useState('')
  const [catSel, setCatSel] = useState('')

  useEffect(() => {
    db.produtos.orderBy('grupo').uniqueKeys().then(ks => setMarcas(ks as string[]))
    db.produtos.orderBy('subgrupo').uniqueKeys().then(ks => setCategorias(ks as string[]))
  }, [])

  const buscar = useCallback(async () => {
    if (!query.trim()) { setResultados([]); return }
    setBuscando(true)
    const q = query.trim().toLowerCase()
    const res = await db.produtos.filter(p =>
      p.codigo.toLowerCase().includes(q) ||
      p.nome.toLowerCase().includes(q) ||
      p.tags_busca.toLowerCase().includes(q) ||
      p.referencias_busca.toLowerCase().includes(q)
    ).limit(80).toArray()
    setResultados(res)
    setBuscando(false)
  }, [query])

  async function carregarPorMarca(m: string) {
    setMarcaSel(m)
    const res = await db.produtos.where('grupo').equals(m).limit(200).toArray()
    setResultados(res)
  }
  async function carregarPorCategoria(c: string) {
    setCatSel(c)
    const res = await db.produtos.where('subgrupo').equals(c).limit(200).toArray()
    setResultados(res)
  }

  return (
    <>
      {/* Tabs */}
      <div className="tabs">
        {(['busca','marca','categoria'] as const).map(t => (
          <button key={t} className={`tab-btn${tabAtiva===t?' active':''}`} onClick={() => { setTab(t); setResultados([]); setMarcaSel(''); setCatSel('') }}>
            <span className="tab-icon">{t==='busca'?'🔍':t==='marca'?'🏷️':'📁'}</span>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>

      {/* Sync banner */}
      {sincStatus === 'sync' && <div className="sync-banner"><span className="sync-spinner">🔄</span><span className="sync-text">Sincronizando catálogo…</span></div>}
      {sincStatus === 'erro' && <div className="sync-banner erro"><span>⚠️</span><span className="sync-text erro">Sem conexão — usando dados offline</span></div>}
      {sincStatus === 'ok'   && <div className="sync-banner"><span>✅</span><span className="sync-text">Catálogo atualizado!</span></div>}

      {/* Aba Busca */}
      {tabAtiva === 'busca' && (
        <>
          <div className="search-bar">
            <input className="search-input" placeholder="Código, aplicação ou referência…"
              value={query} onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key==='Enter' && buscar()} />
            <button className="btn-buscar" onClick={buscar}>BUSCAR</button>
            <button className="btn-limpar" onClick={() => { setQuery(''); setResultados([]); }}>LIMPAR</button>
          </div>

          {!query && resultados.length === 0 && (
            <>
              <div className="hero-banner">
                <div className="hero-banner-text">
                  <div className="hero-banner-title">Catálogo Digital MF</div>
                  <div className="hero-banner-sub">Freios a Ar — Linha Completa</div>
                </div>
              </div>
              <div className="info-card">
                <div className="info-card-title">Catálogo Digital MF</div>
                <div className="info-card-sub">Digite acima o código, aplicação ou referência cruzada para pesquisar.</div>
              </div>
              <div className="quick-grid">
                <div className="quick-card" onClick={onSync}>
                  <span className="quick-icon">⚡</span>
                  <div><div className="quick-label">Sincronização</div><div className="quick-sub">Banco offline sempre atualizado.</div></div>
                </div>
                <div className="quick-card">
                  <span className="quick-icon">🔧</span>
                  <div><div className="quick-label">Reparos</div><div className="quick-sub">Linha completa de freios a ar.</div></div>
                </div>
              </div>
            </>
          )}

          {buscando && <div className="estado-vazio"><div className="estado-vazio-icon">🔍</div><div className="loading-text">Buscando…</div></div>}
          {!buscando && resultados.length > 0 && <ListaResultados produtos={resultados} onProduto={onProduto} />}
          {!buscando && query && resultados.length === 0 && (
            <div className="estado-vazio">
              <div className="estado-vazio-icon">😕</div>
              <div className="estado-vazio-titulo">Nenhum resultado</div>
              <div className="estado-vazio-sub">Tente outro código ou descrição.</div>
            </div>
          )}
        </>
      )}

      {/* Aba Marca */}
      {tabAtiva === 'marca' && !marcaSel && (
        <div className="lista-group">
          {marcas.filter(Boolean).map(m => (
            <div key={m} className="lista-item" onClick={() => carregarPorMarca(m)}>
              {m}<span className="lista-chevron">›</span>
            </div>
          ))}
        </div>
      )}
      {tabAtiva === 'marca' && marcaSel && (
        <>
          <div className="search-bar" style={{paddingBottom:4}}>
            <button className="btn-limpar" onClick={() => { setMarcaSel(''); setResultados([]); }}>← Voltar</button>
            <span style={{alignSelf:'center',fontWeight:700,color:'var(--azul)',flex:1}}>{marcaSel}</span>
          </div>
          <ListaResultados produtos={resultados} onProduto={onProduto} />
        </>
      )}

      {/* Aba Categoria */}
      {tabAtiva === 'categoria' && !catSel && (
        <div className="lista-group">
          {categorias.filter(Boolean).map(c => (
            <div key={c} className="lista-item" onClick={() => carregarPorCategoria(c)}>
              {c}<span className="lista-chevron">›</span>
            </div>
          ))}
        </div>
      )}
      {tabAtiva === 'categoria' && catSel && (
        <>
          <div className="search-bar" style={{paddingBottom:4}}>
            <button className="btn-limpar" onClick={() => { setCatSel(''); setResultados([]); }}>← Voltar</button>
            <span style={{alignSelf:'center',fontWeight:700,color:'var(--azul)',flex:1}}>{catSel}</span>
          </div>
          <ListaResultados produtos={resultados} onProduto={onProduto} />
        </>
      )}
    </>
  )
}

// ── Lista de resultados ───────────────────────────────────────────────────────
function ListaResultados({ produtos, onProduto }: { produtos: Produto[], onProduto: (p: Produto) => void }) {
  return (
    <div className="resultado-lista">
      {produtos.map(p => (
        <div key={p.codigo} className="resultado-card" onClick={() => onProduto(p)}>
          <img className="resultado-img" src={imgUrl(p.codigo)} alt={p.nome}
            onError={e => { e.currentTarget.style.display='none' }} />
          <div className="resultado-info">
            <div className="resultado-codigo">{p.codigo}</div>
            <div className="resultado-nome">{p.nome}</div>
            <div className="resultado-grupo">{p.grupo}</div>
          </div>
          <span className="resultado-chevron">›</span>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TELA: Por Figura
// ════════════════════════════════════════════════════════════════════════════
const FIGURAS = [
  { label: 'Freios Dianteiros', sub: 'Pedal, manetim, reguladores, secador, compressores …', icon: '🚛', grupos: ['PEDAL','MANETIM','REGULADOR','SECADOR','COMPRESSOR'] },
  { label: 'Freios Traseiros',  sub: 'Descarga, distribuidora, cuícas, diafragmas, relés e ni…', icon: '🚛', grupos: ['DESCARGA','CUICA','DIAFRAGMA','RELE','DISTRIBUIDOR'] },
  { label: 'Semi-reboque / Carreta', sub: 'Carretas, conexões e válvulas de acoplamento', icon: '🔗', grupos: ['CARRETA','CONEXAO','VOSS'] },
]

function FiguraView({ onProduto }: { onProduto: (p: Produto) => void }) {
  const [subCat, setSubCat] = useState<typeof FIGURAS[0] | null>(null)
  const [produtos, setProdutos] = useState<Produto[]>([])

  async function abrirCategoria(fig: typeof FIGURAS[0]) {
    setSubCat(fig)
    const res = await db.produtos.filter(p =>
      fig.grupos.some(g => p.grupo.toUpperCase().includes(g) || p.subgrupo.toUpperCase().includes(g))
    ).limit(200).toArray()
    setProdutos(res)
  }

  if (subCat) return (
    <>
      <div className="search-bar" style={{paddingBottom:4}}>
        <button className="btn-limpar" onClick={() => { setSubCat(null); setProdutos([]); }}>← Voltar</button>
        <span style={{alignSelf:'center',fontWeight:700,color:'var(--azul)',flex:1}}>{subCat.label}</span>
      </div>
      <ListaResultados produtos={produtos} onProduto={onProduto} />
    </>
  )

  return (
    <>
      <div style={{padding:'12px 14px 4px',fontWeight:800,fontSize:16,color:'var(--texto)'}}>Pesquisa por Diagrama</div>
      <div style={{padding:'0 14px 10px',color:'var(--texto-sec)',fontSize:12}}>Selecione o sistema do veículo</div>
      <div className="figura-diagrama">
        <div style={{padding:20,textAlign:'center',color:'var(--texto-sec)',fontSize:13}}>
          📐 Diagrama Pneumático<br/>
          <span style={{fontSize:11}}>Esquema do sistema de freios</span>
        </div>
        <div className="figura-diagrama-link">🔍 Tocar para ampliar esquema pneumático</div>
      </div>
      <div className="lista-group">
        {FIGURAS.map(f => (
          <div key={f.label} className="lista-item" onClick={() => abrirCategoria(f)}>
            <span>{f.icon} {f.label}</span>
            <span className="lista-chevron">›</span>
          </div>
        ))}
      </div>
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TELA: Detalhe do Produto
// ════════════════════════════════════════════════════════════════════════════
function DetalheView({ produto, favCodigos, onVoltar, onToggleFav, onAddOrc }: {
  produto: Produto; favCodigos: Set<string>
  onVoltar: () => void; onToggleFav: (p: Produto) => void; onAddOrc: (p: Produto) => void
}) {
  const isFav = favCodigos.has(produto.codigo)
  const refs = produto.referencia?.split('/').map(r => r.trim()).filter(Boolean) || []

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflowY:'auto'}}>
      <div className="detalhe-header">
        <button className="detalhe-back" onClick={onVoltar}>←</button>
        <div className="detalhe-header-info">
          <div className="detalhe-codigo">{produto.codigo}</div>
          <div className="detalhe-nome">{produto.nome}</div>
        </div>
      </div>

      <div className="detalhe-img-area">
        <img className="detalhe-img" src={imgUrl(produto.codigo)} alt={produto.nome}
          onError={e => { e.currentTarget.style.display='none'; (e.currentTarget.nextSibling as HTMLElement)?.removeAttribute('style') }} />
        <div className="detalhe-img-ph" style={{display:'none'}}>📦</div>
      </div>

      {produto.descricao && (
        <div className="detalhe-section">
          <div className="detalhe-section-title">Descrição</div>
          <div className="detalhe-section-text">{produto.descricao}</div>
        </div>
      )}

      {produto.aplicacao && (
        <div className="detalhe-section">
          <div className="detalhe-section-title">Aplicação</div>
          <div className="detalhe-section-text" style={{whiteSpace:'pre-line'}}>{produto.aplicacao}</div>
        </div>
      )}

      {refs.length > 0 && (
        <div className="detalhe-section">
          <div className="detalhe-section-title">Referências de Fabricantes</div>
          <div className="detalhe-refs-grid">
            {refs.map((r, i) => (
              <div key={i} className="detalhe-ref-chip">
                <div className="detalhe-ref-marca">Referência</div>
                <div className="detalhe-ref-cod">{r}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="detalhe-actions">
        <button className={`btn-fav${isFav?' ativo':''}`} onClick={() => onToggleFav(produto)}>
          {isFav ? '★ Favorito' : '☆ Favoritar'}
        </button>
        <button className="btn-orc" onClick={() => onAddOrc(produto)}>
          📋 Add Orçamento
        </button>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TELA: Favoritos
// ════════════════════════════════════════════════════════════════════════════
function FavoritosView({ produtos, favCodigos, onProduto, onToggleFav }: {
  produtos: Produto[]; favCodigos: Set<string>
  onProduto: (p: Produto) => void; onToggleFav: (p: Produto) => void
}) {
  if (produtos.length === 0) return (
    <div className="fav-empty">
      <div className="fav-empty-icon">⭐</div>
      <div className="estado-vazio-titulo">Nenhum favorito ainda</div>
      <div className="estado-vazio-sub">Toque em ☆ no detalhe de um produto para salvar aqui.</div>
    </div>
  )
  return <ListaResultados produtos={produtos} onProduto={onProduto} />
}

// ════════════════════════════════════════════════════════════════════════════
// TELA: Orçamento
// ════════════════════════════════════════════════════════════════════════════
function OrcamentoView({ itens, onRemove, onAjustar, onLimpar }: {
  itens: ItemOrc[]; onRemove: (c: string) => void
  onAjustar: (c: string, d: number) => void; onLimpar: () => void
}) {
  const total = itens.reduce((s, i) => s + i.quantidade, 0)

  if (itens.length === 0) return (
    <div className="orc-empty">
      <div className="orc-empty-icon">📋</div>
      <div className="estado-vazio-titulo">Orçamento vazio</div>
      <div className="estado-vazio-sub">Adicione produtos pelo botão "Add Orçamento" no detalhe.</div>
    </div>
  )

  return (
    <>
      <div className="orc-total-bar">
        <div><div className="orc-total-label">Total de itens</div><div className="orc-total-value">{total} peças</div></div>
        <button className="btn-limpar-orc" onClick={onLimpar}>Limpar</button>
      </div>
      {itens.map(it => (
        <div key={it.codigo} className="orc-item">
          <div className="orc-item-info">
            <div className="orc-item-codigo">{it.codigo}</div>
            <div className="orc-item-nome">{it.nome}</div>
          </div>
          <div className="orc-qty-ctrl">
            <button className="orc-qty-btn" onClick={() => onAjustar(it.codigo, -1)}>−</button>
            <span className="orc-qty">{it.quantidade}</span>
            <button className="orc-qty-btn" onClick={() => onAjustar(it.codigo, +1)}>+</button>
            <button className="orc-qty-btn" style={{color:'#c00'}} onClick={() => onRemove(it.codigo)}>🗑</button>
          </div>
        </div>
      ))}
    </>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// TELA: Informativos
// ════════════════════════════════════════════════════════════════════════════
const INF_URL = 'https://raw.githubusercontent.com/rldonadon/Catalogo_Imagens_MF/main/informativos/index.json'

function InformativosView() {
  const [lista, setLista] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(INF_URL).then(r => r.json()).then(setLista).catch(() => setLista([])).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="estado-vazio"><div className="estado-vazio-icon">📰</div><div className="loading-text">Carregando…</div></div>
  if (lista.length === 0) return (
    <div className="estado-vazio">
      <div className="estado-vazio-icon">📰</div>
      <div className="estado-vazio-titulo">Nenhum informativo</div>
      <div className="estado-vazio-sub">Os informativos publicados aparecerão aqui.</div>
    </div>
  )

  return (
    <div className="inf-lista">
      {lista.map((inf: any) => (
        <div key={inf.numero} className="inf-card"
          onClick={() => window.open(`https://raw.githubusercontent.com/rldonadon/Catalogo_Imagens_MF/main/informativos/${inf.arquivo}`, '_blank')}>
          <span className={`inf-badge ${inf.tipo?.toLowerCase() || 'tecnico'}`}>{inf.tipo || 'TÉCNICO'}</span>
          <div className="inf-info">
            <div className="inf-numero">Informativo Nº {inf.numero} — {inf.data}</div>
            <div className="inf-titulo">{inf.titulo}</div>
          </div>
          <span style={{color:'var(--texto-sec)'}}>›</span>
        </div>
      ))}
    </div>
  )
}

// ════════════════════════════════════════════════════════════════════════════
// DRAWER MENU
// ════════════════════════════════════════════════════════════════════════════
function DrawerMenu({ onClose, onSync }: { onClose: () => void; onSync: () => void }) {
  const ITEMS = [
    { icon: '🔍', label: 'Linha de Produtos' },
    { icon: '📋', label: 'Meus Orçamentos' },
    { icon: '🚀', label: 'Lançamentos' },
    { icon: '📰', label: 'Informativos' },
    { icon: '💬', label: 'Mensagens' },
    { icon: '👤', label: 'Meu Cadastro' },
    { icon: '📞', label: 'Contato' },
    { icon: '🏢', label: 'Sobre a MF Freios' },
    { icon: '🔄', label: 'Verificar Atualizações', action: () => { onSync(); onClose(); } },
    { icon: '📤', label: 'Compartilhar o App' },
    { icon: '🔒', label: 'Política de Privacidade' },
    { icon: '📱', label: 'Sobre o Catálogo' },
    { icon: '✏️', label: 'Ajustar Fonte' },
    { icon: '🌐', label: 'Alterar Idioma' },
  ]

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer">
        <div className="drawer-header">
          <img src="/catalogo-mf/logo.png" className="drawer-logo" alt="MF"
            onError={e => (e.currentTarget.style.display='none')} />
          <div className="drawer-brand">
            <div className="drawer-brand-name">Catálogo Digital MF</div>
            <div className="drawer-brand-sub">MF Sistemas Automotivos</div>
          </div>
        </div>
        {ITEMS.map(it => (
          <div key={it.label} className="drawer-item" onClick={it.action ?? onClose}>
            <span className="drawer-item-icon">{it.icon}</span>
            {it.label}
          </div>
        ))}
        <div className="drawer-footer">MF Freios © 2026 — Versão PWA 1.0</div>
      </div>
    </>
  )
}
