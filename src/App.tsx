import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'
import { db, buscarProdutos, sincronizarCatalogo, precisaAtualizar,
         isCadastrado, getCadastro, salvarCadastro, resetarCadastro, type Produto, type Informativo } from './db'
import { jsPDF } from 'jspdf'
import { carregarImagemPrivada, buscarImagensProduto, buscarImagemFigura } from './images'
import { t, getIdioma, setIdioma, type Idioma } from './i18n'
import { WHATSAPP_NUMS, TELEFONES, EMAILS_CONTATO, ENDERECO, SISTEMAS_FIGURA, WEBHOOK_URL, IMG_BASE } from './config'

const BASE_LOGO = `${import.meta.env.BASE_URL}logo.png`
const BASE_BANNER = `${import.meta.env.BASE_URL}caminhao_banner.png`

// ═══════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════
type Tela = 'busca' | 'figura' | 'favoritos' | 'orcamento' | 'info' |
            'produto' | 'cadastro' | 'contato' | 'sobre' | 'lancamentos' |
            'mensagens' | 'politica' | 'idioma'
type AbaHome = 'busca' | 'marca' | 'grupo'

// ═══════════════════════════════════════════════════════════
//  HOOK: Imagem autenticada
// ═══════════════════════════════════════════════════════════
function useImagem(url: string | undefined) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    if (!url) { setSrc(''); return }
    let alive = true
    carregarImagemPrivada(url).then(b => { if (alive) setSrc(b) })
    return () => { alive = false }
  }, [url])
  return src
}

// ═══════════════════════════════════════════════════════════
//  COMPONENTE: ImagemProduto
// ═══════════════════════════════════════════════════════════
function ImagemProduto({ codigo, size = 64 }: { codigo: string; size?: number }) {
  const [urls, setUrls] = useState<{ reparo?: string; valvula?: string }>({})
  const primary = useImagem(urls.reparo ?? urls.valvula)

  useEffect(() => {
    let alive = true
    buscarImagensProduto(codigo).then(u => { if (alive) setUrls(u) })
    return () => { alive = false }
  }, [codigo])

  if (!primary) return (
    <div className="img-placeholder" style={{ width: size, height: size }}>
      <span>🔧</span>
    </div>
  )
  return (
    <img src={primary} alt={codigo} width={size} height={size}
         style={{ objectFit: 'contain', borderRadius: 6 }} />
  )
}

