// 一度だけ実行するデモデータ投入スクリプト
// Usage: node scripts/seed-demo.mjs
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// .env.local を手動パース
const envPath = resolve(__dirname, '../.env.local')
const envVars = {}
try {
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    envVars[key] = val
  }
} catch {
  console.error('.env.local が見つかりません')
  process.exit(1)
}

const supabaseUrl = envVars['NEXT_PUBLIC_SUPABASE_URL']
const serviceRoleKey = envVars['SUPABASE_SERVICE_ROLE_KEY']

if (!supabaseUrl || !serviceRoleKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceRoleKey)

const incidents = [
  {
    title: 'かつおの骨混入',
    location: '製造ライン',
    description: '製品中にかつおの骨が混入。サイズ：54.2mm×0.4mm。フィレ加工工程での選別漏れが原因と推定。フィレ機の刃の摩耗状態を確認し、金属探知機通過後の目視点検体制を強化した。',
    status: 'resolved',
  },
  {
    title: '海老足混入',
    location: '製造ライン',
    description: '製品内に海老の足が混入。剥き海老処理ライン上での選別漏れが原因。エビむき機のメッシュ目詰まりを確認し、ライン上の目視検査員を増員して対応。',
    status: 'resolved',
  },
  {
    title: 'パレット破片混入',
    location: '製造エリア',
    description: '赤いパレットの破片（7.5mm）が製品に混入。パレットの劣化・欠けが原因。目視点検強化および破損パレットの即時廃棄ルールを制定して再発防止。',
    status: 'investigating',
  },
  {
    title: 'ビニール破片混入',
    location: '製造ライン',
    description: 'ビニール片（7.8mm）が製品に混入。包装フィルムまたはトレー由来と推定。ラインのフィルムカッター周辺を点検し、フィルム品質管理基準を見直し中。',
    status: 'resolved',
  },
  {
    title: '金属ワッシャー混入（並塩）',
    location: '原材料',
    description: '原材料の並塩中に約7mmΦの金属ワッシャーが混入。ダイヤソルト崎戸工場からの納入原材料に起因。仕入先に是正措置を要求し、受入検査に金属探知機スクリーニングを追加した。',
    status: 'resolved',
  },
  {
    title: '添加物かたまり混入',
    location: '製造ライン',
    description: '水に溶ける添加物のかたまりが製品に混入。添加物の溶解工程での不完全溶解が原因と推定。溶解温度・攪拌時間の管理基準を改定し、溶解確認フローを工程に組み込んだ。',
    status: 'resolved',
  },
]

async function seed() {
  console.log('🌱 デモインシデントを Supabase に投入中...\n')
  let ok = 0
  let ng = 0
  for (const incident of incidents) {
    const { data, error } = await supabase
      .from('incidents')
      .insert([incident])
      .select()
      .single()
    if (error) {
      console.error(`❌ 失敗: ${incident.title} — ${error.message}`)
      ng++
    } else {
      console.log(`✅ 登録: ${incident.title} (id: ${data.id})`)
      ok++
    }
  }
  console.log(`\n完了: 成功 ${ok}件 / 失敗 ${ng}件`)
}

seed().catch(console.error)
