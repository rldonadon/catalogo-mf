// Configurações centrais do PWA
// Token carregado via variável de ambiente (nunca commitado)
export const GITHUB_IMG_TOKEN = import.meta.env.VITE_GITHUB_IMG_TOKEN as string ?? ''
export const GITHUB_IMG_REPO  = 'rldonadon/Catalogo_Imagens_MF'

// URL base do repositório de imagens
export const IMG_BASE = `https://raw.githubusercontent.com/${GITHUB_IMG_REPO}/main`

// Catálogo de dados (JSON publicado pelo MRP)
export const CATALOGO_JSON_URL = 'https://raw.githubusercontent.com/rldonadon/catalogo-mf/main/public/catalogo.json'

// Índice de imagens
export const IMG_INDEX_URL = `${IMG_BASE}/imagens_index.json`

// Webhook Google Apps Script
export const WEBHOOK_URL = 'https://script.google.com/macros/s/AKfycbzfUaKjlhk3o75R76sC8EGK_gTudci4JFzzccirRji0dpLt782doMaBqDclQCe_xY08/exec'

// WhatsApp
export const WHATSAPP_NUMS = [
  { label: '(16) 99731-0205', url: 'https://wa.me/5516997310205' },
  { label: '(16) 99646-1443', url: 'https://wa.me/5516996461443' },
]
export const TELEFONES = [
  { label: '(16) 3243-3222', tel: '1632433222' },
  { label: '(16) 3243-3233', tel: '1632433233' },
  { label: '(16) 3245-5261', tel: '1632455261' },
  { label: '(16) 3242-8635', tel: '1632428635' },
]
export const EMAILS_CONTATO = [
  'vendas.mffreios@gmail.com',
  'vendas1.mffreios@gmail.com',
]
export const ENDERECO = {
  logradouro: 'Av. Dr. José de Paula Eduardo, nº 180',
  bairro: 'Distrito Industrial',
  cidade: 'Monte Alto - SP',
  cep: 'CEP: 15910-458',
  mapsUrl: 'https://www.google.com/maps/search/Av.+Dr.+José+de+Paula+Eduardo+180+Monte+Alto+SP',
}

// Mapa de grupos → arquivos de figura
export const MAPA_FIGURAS: Record<string, string> = {
  'pedal': 'img_pedal',
  'manetim': 'img_manetim',
  'regulador': 'img_regulador',
  'secador': 'img_secador',
  '4 circuitos': 'img_4circuitos',
  '4 circuitos apu': 'img_4circuitos_apu',
  'apm': 'img_apm',
  'e-apu': 'img_e_apu',
  'descarga': 'img_descarga',
  'servo': 'img_servo',
  'servo freio': 'img_servo_freio',
  'cambio': 'img_cambio',
  'piloto': 'img_piloto',
  'compressor': 'img_compressor',
  'distribuidora': 'img_distribuidora',
  'cuica': 'img_cuica',
  'diafragma': 'img_diafragma',
  'rele': 'img_rele',
  'niveladora': 'img_niveladora',
  'sensivel carga': 'img_sensivel_carga',
  'fluxo': 'img_fluxo',
  'suspensao': 'img_suspensao',
  'freio a disco': 'img_freio_disco',
  '2 vias': 'img_2vias',
  'carretas': 'img_carretas',
  'conexao': 'img_conexao',
  'valvula': 'img_valvula',
  'drenagem': 'img_drenagem',
  'retencao': 'img_retencao',
  'solenoide': 'img_solenoide',
}

// Sistemas para Por Figura
export const SISTEMAS_FIGURA = [
  {
    label: 'Freios Dianteiros',
    desc: 'Pedal, manetim, reguladores, secador, compressores e servos',
    icon: '🚛',
    grupos: ['pedal', 'manetim', 'regulador', 'secador', '4 circuitos', '4 circuitos apu', 'apm', 'e-apu', 'descarga', 'servo', 'servo freio', 'cambio', 'piloto', 'compressor'],
  },
  {
    label: 'Freios Traseiros',
    desc: 'Descarga, distribuidora, cuícas, diafragmas, relés e niveladoras',
    icon: '🚚',
    grupos: ['descarga', 'distribuidora', 'cuica', 'diafragma', 'rele', 'niveladora', 'sensivel carga', 'fluxo', 'suspensao', 'freio a disco', '2 vias'],
  },
  {
    label: 'Semi-reboque / Carreta',
    desc: 'Carretas, conexões e válvulas de acoplamento',
    icon: '🔗',
    grupos: ['carretas', 'conexao', 'valvula'],
  },
]