// ═══════════════════════════════════════════════════════════
//  COMPONENTE: ProdutoCard
// ═══════════════════════════════════════════════════════════
function ProdutoCard({ p, onClick }: { p: Produto; onClick: () => void }) {
  return (
    <div className="produto-card" onClick={onClick} role="button" tabIndex={0}
         onKeyDown={e => e.key === 'Enter' && onClick()}>
      <ImagemProduto codigo={p.codigo} size={60} />
      <div className="produto-card-info">
        <span className="badge-cyan">{p.codigo}</span>
        <span className="produto-nome">{p.nome}</span>
        <span className="produto-grupo">{p.grupo} {p.subgrupo ? `· ${p.subgrupo}` : ''}</span>
      </div>
      <span className="seta">›</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: BUSCA
// ═══════════════════════════════════════════════════════════
function TelaBusca({ navigate, instalarPWA }: { navigate: (t: Tela, p?: string) => void; instalarPWA: () => void }) {
  const [aba, setAba] = useState<AbaHome>('busca')
  const [termo, setTermo] = useState('')
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [marcas, setMarcas] = useState<string[]>([])
  const [grupos, setGrupos] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [showInstallBanner, setShowInstallBanner] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
    const closed = localStorage.getItem('mf_hide_install_banner') === 'true'
    setShowInstallBanner(!standalone && !closed)
  }, [])

  const fecharInstallBanner = (e: React.MouseEvent) => {
    e.stopPropagation()
    localStorage.setItem('mf_hide_install_banner', 'true')
    setShowInstallBanner(false)
  }
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    db.produtos.orderBy('subgrupo').uniqueKeys().then(k => setMarcas(k.map(String)))
    db.produtos.orderBy('grupo').uniqueKeys().then(k => setGrupos(k.map(String)))
  }, [])

  const buscar = useCallback(async (q: string) => {
    if (!q.trim()) { setProdutos([]); return }
    setLoading(true)
    try { setProdutos(await buscarProdutos(q)) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => buscar(termo), 400)
    return () => clearTimeout(debounce.current)
  }, [termo, buscar])

  const handleMarca = async (m: string) => {
    setLoading(true)
    const r = await db.produtos.where('subgrupo').equalsIgnoreCase(m).limit(60).toArray()
    setProdutos(r); setAba('busca'); setLoading(false)
  }

  const handleGrupo = async (g: string) => {
    setLoading(true)
    const r = await db.produtos.where('grupo').equalsIgnoreCase(g).limit(60).toArray()
    setProdutos(r); setAba('busca'); setLoading(false)
  }

  return (
    <div className="tela">
      <div className="abas-row">
        {(['busca','marca','grupo'] as AbaHome[]).map(a => (
          <button key={a} className={`aba-btn${aba===a?' ativa':''}`} onClick={() => setAba(a)}>
            {a === 'busca' ? t('tab.busca') : a === 'marca' ? 'Marca' : 'Categoria'}
          </button>
        ))}
      </div>

      {aba === 'busca' && (
        <div className="busca-wrap">
          <div className="busca-row">
            <input className="busca-input" placeholder={t('busca.placeholder')}
              value={termo} onChange={e => setTermo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { clearTimeout(debounce.current); buscar(termo) }}}
              autoCapitalize="characters" />
            {termo && <button className="btn-outline" onClick={() => { setTermo(''); setProdutos([]) }}>✕</button>}
          </div>

          {loading && <div className="loading-row"><div className="spinner" /><span>Buscando…</span></div>}

          {!loading && !termo && (
            <div className="welcome-area">
              <img src={BASE_BANNER} alt="MF Banner" className="welcome-banner" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
              
              {showInstallBanner && (
                <div className="install-banner-card" onClick={instalarPWA}>
                  <span className="install-banner-icon">📥</span>
                  <div className="install-banner-text">
                    <strong>Instalar Aplicativo</strong>
                    <p>Adicione o catálogo à tela de início para acesso rápido e offline.</p>
                  </div>
                  <button className="install-close-btn" onClick={fecharInstallBanner} title="Fechar">✕</button>
                </div>
              )}

              <div className="welcome-card">
                <h2>{t('busca.bem_vindo_titulo')}</h2>
                <p>{t('busca.bem_vindo_desc')}</p>
              </div>
              <div className="mini-cards">
                <div className="mini-card"><span>⚡</span><div><b>{t('busca.card_sinc_titulo')}</b><p>{t('busca.card_sinc_desc')}</p></div></div>
                <div className="mini-card"><span>🚛</span><div><b>{t('busca.card_reparos_titulo')}</b><p>{t('busca.card_reparos_desc')}</p></div></div>
              </div>
            </div>
          )}

          {!loading && produtos.length > 0 && (
            <div className="lista">
              <div className="lista-count">{produtos.length} resultado{produtos.length !== 1 ? 's' : ''}</div>
              {produtos.map(p => <ProdutoCard key={p.codigo} p={p} onClick={() => navigate('produto', p.codigo)} />)}
            </div>
          )}

          {!loading && termo && produtos.length === 0 && (
            <div className="empty-state">
              <span>🔍</span><p>Nenhum produto encontrado para "<b>{termo}</b>"</p>
            </div>
          )}
        </div>
      )}

      {aba === 'marca' && (
        <div className="lista-simples">
          {marcas.filter(Boolean).map(m => (
            <button key={m} className="lista-item-btn" onClick={() => handleMarca(m)}>
              <span>🏷️</span>{m}
            </button>
          ))}
        </div>
      )}

      {aba === 'grupo' && (
        <div className="lista-simples">
          {grupos.filter(Boolean).map(g => (
            <button key={g} className="lista-item-btn" onClick={() => handleGrupo(g)}>
              <span>⚙️</span>{g}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: POR FIGURA
// ═══════════════════════════════════════════════════════════
type FiguraNivel = 'sistemas' | 'grupos' | 'marcas' | 'produtos'
function TelaFigura({ navigate, onSubnivelChange }: { navigate: (t: Tela, p?: string) => void; onSubnivelChange: (sub: boolean) => void }) {
  const [nivel, setNivel] = useState<FiguraNivel>('sistemas')
  const [sistema, setSistema] = useState<typeof SISTEMAS_FIGURA[0] | null>(null)
  const [grupo, setGrupo] = useState('')
  const [marcas, setMarcas] = useState<string[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    onSubnivelChange(nivel !== 'sistemas')
  }, [nivel, onSubnivelChange])

  const selSistema = (s: typeof SISTEMAS_FIGURA[0]) => { setSistema(s); setNivel('grupos') }

  const selGrupo = async (g: string) => {
    setGrupo(g); setLoading(true)
    const all = await db.produtos.where('grupo').equalsIgnoreCase(g).toArray()
    const mks = [...new Set(all.map(p => p.subgrupo).filter(Boolean))].sort()
    setMarcas(mks); setNivel('marcas'); setLoading(false)
  }

  const selMarca = async (m: string) => {
    setLoading(true)
    let q = db.produtos.where('grupo').equalsIgnoreCase(grupo)
    if (m !== 'GERAL') q = q.and(p => p.subgrupo === m)
    setProdutos(await q.limit(60).toArray()); setNivel('produtos'); setLoading(false)
  }

  return (
    <div className="tela">
      {/* Header unificado para navegação por figuras */}
      {nivel !== 'sistemas' && (
        <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 10, margin: '0 -14px 12px' }}>
          <button className="hamburger" onClick={() => setNivel(
            nivel === 'grupos' ? 'sistemas' : nivel === 'marcas' ? 'grupos' : 'marcas'
          )} aria-label="Voltar">←</button>
          <span className="header-title">{nivel === 'grupos' ? sistema?.label : nivel === 'marcas' ? grupo : 'Produtos'}</span>
          <div style={{ width: 40 }} />
        </header>
      )}

      {nivel === 'sistemas' && (
        <div className="figura-wrap">
          <h2 className="figura-titulo">Pesquisa por Diagrama</h2>
          <p className="figura-sub">Selecione o sistema do veículo</p>
          {SISTEMAS_FIGURA.map(s => (
            <button key={s.label} className="sistema-card" onClick={() => selSistema(s)}>
              <span className="sistema-icon">{s.icon}</span>
              <div><strong>{s.label}</strong><p>{s.desc}</p></div>
              <span className="seta">›</span>
            </button>
          ))}
        </div>
      )}

      {nivel === 'grupos' && sistema && (
        <div>
          <h3 className="sub-titulo">{sistema.label} — Selecione o Componente</h3>
          {loading && <div className="loading-row"><div className="spinner"/></div>}
          <div className="grupo-grid">
            {sistema.grupos.map(g => (
              <GrupoFiguraCard key={g} grupo={g} onClick={() => selGrupo(g)} />
            ))}
          </div>
        </div>
      )}

      {nivel === 'marcas' && (
        <div>
          <h3 className="sub-titulo">{grupo} — Selecione a Marca</h3>
          <button className="lista-item-btn marca-item" onClick={() => selMarca('GERAL')}>
            <span>⚙️</span> VER TODOS OS PRODUTOS
          </button>
          {marcas.map(m => (
            <button key={m} className="lista-item-btn marca-item" onClick={() => selMarca(m)}>
              <span>🏷️</span> {m}
            </button>
          ))}
        </div>
      )}

      {nivel === 'produtos' && (
        <div>
          <h3 className="sub-titulo">{sistema?.label} › {grupo}</h3>
          {loading && <div className="loading-row"><div className="spinner"/></div>}
          {produtos.length === 0 && !loading && (
            <div className="empty-state"><span>⚙️</span><p>Nenhum produto para esta seleção.</p></div>
          )}
          {produtos.map(p => <ProdutoCard key={p.codigo} p={p} onClick={() => navigate('produto', p.codigo)} />)}
        </div>
      )}
    </div>
  )
}

function GrupoFiguraCard({ grupo, onClick }: { grupo: string; onClick: () => void }) {
  const [img, setImg] = useState('')
  useEffect(() => {
    let alive = true
    buscarImagemFigura(grupo).then(url => {
      if (!alive || !url) return
      carregarImagemPrivada(url).then(b => { if (alive) setImg(b) })
    })
    return () => { alive = false }
  }, [grupo])

  return (
    <button className="grupo-card" onClick={onClick}>
      {img ? <img src={img} alt={grupo} className="grupo-img" /> : <span className="grupo-icon">⚙️</span>}
      <span className="grupo-label">{grupo}</span>
    </button>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: FAVORITOS
// ═══════════════════════════════════════════════════════════
function TelaFavoritos({ navigate }: { navigate: (t: Tela, p?: string) => void }) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    db.favoritos.toArray().then(async favs => {
      const codigos = favs.map(f => f.codigo)
      const ps = await db.produtos.where('codigo').anyOf(codigos).toArray()
      if (alive) { setProdutos(ps); setLoading(false) }
    })
    return () => { alive = false }
  }, [])

  if (loading) return <div className="loading-row"><div className="spinner"/></div>

  if (produtos.length === 0) return (
    <div className="empty-state tela">
      <span style={{ fontSize: 48 }}>⭐</span>
      <p>{t('favoritos.vazio')}</p>
    </div>
  )

  return (
    <div className="tela">
      <h2 className="sec-titulo">⭐ {t('tab.favoritos')}</h2>
      {produtos.map(p => <ProdutoCard key={p.codigo} p={p} onClick={() => navigate('produto', p.codigo)} />)}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: ORÇAMENTO
// ═══════════════════════════════════════════════════════════
function TelaOrcamento() {
  const [itens, setItens] = useState<Array<{ id?: number; codigo: string; nome: string; quantidade: number }>>([])
  const [enviando, setEnviando] = useState(false)
  const [gerandoPDF, setGerandoPDF] = useState(false)

  const reload = async () => setItens(await db.orcamento.toArray())
  useEffect(() => { reload() }, [])

  const gerarPDF = async () => {
    setGerandoPDF(true)
    try {
      const cad = await getCadastro()
      const doc = new jsPDF()

      // Configurar cores da marca MF Freios (Azul escuro institucional)
      doc.setFillColor(0, 30, 80)
      doc.rect(0, 0, 210, 38, 'F')

      // Título do documento no cabeçalho
      doc.setTextColor(255, 255, 255)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(22)
      doc.text('MF SISTEMAS AUTOMOTIVOS', 15, 18)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'normal')
      doc.text('Divisão Freios a Ar — Cotação de Reparos', 15, 25)

      // Data de emissão no cabeçalho
      const dataStr = new Date().toLocaleDateString('pt-BR')
      const horaStr = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      doc.setFontSize(10)
      doc.text(`Data: ${dataStr} ${horaStr}`, 155, 18)
      doc.text('Catálogo Digital', 155, 25)

      // Informações do cliente
      let y = 52
      doc.setTextColor(15, 23, 42)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('DADOS DO CLIENTE', 15, 46)

      // Linha separadora discreta
      doc.setDrawColor(226, 232, 240)
      doc.setLineWidth(0.5)
      doc.line(15, 48, 195, 48)

      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      
      if (cad) {
        doc.text(`Nome: ${cad.nome || 'Não informado'}`, 15, y)
        doc.text(`WhatsApp: ${cad.whatsapp || 'Não informado'}`, 15, y + 6)
        doc.text(`Cidade/UF: ${cad.cidade || 'Não informado'}/${cad.estado || 'UF'}`, 15, y + 12)
        
        doc.text(`Empresa: ${cad.empresa || 'Não informada'}`, 110, y)
        doc.text(`CNPJ/CPF: ${cad.cnpj || 'Não informado'}`, 110, y + 6)
        doc.text(`E-mail: ${cad.email || 'Não informado'}`, 110, y + 12)
      } else {
        doc.text('Cadastro de cliente não localizado no aplicativo local.', 15, y)
      }

      // Detalhes do orçamento
      y = 80
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text('ITENS DA COTAÇÃO', 15, y)

      doc.line(15, y + 2, 195, y + 2)

      // Tabela de itens
      y = 90
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setFillColor(241, 245, 249)
      doc.rect(15, y, 180, 8, 'F')
      doc.text('CÓDIGO', 18, y + 5.5)
      doc.text('DESCRIÇÃO DO PRODUTO', 52, y + 5.5)
      doc.text('QTD', 182, y + 5.5)

      // Listar os itens
      y += 8
      doc.setFont('helvetica', 'normal')
      itens.forEach((it, idx) => {
        if (idx % 2 === 1) {
          doc.setFillColor(248, 250, 252)
          doc.rect(15, y, 180, 8, 'F')
        }
        
        doc.setFont('helvetica', 'bold')
        doc.text(it.codigo, 18, y + 5.5)
        
        doc.setFont('helvetica', 'normal')
        const nomeTruncado = it.nome.length > 55 ? it.nome.substring(0, 52) + '...' : it.nome
        doc.text(nomeTruncado, 52, y + 5.5)
        
        doc.setFont('helvetica', 'bold')
        doc.text(String(it.quantidade), 184, y + 5.5)
        
        y += 8
        
        if (y > 270 && idx < itens.length - 1) {
          doc.addPage()
          y = 20
          
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.setFillColor(241, 245, 249)
          doc.rect(15, y, 180, 8, 'F')
          doc.text('CÓDIGO', 18, y + 5.5)
          doc.text('DESCRIÇÃO DO PRODUTO', 52, y + 5.5)
          doc.text('QTD', 182, y + 5.5)
          y += 8
          doc.setFont('helvetica', 'normal')
        }
      })

      // Rodapé institucional
      doc.setFontSize(9)
      doc.setTextColor(100, 116, 139)
      doc.setFont('helvetica', 'italic')
      doc.text('Orçamento gerado pelo Catálogo Digital de Reparos MF Freios.', 15, 282)
      doc.text('Obrigado pela preferência!', 155, 282)

      // Converter para blob e compartilhar ou baixar
      const pdfBlob = doc.output('blob')
      const fileName = `orcamento-mf-${dataStr.replace(/\//g, '-')}.pdf`
      
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Orçamento MF Freios',
          text: `Seguem os itens da cotação MF Freios.`
        })
      } else {
        doc.save(fileName)
      }
    } catch (e) {
      console.error(e)
      alert('Erro ao gerar orçamento em PDF. Tente usar o compartilhamento de texto comum.')
    } finally {
      setGerandoPDF(false)
    }
  }

  const alterarQty = async (id: number | undefined, delta: number, atual: number) => {
    if (!id) return
    const nova = atual + delta
    if (nova <= 0) { await db.orcamento.delete(id); reload(); return }
    await db.orcamento.update(id, { quantidade: nova }); reload()
  }

  const limpar = async () => { await db.orcamento.clear(); reload() }

  const compartilhar = async () => {
    const cad = await getCadastro()
    const linhas = itens.map((i, n) => `${n+1}. ${i.codigo} — ${i.nome} (x${i.quantidade})`).join('\n')
    const texto = `Orçamento MF Freios${cad ? ` - ${cad.nome}` : ''}\n\n${linhas}\n\nhttps://rldonadon.github.io/catalogo-mf/`
    if (navigator.share) { await navigator.share({ title: 'Orçamento MF Freios', text: texto }) }
    else { await navigator.clipboard.writeText(texto); alert('Orçamento copiado para área de transferência!') }
  }

  const enviarEmail = async () => {
    const cad = await getCadastro()
    if (!cad) { alert('Por favor, faça seu cadastro primeiro.'); return }
    setEnviando(true)
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'orcamento', cliente: cad, itens, data: new Date().toISOString() })
      })
      alert('Orçamento enviado com sucesso! ✅')
    } catch { alert('Erro ao enviar. Tente compartilhar pelo WhatsApp.') }
    finally { setEnviando(false) }
  }

  return (
    <div className="tela">
      <div className="orcamento-header">
        <h2>📋 {t('tab.orcamento')}</h2>
        {itens.length > 0 && <button className="btn-danger-sm" onClick={limpar}>Limpar</button>}
      </div>

      {itens.length === 0 ? (
        <div className="empty-state">
          <span style={{ fontSize: 48 }}>🛒</span>
          <p>Orçamento vazio</p>
          <small>Adicione produtos na tela de detalhes</small>
        </div>
      ) : (
        <>
          {itens.map(it => (
            <div key={it.id} className="orcamento-card">
              <div className="orcamento-info">
                <span className="badge-cyan">{it.codigo}</span>
                <span className="produto-nome">{it.nome}</span>
              </div>
              <div className="qty-controls">
                <button className="qty-btn" onClick={() => alterarQty(it.id, -1, it.quantidade)}>−</button>
                <span className="qty-num">{it.quantidade}</span>
                <button className="qty-btn" onClick={() => alterarQty(it.id, +1, it.quantidade)}>+</button>
              </div>
            </div>
          ))}

          <div className="orcamento-total">Total: {itens.length} produto{itens.length !== 1 ? 's' : ''}</div>

          <div className="orcamento-btns">
            <button className="btn-primary" onClick={enviarEmail} disabled={enviando}>
              {enviando ? '⏳ Enviando…' : '✉️ Enviar por E-mail'}
            </button>
            <button className="btn-primary-full" onClick={gerarPDF} disabled={gerandoPDF} style={{ background: 'var(--cyan)' }}>
              {gerandoPDF ? '⏳ Gerando PDF…' : '📄 Gerar e Enviar PDF'}
            </button>
            <button className="btn-outline-full" onClick={compartilhar}>
              📤 Compartilhar Texto
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: INFORMATIVOS
// ═══════════════════════════════════════════════════════════
function TelaInfo({ onSubnivelChange }: { onSubnivelChange: (sub: boolean) => void }) {
  const [informativos, setInformativos] = useState<Informativo[]>([])
  const [detalhe, setDetalhe] = useState<Informativo | null>(null)
  const [loading, setLoading] = useState(true)
  const [pdfLoading, setPdfLoading] = useState(false)

  useEffect(() => {
    let alive = true
    db.informativos.orderBy('numero').reverse().toArray().then(items => {
      if (alive) {
        setInformativos(items)
        setLoading(false)
      }
    }).catch(err => {
      console.error("Erro ao ler informativos do IndexedDB:", err)
      if (alive) setLoading(false)
    })
    return () => { alive = false }
  }, [])

  useEffect(() => {
    onSubnivelChange(detalhe !== null)
  }, [detalhe, onSubnivelChange])

  const handleOpenPdf = async (arquivo: string) => {
    if (pdfLoading) return
    setPdfLoading(true)
    try {
      const url = `${IMG_BASE}/informativos/${arquivo}`
      const blobUrl = await carregarImagemPrivada(url)
      if (blobUrl) {
        const link = document.createElement('a')
        link.href = blobUrl
        link.target = '_blank'
        link.download = arquivo
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      } else {
        alert('Não foi possível carregar o arquivo PDF do informativo técnico (erro ao baixar).')
      }
    } catch (err) {
      console.error("Erro ao abrir PDF:", err)
      alert('Ocorreu um erro ao carregar o PDF.')
    } finally {
      setPdfLoading(false)
    }
  }

  if (detalhe) return (
    <div className="tela">
      <header className="app-header" style={{ position: 'sticky', top: 0, zIndex: 10, margin: '0 -14px 12px' }}>
        <button className="hamburger" onClick={() => setDetalhe(null)} aria-label="Voltar">←</button>
        <span className="header-title">Informativos</span>
        <div style={{ width: 40 }} />
      </header>
      <div className="info-detalhe">
        <small className="info-data">{detalhe.data ? new Date(detalhe.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</small>
        <h2>Informativo N° {detalhe.numero} — {detalhe.titulo}</h2>
        <hr />
        
        <div className="badge-row" style={{ margin: '15px 0' }}>
          <span className={`badge-tecnico`} style={{
            background: detalhe.tipo === 'LANCAMENTO' ? '#cce5ff' : detalhe.tipo === 'SUBSTITUICAO' ? '#fff3cd' : detalhe.tipo === 'PROMOCAO' ? '#d4edda' : '#e2e3e5',
            color: detalhe.tipo === 'LANCAMENTO' ? '#004085' : detalhe.tipo === 'SUBSTITUICAO' ? '#856404' : detalhe.tipo === 'PROMOCAO' ? '#155724' : '#383d41',
            padding: '4px 10px',
            borderRadius: '20px',
            fontSize: '0.75rem',
            fontWeight: 'bold',
            textTransform: 'uppercase'
          }}>
            {detalhe.tipo}
          </span>
        </div>

        {detalhe.resumo && <p>{detalhe.resumo}</p>}
        
        <p className="info-aviso" style={{ marginTop: '20px', padding: '12px', background: '#f8fafc', borderLeft: '3px solid #0056b3', borderRadius: '4px', fontSize: '0.85rem' }}>
          O conteúdo completo deste informativo técnico está disponível em formato PDF.
        </p>

        <button 
          onClick={() => handleOpenPdf(detalhe.arquivo)} 
          className="btn-primary-full" 
          disabled={pdfLoading}
          style={{ 
            textAlign: 'center', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            gap: '8px', 
            marginTop: '20px',
            padding: '12px',
            cursor: pdfLoading ? 'not-allowed' : 'pointer',
            opacity: pdfLoading ? 0.7 : 1,
            width: '100%',
            border: 'none',
            fontSize: '1rem',
            color: 'white',
            borderRadius: '6px'
          }}
        >
          {pdfLoading ? '⏳ Baixando PDF…' : '📄 Abrir PDF do Informativo'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="tela">
      <h2 className="sec-titulo">📰 Informativos Técnicos</h2>
      
      {loading && <div className="loading-row"><div className="spinner"/></div>}
      
      {!loading && informativos.length === 0 && (
        <div className="empty-state">
          <span style={{ fontSize: 48 }}>📰</span>
          <p>Nenhum informativo publicado ainda.</p>
        </div>
      )}

      {!loading && informativos.map(item => (
        <div key={item.id} className="info-card" onClick={() => setDetalhe(item)} style={{ cursor: 'pointer' }}>
          <div className="info-card-header">
            <small>{item.data ? new Date(item.data + 'T12:00:00').toLocaleDateString('pt-BR') : ''}</small>
            <span className={`badge-tecnico`} style={{
              background: item.tipo === 'LANCAMENTO' ? '#cce5ff' : item.tipo === 'SUBSTITUICAO' ? '#fff3cd' : item.tipo === 'PROMOCAO' ? '#d4edda' : '#e2e3e5',
              color: item.tipo === 'LANCAMENTO' ? '#004085' : item.tipo === 'SUBSTITUICAO' ? '#856404' : item.tipo === 'PROMOCAO' ? '#155724' : '#383d41',
              padding: '2px 8px',
              borderRadius: '20px',
              fontSize: '0.7rem',
              fontWeight: 'bold',
              textTransform: 'uppercase'
            }}>
              {item.tipo}
            </span>
          </div>
          <strong>N° {item.numero} — {item.titulo}</strong>
          <span className="info-link" style={{ marginTop: '8px', display: 'block', fontSize: '0.8rem', color: '#0056b3', fontWeight: 'bold' }}>Visualizar →</span>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: DETALHE DO PRODUTO
// ═══════════════════════════════════════════════════════════
function TelaProduto({ codigo, navigate, onVoltar }: { codigo: string; navigate: (t: Tela, p?: string) => void; onVoltar: () => void }) {
  const [produto, setProduto] = useState<Produto | null>(null)
  const [imgUrls, setImgUrls] = useState<{ reparo?: string; valvula?: string }>({})
  const [reparo, setReparo] = useState('')
  const [valvula, setValvula] = useState('')
  const [isFav, setIsFav] = useState(false)
  const [modalQty, setModalQty] = useState(false)
  const [quantidade, setQty] = useState(1)
  const [relacionados, setRelacionados] = useState<Produto[]>([])
  const [loadingImgs, setLoadingImgs] = useState(true)
  const [zoomImg, setZoomImg] = useState('')

  useEffect(() => {
    db.produtos.get(codigo).then(p => {
      if (!p) return
      setProduto(p)
      db.favoritos.get(p.codigo).then(f => setIsFav(!!f))
      db.produtos.where('grupo').equalsIgnoreCase(p.grupo).limit(10).toArray()
        .then(r => setRelacionados(r.filter(x => x.codigo !== p.codigo)))
      buscarImagensProduto(p.codigo).then(async urls => {
        setImgUrls(urls)
        const [r, v] = await Promise.all([
          urls.reparo ? carregarImagemPrivada(urls.reparo) : Promise.resolve(''),
          urls.valvula ? carregarImagemPrivada(urls.valvula) : Promise.resolve(''),
        ])
        setReparo(r); setValvula(v); setLoadingImgs(false)
      })
    })
  }, [codigo])

  const toggleFav = async () => {
    if (!produto) return
    if (isFav) { await db.favoritos.delete(produto.codigo); setIsFav(false) }
    else { await db.favoritos.add({ codigo: produto.codigo, adicionado_em: new Date().toISOString() }); setIsFav(true) }
  }

  const adicionarOrcamento = async () => {
    if (!produto) return
    const exist = await db.orcamento.where('codigo').equals(produto.codigo).first()
    if (exist?.id) await db.orcamento.update(exist.id, { quantidade: exist.quantidade + quantidade })
    else await db.orcamento.add({ codigo: produto.codigo, nome: produto.nome, quantidade })
    alert(`✅ ${quantidade}x ${produto.codigo} adicionado ao orçamento.`)
    setModalQty(false); setQty(1)
  }

  const compartilhar = async () => {
    if (!produto) return
    const texto = `*${produto.codigo}* — ${produto.nome}\n${produto.grupo} | ${produto.subgrupo}\nhttps://rldonadon.github.io/catalogo-mf/`
    if (navigator.share) await navigator.share({ title: produto.nome, text: texto })
    else { await navigator.clipboard.writeText(texto); alert('Copiado!') }
  }

  if (!produto) return <div className="loading-row"><div className="spinner"/></div>

  return (
    <div className="tela-produto">
      {/* Header unificado na barra de cima */}
      <header className="app-header" style={{ margin: '0 -14px 12px' }}>
        <button className="hamburger" onClick={onVoltar} aria-label="Voltar">←</button>
        <span className="header-title-code">{produto.codigo}</span>
        <div className="header-actions">
          <button className={`btn-icon ${isFav ? 'fav-ativo' : ''}`} onClick={toggleFav} title="Favorito">⭐</button>
          <button className="btn-icon" onClick={compartilhar} title="Compartilhar">📤</button>
        </div>
      </header>

      {/* Imagens */}
      <div className="imgs-area">
        {loadingImgs && <div className="loading-row"><div className="spinner"/><span>Carregando imagens…</span></div>}

        {!loadingImgs && !reparo && !valvula && (
          <div className="sem-foto"><span>🔧</span><p>Sem fotos disponíveis</p></div>
        )}

        {reparo && (
          <div className="img-container" onClick={() => setZoomImg(reparo)}>
            <div className="img-label">JOGO REPARO</div>
            <img src={reparo} alt="reparo" className="produto-img" />
            <div className="zoom-hint">🔍 Toque para ampliar</div>
          </div>
        )}

        {valvula && (
          <div className="img-container" onClick={() => setZoomImg(valvula)}>
            <div className="img-label">APLICAÇÃO VÁLVULA</div>
            <img src={valvula} alt="valvula" className="produto-img" />
            <div className="zoom-hint">🔍 Toque para ampliar</div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="produto-info-area">
        <div className="tags-row">
          <span className="badge-cyan-dim">{produto.grupo}</span>
          {produto.subgrupo && <span className="badge-blue">{produto.subgrupo}</span>}
        </div>

        <h1 className="produto-h1">{produto.nome}</h1>
        {produto.descricao && produto.descricao !== produto.nome && <p>{produto.descricao}</p>}

        {produto.referencias_busca && (
          <div className="secao">
            <h3>🔄 Referências Cruzadas</h3>
            <div className="refs-chips">
              {produto.referencias_busca.split(/[,;|\n|]/).map(r => r.trim()).filter(r => {
                if (!r) return false;
                const isQuinelato = r.toUpperCase().startsWith('QA');
                const isFarj = /^\d{5}-\d+/.test(r);
                return !isQuinelato && !isFarj;
              }).map(r => (
                <span key={r} className="ref-chip">{r}</span>
              ))}
            </div>
          </div>
        )}

        {produto.aplicacao && (
          <div className="secao">
            <h3>🚛 Aplicações</h3>
            {produto.aplicacao.split('\n').filter(Boolean).map((a, i) => (
              <div key={i} className="aplicacao-item"><span className="bullet">•</span>{a}</div>
            ))}
          </div>
        )}

        {/* Informações Fiscais: NCM, IPI, ST */}
        {(produto.ncm || produto.ipi || produto.st) && (
          <div className="secao secao-fiscal">
            <h3>📋 Informações Fiscais</h3>
            <div className="fiscal-grid">
              {produto.ncm && (
                <div className="fiscal-row">
                  <span className="fiscal-label">NCM</span>
                  <span className="fiscal-value">{produto.ncm}</span>
                </div>
              )}
              {produto.ipi && (
                <div className="fiscal-row">
                  <span className="fiscal-label">IPI</span>
                  <span className="fiscal-value">{produto.ipi}</span>
                </div>
              )}
              {produto.st && (
                <div className="fiscal-row">
                  <span className="fiscal-label">ST</span>
                  <span className="fiscal-value">{produto.st}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {relacionados.length > 0 && (
          <div className="secao">
            <h3>⛓️ Relacionados</h3>
            <div className="relacionados-scroll">
              {relacionados.map(r => (
                <div key={r.codigo} className="rel-card" onClick={() => navigate('produto', r.codigo)} role="button">
                  <ImagemProduto codigo={r.codigo} size={50} />
                  <span className="rel-codigo">{r.codigo}</span>
                  <span className="rel-nome">{r.nome}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="produto-footer">
        <button className="btn-primary-full" onClick={() => setModalQty(true)}>
          📋 {t('produto.adicionar_orcamento')}
        </button>
      </div>

      {/* Modal Quantidade */}
      {modalQty && (
        <div className="modal-overlay" onClick={() => setModalQty(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>{t('produto.modal_adicionar')}</h3>
            <div className="modal-produto-info">
              <span className="badge-cyan">{produto.codigo}</span>
              <span>{produto.nome}</span>
            </div>
            <div className="qty-controls-modal">
              <button className="qty-btn-lg" onClick={() => setQty(q => Math.max(1, q-1))}>−</button>
              <span className="qty-num-lg">{quantidade}</span>
              <button className="qty-btn-lg" onClick={() => setQty(q => q+1)}>+</button>
            </div>
            <div className="modal-btns">
              <button className="btn-outline" onClick={() => setModalQty(false)}>Cancelar</button>
              <button className="btn-primary" onClick={adicionarOrcamento}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* Zoom */}
      {zoomImg && (
        <div className="zoom-overlay" onClick={() => setZoomImg('')}>
          <img src={zoomImg} alt="zoom" className="zoom-img" />
          <button className="zoom-close" onClick={() => setZoomImg('')}>✕</button>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: CADASTRO
// ═══════════════════════════════════════════════════════════
type EtapaCadastro = 'idioma' | 'politica' | 'formulario'
type TipoPessoa = 'PJ' | 'PF'

function TelaCadastro({ onVoltar }: { onVoltar: () => void }) {
  const [etapa, setEtapa] = useState<EtapaCadastro>('idioma')
  const [lang, setLang] = useState<Idioma>('PT')
  const [tipo, setTipo] = useState<TipoPessoa>('PJ')
  const [isEdit, setIsEdit] = useState(false)
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [email, setEmail] = useState('')
  const [aceitoCheckbox, setAceitoCheckbox] = useState(false)
  const [cadastroSending, setCadastroSending] = useState(false)
  const [codigoCadastro, setCodigoCadastro] = useState('')

  useEffect(() => {
    getCadastro().then(c => {
      if (!c) return
      setIsEdit(true); setEtapa('formulario')
      setLang((c.idioma as Idioma) || 'PT'); setTipo((c.tipoPessoa as TipoPessoa) || 'PJ')
      setCnpjCpf(c.cnpjCpf || ''); setNome(c.nome || '')
      setTelefone(c.telefone || ''); setCidade(c.cidade || '')
      setEstado(c.estado || ''); setEmail(c.email || '')
      setCodigoCadastro(c.codigoCadastro || '')
    })
  }, [])

  const fmtDoc = (v: string) => {
    const d = v.replace(/\D/g, '')
    if (tipo === 'PJ') return d.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2').substring(0,18)
    return d.replace(/^(\d{3})(\d)/,'$1.$2').replace(/^(\d{3})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1-$2').substring(0,14)
  }

  const fmtTel = (v: string) => {
    const d = v.replace(/\D/g, '')
    if (d.length > 10) return d.replace(/^(\d{2})(\d{5})(\d{4})/,'($1) $2-$3').substring(0,15)
    if (d.length > 5) return d.replace(/^(\d{2})(\d{4})(\d)/,'($1) $2-$3').substring(0,14)
    if (d.length > 2) return d.replace(/^(\d{2})(\d)/,'($1) $2')
    return d
  }

  const finalizar = async () => {
    if (!cnpjCpf.trim()) return alert(`Preencha o ${tipo === 'PJ' ? 'CNPJ' : 'CPF'}.`)
    if (!nome.trim()) return alert('Preencha o nome.')
    if (!telefone.trim() || telefone.length < 10) return alert('Insira um telefone válido.')
    if (!estado.trim()) return alert('Preencha o Estado.')
    if (!cidade.trim()) return alert('Preencha a Cidade.')
    if (!email.trim() || !email.includes('@')) return alert('Por favor, preencha um e-mail válido.')

    if (!isEdit && !aceitoCheckbox) {
      return alert('É necessário aceitar a Política de Privacidade para prosseguir.')
    }

    const dddMatch = telefone.match(/\((\d{2})\)/)
    const ddd = dddMatch ? dddMatch[1] : telefone.replace(/\D/g, '').substring(0, 2)
    const numTelefone = telefone.replace(/\D/g, '').substring(2)

    const prosseguirLocal = async (token?: string, timestamp?: string, ip?: string, id_cliente?: number) => {
      const cadAtual = await getCadastro();
      let finalCodigo = id_cliente ? String(id_cliente).padStart(5, '0') : '';
      if (!finalCodigo && isEdit) {
        finalCodigo = cadAtual?.codigoCadastro || '';
      }
      if (!finalCodigo) {
        finalCodigo = Math.floor(10000 + Math.random() * 90000).toString();
      }

      const finalToken = token || cadAtual?.token_verificacao || '';
      const finalTimestamp = timestamp || cadAtual?.timestamp_aceite || '';
      const finalIp = ip || cadAtual?.ip_registrado || '';

      setIdioma(lang)
      await salvarCadastro({
        idioma: lang,
        tipoPessoa: tipo,
        cnpjCpf,
        nome,
        telefone,
        estado,
        cidade,
        email,
        token_verificacao: finalToken,
        timestamp_aceite: finalTimestamp,
        ip_registrado: finalIp,
        data_cadastro: cadAtual?.data_cadastro || new Date().toISOString(),
        codigoCadastro: finalCodigo
      })

      // Envia para Google Sheets (backup histórico)
      try {
        await fetch(WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tipo: 'cadastro',
            nome,
            empresa: tipo === 'PJ' ? nome : 'Pessoa Física',
            cnpj: cnpjCpf,
            email,
            ddd,
            telefone: numTelefone,
            estado,
            cidade,
            token_verificacao: token || '',
            data: new Date().toISOString(),
            codigoCadastro: finalCodigo
          })
        })
      } catch (err) {
        console.error("Erro no webhook backup:", err)
      }

      alert(isEdit ? `Cadastro atualizado! ✅\nCódigo do Cadastro: ${finalCodigo}` : `Cadastro realizado! ✅\nCódigo do Cadastro: ${finalCodigo}`)
      onVoltar()
    }

    if (isEdit) {
      await prosseguirLocal()
    } else {
      setCadastroSending(true)
      const payload = {
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        empresa: tipo === 'PJ' ? nome.trim() : 'Pessoa Física',
        tipo_doc: tipo === 'PJ' ? 'cnpj' : 'cpf',
        documento: cnpjCpf.replace(/\D/g, ''),
        estado: estado.trim().toUpperCase(),
        cidade: cidade.trim(),
        ddd: ddd,
        telefone: numTelefone,
        segmento: tipo === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física',
        aceito: true
      }

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 12000)

        const res = await fetch("https://rldonadon.pythonanywhere.com/api/cadastro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        const data = await res.json()
        if (res.ok && data && data.token_verificacao) {
          await prosseguirLocal(data.token_verificacao, data.timestamp_aceite, data.ip_registrado, data.id)
        } else {
          const detail = data && data.detail ? data.detail : 'Erro no processamento.'
          alert(`Erro no Cadastro: ${detail}`)
        }
      } catch (e: any) {
        console.error("Erro no cadastro:", e)
        alert(`Erro de conexão com o servidor de privacidade. Certifique-se de que a API esteja online.`)
      } finally {
        setCadastroSending(false)
      }
    }
  }

  return (
    <div className="tela tela-cadastro" style={{ paddingTop: 0 }}>
      <header className="app-header" style={{ margin: '0 -14px 12px' }}>
        {isEdit ? (
          <button className="hamburger" onClick={onVoltar} aria-label="Voltar">←</button>
        ) : (
          <div style={{ width: 40 }} />
        )}
        <span className="header-title">{isEdit ? 'Meu Cadastro' : 'Cadastro'}</span>
        <div style={{ width: 40 }} />
      </header>

      {etapa === 'idioma' && (
        <div className="cadastro-etapa">
          <h2 className="cadastro-titulo">Selecione o Idioma / Language</h2>
          {([['PT','🇧🇷','Português (BR)'],['ES','🇪🇸','Español (ES)'],['EN','🇺🇸','English (US)']] as const).map(([l,flag,label]) => (
            <button key={l} className="idioma-btn" onClick={() => { setLang(l as Idioma); setEtapa('politica') }}>
              <span>{flag}</span><strong>{label}</strong>
            </button>
          ))}
        </div>
      )}

      {etapa === 'politica' && (
        <div className="cadastro-etapa">
          <h2 className="cadastro-titulo">Termos & Política de Privacidade</h2>
          <div className="politica-box" style={{ maxHeight: '350px' }}>
            <h3>POLÍTICA DE PRIVACIDADE E SEGURANÇA</h3>
            <p>A MF Sistemas Automotivos (MF Freios), pessoa jurídica de direito privado, com sede e administração na Av. Dr. José de Paula Eduardo, n° 180, Distrito Industrial | Monte Alto - SP, CEP: 15910-458, simplesmente denominada como MF Freios, preza pela transparência, segurança e privacidade. Entendemos a importância dos registros eletrônicos e dados pessoais fornecidos por você (“Titular”) na utilização desta ferramenta. Regulamos, por meio da presente Política de Privacidade e Proteção de Dados (“Política”), de forma simples e transparente, atendendo à Lei n.º 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD), quais dados serão tratados, suas finalidades e sua eliminação.</p>
            <p>Em caso de dúvidas, reclamações ou solicitações, por favor entre em contato conosco por meio do e-mail: <strong>vendas.mffreios@gmail.com</strong>.</p>
            <h3>Controlador dos Dados:</h3>
            <p>MF Sistemas Automotivos. Endereço: Av. Dr. José de Paula Eduardo, n° 180, Distrito Industrial | Monte Alto - SP, CEP: 15910-458.</p>
            <h3>Finalidade do Tratamento:</h3>
            <p>Utilizamos seus dados pessoais para:</p>
            <p>• Entrar em contato com você, Titular;</p>
            <p>• Liberar o acesso ao catálogo eletrônico de produtos;</p>
            <p>• Enviar e compartilhar informações, conteúdos técnicos, novidades e lançamentos de produtos da MF Freios.</p>
            <h3>Quais Dados Pessoais Coletamos:</h3>
            <p>• Nome, CPF/CNPJ, E-mail, Endereço e Telefones.</p>
            <p>• Informações sobre o dispositivo utilizado para a navegação.</p>
            <p>• Pesquisas, resultados e ações realizadas dentro da ferramenta.</p>
            <p>A MF Freios não trata, para as finalidades aqui dispostas, dados considerados sensíveis pela Lei nº 13.709/2018.</p>
            <h3>Compartilhamento de Dados:</h3>
            <p>A MF Freios não comercializa seus dados pessoais em hipótese alguma. Os dados não são divulgados para terceiros, exceptuando determinação legal/judicial ou com a empresa/desenvolvedor terceirizado responsável pela gestão técnica do nosso catálogo eletrônico, que atua estritamente sob nossas diretrizes de segurança.</p>
            <h3>Seus Direitos (Eliminação dos Dados):</h3>
            <p>Você, na condição de Titular, pode solicitar a qualquer momento a confirmação da existência de tratamento, a correção de dados incompletos ou a eliminação definitiva de seus dados de nossa base de dados. Para isso, basta enviar uma solicitação para o e-mail: <strong>vendas.mffreios@gmail.com</strong>.</p>
          </div>
          <div className="botao-row">
            <button className="btn-outline" onClick={() => setEtapa('idioma')}>Voltar</button>
            <button className="btn-primary" onClick={() => setEtapa('formulario')}>Concordar & Continuar</button>
          </div>
        </div>
      )}

      {etapa === 'formulario' && (
        <div className="formulario-wrap">
          <h2 className="cadastro-titulo">Formulário de Cadastro</h2>
          <div className="tab-row">
            {(['PJ','PF'] as TipoPessoa[]).map(tp => (
              <button key={tp} className={`tab-btn${tipo===tp?' ativa':''}`} onClick={() => { setTipo(tp); setCnpjCpf('') }}>
                {tp === 'PJ' ? 'PESSOA JURÍDICA' : 'PESSOA FÍSICA'}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <label>{tipo === 'PJ' ? 'CNPJ *' : 'CPF *'}<input className="form-input" inputMode="numeric" value={cnpjCpf} onChange={e => setCnpjCpf(fmtDoc(e.target.value))} placeholder={tipo === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'} /></label>
            <label>{tipo === 'PJ' ? 'Razão Social / Nome Fantasia *' : 'Nome Completo *'}<input className="form-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Insira o nome" /></label>
            <label>Telefone Celular (WhatsApp) *<input className="form-input" inputMode="tel" value={telefone} onChange={e => setTelefone(fmtTel(e.target.value))} placeholder="(00) 00000-0000" /></label>
            <div className="form-row">
              <label style={{ flex: 2 }}>Cidade *<input className="form-input" value={cidade} onChange={e => setCidade(e.target.value)} placeholder="Ex: São Paulo" /></label>
              <label style={{ flex: 1 }}>UF *<input className="form-input" maxLength={2} value={estado} onChange={e => setEstado(e.target.value.toUpperCase())} placeholder="SP" /></label>
            </div>
            <label>E-mail *<input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@email.com" /></label>
          </div>
          {!isEdit && (
            <div className="lgpd-checkbox-container" style={{ margin: '15px 0', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
              <input
                type="checkbox"
                id="aceitoCheckbox"
                checked={aceitoCheckbox}
                onChange={e => setAceitoCheckbox(e.target.checked)}
                style={{ marginTop: '4px', cursor: 'pointer', width: '18px', height: '18px' }}
              />
              <label htmlFor="aceitoCheckbox" style={{ fontSize: '0.9rem', color: 'var(--text)', cursor: 'pointer', lineHeight: '1.4' }}>
                Li e aceito a <span className="link-inline" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEtapa('politica'); }} style={{ color: 'var(--cyan)', textDecoration: 'underline', fontWeight: 'bold' }}>Política de Privacidade</span> da MF Sistemas Automotivos.
              </label>
            </div>
          )}
          {isEdit && (
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '15px', textAlign: 'center', background: 'var(--bg-panel)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              Código do Cadastro: <strong>{codigoCadastro || "------"}</strong>
            </div>
          )}
          <div className="botao-row">
            {!isEdit && <button className="btn-outline" onClick={() => setEtapa('politica')}>Voltar</button>}
            <button className="btn-primary" onClick={finalizar} disabled={(!isEdit && !aceitoCheckbox) || cadastroSending}>
              {cadastroSending ? '⏳ Cadastrando...' : 'Finalizar Cadastro'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: CONTATO
// ═══════════════════════════════════════════════════════════
function TelaContato({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="tela" style={{ paddingTop: 0 }}>
      <header className="app-header" style={{ margin: '0 -14px 12px' }}>
        <button className="hamburger" onClick={onVoltar} aria-label="Voltar">←</button>
        <span className="header-title">Contato</span>
        <div style={{ width: 40 }} />
      </header>

      <div className="contato-card">
        <h3>💬 WhatsApp Vendas</h3>
        {WHATSAPP_NUMS.map(n => (
          <div key={n.label} className="contato-linha">
            <span>{n.label}</span>
            <a className="btn-wpp" href={n.url} target="_blank" rel="noreferrer">Conversar</a>
          </div>
        ))}
      </div>

      <div className="contato-card">
        <h3>📞 Suporte / Vendas</h3>
        {TELEFONES.map(t => (
          <div key={t.label} className="contato-linha">
            <span>{t.label}</span>
            <a className="btn-cyan" href={`tel:${t.tel}`}>Ligar</a>
          </div>
        ))}
      </div>

      <div className="contato-card">
        <h3>✉️ E-mail Comercial</h3>
        {EMAILS_CONTATO.map(e => (
          <div key={e} className="contato-linha">
            <span>{e}</span>
            <a className="btn-outline-sm" href={`mailto:${e}`}>Escrever</a>
          </div>
        ))}
      </div>

      <div className="contato-card">
        <h3>📍 Endereço</h3>
        <p>{ENDERECO.logradouro}</p>
        <p>{ENDERECO.bairro}</p>
        <p>{ENDERECO.cidade}</p>
        <p>{ENDERECO.cep}</p>
        <a className="btn-outline-full" href={ENDERECO.mapsUrl} target="_blank" rel="noreferrer">📍 Ver no Mapa</a>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: SOBRE
// ═══════════════════════════════════════════════════════════
function TelaSobre({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="tela" style={{ paddingTop: 0 }}>
      <header className="app-header" style={{ margin: '0 -14px 12px' }}>
        <button className="hamburger" onClick={onVoltar} aria-label="Voltar">←</button>
        <span className="header-title">Sobre a MF Freios</span>
        <div style={{ width: 40 }} />
      </header>
      <div className="sobre-logo-card">
        <img src={BASE_LOGO} alt="MF Logo" className="sobre-logo" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
        <strong>MF SISTEMAS AUTOMOTIVOS</strong>
        <span>Catálogo Digital • Versão 7.0.0</span>
      </div>
      <div className="sobre-card"><h3>🏢 A Nossa Empresa</h3><p>MF Freios é referência em reposição de autopeças para linha pesada — caminhões, ônibus, carretas e cavalos mecânicos. Especializada em freios a ar para Mercedes-Benz, Scania, Volvo, Ford, Volkswagen e Iveco.</p></div>
      <div className="sobre-card"><h3>✨ Nossos Diferenciais</h3>
        <div className="sobre-item"><span>⚡</span><div><b>Tecnologia de Ponta</b><p>Processos e compostos certificados internacionalmente.</p></div></div>
        <div className="sobre-item"><span>📦</span><div><b>Portfólio Completo</b><p>Válvulas, compressores, servos e atuadores pneumáticos.</p></div></div>
        <div className="sobre-item"><span>🛡️</span><div><b>Segurança e Confiança</b><p>Testes de fadiga e estanqueidade em todos os produtos.</p></div></div>
      </div>
      <div className="sobre-card"><h3>📱 Aplicativo Móvel</h3>
        <ul>
          <li>🔍 Busca inteligente offline</li>
          <li>🚛 Figuras de posicionamento</li>
          <li>🔄 Referências cruzadas</li>
          <li>📤 Compartilhamento via WhatsApp</li>
        </ul>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: LANÇAMENTOS
// ═══════════════════════════════════════════════════════════
function TelaLancamentos({ navigate, onVoltar }: { navigate: (t: Tela, p?: string) => void; onVoltar: () => void }) {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    db.produtos.filter(p => !!p.data_lancamento).reverse().limit(50).toArray()
      .then(r => { setProdutos(r); setLoading(false) })
  }, [])

  return (
    <div className="tela" style={{ paddingTop: 0 }}>
      <header className="app-header" style={{ margin: '0 -14px 12px' }}>
        <button className="hamburger" onClick={onVoltar} aria-label="Voltar">←</button>
        <span className="header-title">Lançamentos</span>
        <div style={{ width: 40 }} />
      </header>
      <div className="welcome-card" style={{ marginBottom: 16 }}>
        <p>Confira as últimas novidades e novos reparos inseridos no catálogo comercial da MF Freios.</p>
      </div>
      {loading && <div className="loading-row"><div className="spinner"/></div>}
      {!loading && produtos.length === 0 && <div className="empty-state"><span>🚀</span><p>Nenhum lançamento recente encontrado.</p></div>}
      {produtos.map(p => <ProdutoCard key={p.codigo} p={p} onClick={() => navigate('produto', p.codigo)} />)}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: MENSAGENS
// ═══════════════════════════════════════════════════════════
const MENSAGENS_MOCK = [
  { id: '1', titulo: 'Bem-vindo ao Novo Catálogo Mobile v7.0!', conteudo: 'O catálogo digital MF está disponível como PWA — instale no seu celular e use offline.', data: '22/05/2026', lida: false, categoria: 'sistema' },
  { id: '2', titulo: 'Novos Lançamentos de Reparos Disponíveis!', conteudo: 'Acesse a aba Lançamentos para ver os últimos produtos adicionados ao catálogo.', data: '20/05/2026', lida: false, categoria: 'lancamento' },
  { id: '3', titulo: 'Sincronização de Banco de Dados Concluída', conteudo: 'Seu catálogo offline foi atualizado com sucesso.', data: '15/05/2026', lida: true, categoria: 'sistema' },
] as const

function TelaMensagens({ onVoltar }: { onVoltar: () => void }) {
  const [msgs, setMsgs] = useState(MENSAGENS_MOCK.map(m => ({ ...m })))
  const marcarLida = (id: string) => setMsgs(m => m.map(x => x.id === id ? { ...x, lida: true } : x))
  const limpar = () => setMsgs([])
  const iconeCat = (c: string) => c === 'lancamento' ? '🚀' : c === 'promo' ? '📢' : '⚙️'

  return (
    <div className="tela" style={{ paddingTop: 0 }}>
      <header className="app-header" style={{ margin: '0 -14px 12px' }}>
        <button className="hamburger" onClick={onVoltar} aria-label="Voltar">←</button>
        <span className="header-title">Central de Mensagens</span>
        <div style={{ width: 40 }} />
      </header>
      <div className="orcamento-header">
        <h2>💬 Central de Mensagens</h2>
        {msgs.length > 0 && <button className="btn-danger-sm" onClick={limpar}>Limpar</button>}
      </div>
      {msgs.length === 0 && <div className="empty-state"><span>💬</span><p>Você não possui nenhuma nova mensagem.</p></div>}
      {msgs.map(m => (
        <div key={m.id} className={`msg-card${m.lida ? '' : ' nao-lida'}`} onClick={() => marcarLida(m.id)}>
          {!m.lida && <div className="ponto-nao-lido"/>}
          <div className="msg-icon">{iconeCat(m.categoria)}</div>
          <div className="msg-corpo">
            <strong>{m.titulo}</strong>
            <p>{m.conteudo}</p>
            <small>{m.data}</small>
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: POLÍTICA
// ═══════════════════════════════════════════════════════════
function TelaPolitica({ onVoltar }: { onVoltar: () => void }) {
  return (
    <div className="tela" style={{ paddingTop: 0 }}>
      <header className="app-header" style={{ margin: '0 -14px 12px' }}>
        <button className="hamburger" onClick={onVoltar} aria-label="Voltar">←</button>
        <span className="header-title">Política de Privacidade</span>
        <div style={{ width: 40 }} />
      </header>
      <div className="politica-full" style={{ paddingBottom: '30px' }}>
        <h3>Política de Privacidade - MF Sistemas Automotivos</h3>
        <p>A MF Sistemas Automotivos (MF Freios), pessoa jurídica de direito privado, com sede e administração na Av. Dr. José de Paula Eduardo, n° 180, Distrito Industrial | Monte Alto - SP, CEP: 15910-458, simplesmente denominada como MF Freios, preza pela transparência, segurança e privacidade. Entendemos a importância dos registros eletrônicos e dados pessoais fornecidos por você (“Titular”) na utilização desta ferramenta. Regulamos, por meio da presente Política de Privacidade e Proteção de Dados (“Política”), de forma simples e transparente, atendendo à Lei n.º 13.709/2018 (Lei Geral de Proteção de Dados Pessoais - LGPD), quais dados serão tratados, suas finalidades e sua eliminação.</p>
        <p>Em caso de dúvidas, reclamações ou solicitações, por favor entre em contato conosco por meio do e-mail: <strong>vendas.mffreios@gmail.com</strong>.</p>
        
        <h3>Controlador dos Dados:</h3>
        <p>MF Sistemas Automotivos. Endereço: Av. Dr. José de Paula Eduardo, n° 180, Distrito Industrial | Monte Alto - SP, CEP: 15910-458.</p>
        
        <h3>Finalidade do Tratamento:</h3>
        <p>Utilizamos seus dados pessoais para:</p>
        <ul>
          <li>Entrar em contato com você, Titular;</li>
          <li>Liberar o acesso ao catálogo eletrônico de produtos;</li>
          <li>Enviar e compartilhar informações, conteúdos técnicos, novidades e lançamentos de produtos da MF Freios.</li>
        </ul>
        
        <h3>Quais Dados Pessoais Coletamos:</h3>
        <ul>
          <li>Nome, CPF/CNPJ, E-mail, Endereço e Telefones.</li>
          <li>Informações sobre o dispositivo utilizado para a navegação.</li>
          <li>Pesquisas, resultados e ações realizadas dentro da ferramenta.</li>
        </ul>
        <p>A MF Freios não trata, para as finalidades aqui dispostas, dados considerados sensíveis pela Lei nº 13.709/2018.</p>
        
        <h3>Compartilhamento de Dados:</h3>
        <p>A MF Freios não comercializa seus dados pessoais em hipótese alguma. Os dados não são divulgados para terceiros, exceto quando houver determinação legal/judicial ou com a empresa/desenvolvedor terceirizado responsável pela gestão técnica do nosso catálogo eletrônico, que atua estritamente sob nossas diretrizes de segurança.</p>
        
        <h3>Seus Direitos (Eliminação dos Dados):</h3>
        <p>Você, na condição of Titular, pode solicitar a qualquer momento a confirmação da existência de tratamento, a correção de dados incompletos ou a eliminação definitiva de seus dados de nossa base de dados. Para isso, basta enviar uma solicitação para o e-mail: <strong>vendas.mffreios@gmail.com</strong>.</p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  TELA: IDIOMA
// ═══════════════════════════════════════════════════════════
function TelaIdioma({ onVoltar }: { onVoltar: () => void }) {
  const [atual, setAtual] = useState<Idioma>(getIdioma())
  const selecionar = async (l: Idioma) => {
    setIdioma(l); setAtual(l)
    const c = await getCadastro()
    if (c) await salvarCadastro({ ...c, idioma: l })
    alert('Idioma alterado! Algumas mudanças serão aplicadas ao recarregar.')
    onVoltar()
  }
  return (
    <div className="tela" style={{ paddingTop: 0 }}>
      <header className="app-header" style={{ margin: '0 -14px 12px' }}>
        <button className="hamburger" onClick={onVoltar} aria-label="Voltar">←</button>
        <span className="header-title">Alterar Idioma</span>
        <div style={{ width: 40 }} />
      </header>
      <h2 className="sec-titulo" style={{ display: 'none' }}>🌐 Selecione o Idioma</h2>
      <p>Escolha o seu idioma de preferência.</p>
      {([['PT','🇧🇷','Português','Brasil (BR)'],['ES','🇪🇸','Español','España (ES)'],['EN','🇺🇸','English','United States (US)']] as const).map(([l,flag,nome,pais]) => (
        <button key={l} className={`idioma-card${atual===l?' ativo':''}`} onClick={() => selecionar(l as Idioma)}>
          <span className="idioma-flag">{flag}</span>
          <div><strong>{nome}</strong><small>{pais}</small></div>
          {atual === l && <span className="checkmark">✓</span>}
        </button>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
//  COMPONENTE: DRAWER
// ═══════════════════════════════════════════════════════════
function Drawer({ isOpen, onClose, navigate, theme, toggleTheme, instalarPWA, onVerificarAtualizacoes }: {
  isOpen: boolean; onClose: () => void; navigate: (t: Tela) => void;
  theme: 'light' | 'dark'; toggleTheme: () => void; instalarPWA: () => void;
  onVerificarAtualizacoes: () => void;
}) {
  const [fontScale, setFontScale] = useState(() => parseFloat(localStorage.getItem('mf_font_scale') || '1'))
  const [fontModal, setFontModal] = useState(false)

  const aplicarFonte = (v: number) => {
    const clamped = Math.min(1.5, Math.max(0.8, v))
    setFontScale(clamped)
    localStorage.setItem('mf_font_scale', String(clamped))
    document.documentElement.style.fontSize = `${clamped * 16}px`
  }

  const compartilharApp = async () => {
    onClose()
    const txt = 'Acesse o Catálogo Digital da MF Freios! Encontre reparos de alta qualidade para caminhões, ônibus e carretas.\n\n📲 Acesse agora:\nhttps://rldonadon.github.io/catalogo-mf/'
    if (navigator.share) await navigator.share({ title: 'Catálogo MF Freios', text: txt })
    else { await navigator.clipboard.writeText(txt); alert('Link copiado!') }
  }

  const goTo = (tela: Tela) => { onClose(); navigate(tela) }

  const MENU = [
    { icon: '🔍', label: t('menu.linha_produtos'), action: () => goTo('busca') },
    { icon: '📋', label: t('menu.meus_pedidos'), action: () => goTo('orcamento') },
    { icon: '🚀', label: t('menu.lancamentos'), action: () => goTo('lancamentos') },
    { icon: '📰', label: t('menu.informativos'), action: () => goTo('info') },
    { icon: '💬', label: t('menu.mensagens'), action: () => goTo('mensagens') },
    { icon: '👤', label: t('menu.meu_cadastro'), action: () => goTo('cadastro') },
    { icon: '📞', label: t('menu.contato'), action: () => goTo('contato') },
    { icon: '🏢', label: t('menu.sobre_quinelato'), action: () => goTo('sobre') },
    { icon: '🌓', label: theme === 'dark' ? 'Tema Claro' : 'Tema Escuro', action: () => { onClose(); toggleTheme(); } },
    { icon: '📥', label: 'Instalar Aplicativo', action: () => { onClose(); instalarPWA(); } },
    { icon: '🔄', label: t('menu.verificar_atualizacoes'), action: () => { onClose(); onVerificarAtualizacoes(); } },
    { icon: '📤', label: t('menu.compartilhar_app'), action: compartilharApp },
    { icon: '🔒', label: t('menu.politica_privacidade'), action: () => goTo('politica') },
    { icon: '✍️', label: t('menu.configurar_texto'), action: () => { onClose(); setFontModal(true) } },
    { icon: '🌐', label: t('menu.alterar_idioma'), action: () => goTo('idioma') },
  ]

  return (
    <>
      {/* Overlay */}
      <div className={`drawer-overlay${isOpen?' open':''}`} onClick={onClose} />

      {/* Drawer */}
      <div className={`drawer${isOpen?' open':''}`}>
        <div className="drawer-header">
          <img src={BASE_LOGO} alt="MF Logo" className="drawer-logo"
               onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          <span className="drawer-subtitle">Catálogo Digital MF</span>
        </div>
        <div className="drawer-menu">
          {MENU.map((item, i) => (
            <button key={i} className="drawer-item" onClick={item.action}>
              <span className="drawer-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="drawer-footer">
          <span>MF Freios © 2026</span>
          <span>Versão 7.0.0</span>
        </div>
      </div>

      {/* Modal Fonte */}
      {fontModal && (
        <div className="modal-overlay" onClick={() => setFontModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h3>{t('config_texto.titulo')}</h3>
            <div className="font-preview">
              <p style={{ fontSize: `${14 * fontScale}px` }}>Texto de Exemplo ({Math.round(14 * fontScale)}px)</p>
              <p style={{ fontSize: `${16 * fontScale}px`, fontWeight: 700 }}>Título do Produto Exemplo</p>
            </div>
            <div className="font-controls">
              <button className="qty-btn" onClick={() => aplicarFonte(Math.round((fontScale - 0.1) * 10) / 10)}>−</button>
              <div className="font-track">
                {[0.80,0.90,1.00,1.10,1.20,1.30,1.40,1.50].map(v => (
                  <button key={v} className={`font-dot${fontScale===v?' ativo':''}`} onClick={() => aplicarFonte(v)} />
                ))}
              </div>
              <button className="qty-btn" onClick={() => aplicarFonte(Math.round((fontScale + 0.1) * 10) / 10)}>+</button>
            </div>
            <div className="font-pct">{Math.round(fontScale * 100)}%</div>
            <button className="btn-outline-full" onClick={() => setFontModal(false)}>{t('config_texto.fechar')}</button>
          </div>
        </div>
      )}
    </>
  )
}

// ═══════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ═══════════════════════════════════════════════════════════
export default function App() {
  const [tela, setTela] = useState<Tela>('busca')
  const [produtoCodigo, setProdutoCodigo] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [sincMsg, setSincMsg] = useState('')
  const [sincOk, setSincOk] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showSincBanner, setShowSincBanner] = useState(false)
  const [exibirHeaderGlobal, setExibirHeaderGlobal] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mf_theme')
    return (saved === 'dark' || saved === 'light') ? saved : 'light'
  })

  useEffect(() => {
    setExibirHeaderGlobal(true)
  }, [tela])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('mf_theme', theme)
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme(t => t === 'dark' ? 'light' : 'dark')
  }, [])

  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }
  }, [])

  const instalarPWA = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') {
        setDeferredPrompt(null)
      }
    } else {
      window.open(`${import.meta.env.BASE_URL}instalar/`, '_blank')
    }
  }, [deferredPrompt])

  const forcarSincronizacao = useCallback(async () => {
    setShowSincBanner(true)
    setSincOk(false)
    setSincMsg('Verificando atualizações…')
    try {
      const r = await sincronizarCatalogo((pct, msg) => setSincMsg(`${msg} (${pct}%)`))
      setSincOk(true)
      setSincMsg(`✅ Atualizado! ${r.total} produtos carregados (v${r.versao})`)
      setTimeout(() => setShowSincBanner(false), 3000)
    } catch (e) {
      setSincMsg('⚠️ Falha de sincronização. Verifique a internet.')
      setTimeout(() => setShowSincBanner(false), 3000)
    }
  }, [])

  const ABAS: { id: Tela; icon: string }[] = [
    { id: 'busca', icon: '🔍' }, { id: 'figura', icon: '🚛' },
    { id: 'favoritos', icon: '⭐' }, { id: 'orcamento', icon: '📋' }, { id: 'info', icon: '📰' },
    { id: 'lancamentos', icon: '🚀' },
  ]

  const navigate = useCallback((t: Tela, param?: string) => {
    setTela(t)
    if (param) setProdutoCodigo(param)
  }, [])

  const voltar = useCallback(() => {
    setTela('busca'); setProdutoCodigo('')
  }, [])

  // Sincronização e verificação de cadastro inicial
  useEffect(() => {
    async function init() {
      const cadastrado = await isCadastrado()
      if (!cadastrado) {
        setTela('cadastro')
      } else {
        // Validação remota silenciosa de integridade do cadastro
        const dados = await getCadastro()
        if (dados && dados.token_verificacao) {
          try {
            const res = await fetch("https://rldonadon.pythonanywhere.com/api/autenticar", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token_verificacao: dados.token_verificacao })
            })

             if (res.status === 404 || res.status === 403) {
               console.warn("Cadastro revogado ou não localizado no servidor de privacidade. Permitindo acesso com cadastro local offline.");
               // Mantemos o cadastro local e não forçamos recadastro para evitar incômodos ao cliente
             } else if (res.ok) {
              const authData = await res.json()
              if (authData && authData.dados && authData.dados.id) {
                const finalCodigo = String(authData.dados.id).padStart(5, '0');
                if (dados.codigoCadastro !== finalCodigo) {
                  await salvarCadastro({
                    ...dados,
                    codigoCadastro: finalCodigo
                  })
                }
              }
            }
          } catch (netErr) {
            // Erro de rede/timeout: permite entrar usando o cadastro local em modo offline
            console.log("Validação silenciosa offline: usando cache local.", netErr)
          }
        } else {
          // Sem token (cadastro legado): pede recadastro por conformidade LGPD
          console.warn("Cadastro legado detectado. Exigindo recadastro.")
          await resetarCadastro()
          setTela('cadastro')
        }
      }
      const precisa = await precisaAtualizar()
      if (precisa) {
        setShowSincBanner(true)
        try {
          const r = await sincronizarCatalogo((pct, msg) => setSincMsg(`${msg} (${pct}%)`))
          setSincOk(true); setSincMsg(`✅ ${r.total} produtos carregados (v${r.versao})`)
          setTimeout(() => setShowSincBanner(false), 3000)
        } catch (e) {
          setSincMsg('⚠️ Sem dados. Verifique a conexão.')
        }
      }
      setLoading(false)
    }
    init()
  }, [])

  const telas_com_header: Tela[] = ['busca','figura','favoritos','orcamento','info']
  const isAbaPrincipal = telas_com_header.includes(tela)

  if (loading) return (
    <div className="splash">
      <img src={BASE_LOGO} alt="MF" className="splash-logo" onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
      <div className="spinner" /><p>Carregando catálogo…</p>
    </div>
  )

  return (
    <div className="app">
      {/* Header global (apenas abas principais) */}
      {isAbaPrincipal && exibirHeaderGlobal && (
        <header className="app-header">
          <button className="hamburger" onClick={() => setDrawerOpen(true)} aria-label="Menu">☰</button>
          <img src={BASE_LOGO} alt="MF" className="header-logo"
               onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          <div style={{ width: 40 }} />
        </header>
      )}

      {/* Banner de sincronização */}
      {showSincBanner && (
        <div className="sinc-banner">
          <span>🔄</span><span>{sincMsg || 'Atualizando catálogo…'}</span>
          {sincOk && <button className="btn-small" onClick={async () => {
            setShowSincBanner(true); setSincOk(false)
            await sincronizarCatalogo((p, m) => setSincMsg(`${m} (${p}%)`))
            setSincOk(true); setSincMsg('✅ Atualizado!')
            setTimeout(() => setShowSincBanner(false), 2000)
          }}>Forçar</button>}
        </div>
      )}

      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} navigate={navigate} theme={theme} toggleTheme={toggleTheme} instalarPWA={instalarPWA} onVerificarAtualizacoes={forcarSincronizacao} />

      {/* Conteúdo */}
      <main className="app-content">
        {tela === 'busca'      && <TelaBusca navigate={navigate} instalarPWA={instalarPWA} />}
        {tela === 'figura'     && <TelaFigura navigate={navigate} onSubnivelChange={setExibirHeaderGlobal} />}
        {tela === 'favoritos'  && <TelaFavoritos navigate={navigate} />}
        {tela === 'orcamento'  && <TelaOrcamento />}
        {tela === 'info'       && <TelaInfo onSubnivelChange={setExibirHeaderGlobal} />}
        {tela === 'produto'    && <TelaProduto codigo={produtoCodigo} navigate={navigate} onVoltar={voltar} />}
        {tela === 'cadastro'   && <TelaCadastro onVoltar={voltar} />}
        {tela === 'contato'    && <TelaContato onVoltar={voltar} />}
        {tela === 'sobre'      && <TelaSobre onVoltar={voltar} />}
        {tela === 'lancamentos'&& <TelaLancamentos navigate={navigate} onVoltar={voltar} />}
        {tela === 'mensagens'  && <TelaMensagens onVoltar={voltar} />}
        {tela === 'politica'   && <TelaPolitica onVoltar={voltar} />}
        {tela === 'idioma'     && <TelaIdioma onVoltar={voltar} />}
      </main>

      {/* Tab Bar (apenas abas principais) */}
      {isAbaPrincipal && (
        <nav className="tab-bar">
          {ABAS.map(a => (
            <button key={a.id} className={`tab-item${tela===a.id?' ativo':''}`} onClick={() => setTela(a.id)}>
              <span className="tab-icon-wrapper">
                <span className="tab-icon">{a.icon}</span>
                {a.id === 'lancamentos' && (
                  <span className="tab-badge" aria-label="Novo">•</span>
                )}
              </span>
              <span className="tab-label">{t(`tab.${a.id === 'figura' ? 'figura' : a.id === 'info' ? 'info' : a.id}`)}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
