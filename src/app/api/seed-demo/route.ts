import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DEMO_INCIDENTS = [
  {
    title: 'かつおの骨混入',
    location: '製造ライン',
    description: 'かつおの骨。長さ約54.2mm。3種混合製品より発見。フィレ加工工程での選別漏れが原因と推定。フィレ機の刃の摩耗状態を確認し、金属探知機通過後の目視点検体制を強化した。',
    status: 'resolved',
  },
  {
    title: '海老足混入',
    location: '製造ライン',
    description: '海老の足が製品内に混入。橙赤色・細い・曲がり。剥き海老処理ライン上での選別漏れが原因。エビむき機のメッシュ目詰まりを確認し、目視検査員を増員して対応。',
    status: 'resolved',
  },
  {
    title: '赤いパレット破片混入',
    location: '製造エリア',
    description: '赤い合成繊維状パレット破片。サイズ17.5mm。パレットの劣化・欠けが原因。破損パレットの即時廃棄ルールを制定。目視点検強化中。',
    status: 'investigating',
  },
  {
    title: 'ビニール破片混入',
    location: '製造ライン',
    description: 'ビニール破片。サイズ7.8mm。半透明。包装フィルムまたはトレー由来と推定。ラインのフィルムカッター周辺を点検し、フィルム品質管理基準を見直し中。',
    status: 'resolved',
  },
  {
    title: '金属ワッシャー混入（並塩）',
    location: '原材料（並塩）',
    description: '約7mmφのワッシャー。原材料の並塩に混入の可能性。ダイヤソルト崎戸工場からの納入原材料に起因。仕入先に是正措置を要求し、受入検査に金属探知機スクリーニングを追加した。',
    status: 'resolved',
  },
  {
    title: 'イエバエ混入',
    location: '製造エリア',
    description: '黒色ハエ。体長約8mm。製造エリアで発見。翅2枚・複眼・6脚の特徴からイエバエと推定。排水溝・窓からの侵入を疑い、防虫対策を強化中。',
    status: 'investigating',
  },
  {
    title: 'カボス棒混入',
    location: '製造ライン',
    description: 'カボスの棒状部位。植物由来。原料カボス処理工程での混入と推定。選別ラインの目詰まり確認と手選別強化で再発防止。',
    status: 'resolved',
  },
  {
    title: '添加物かたまり混入',
    location: '製造ライン',
    description: '添加物のかたまり。水に溶けることを確認。不完全溶解が原因と推定。溶解温度・攪拌時間の管理基準を改定し、溶解確認フローを工程に組み込んだ。',
    status: 'resolved',
  },
  {
    title: '毛髪混入',
    location: '製造エリア',
    description: '黒色毛髪。異物特定・混入経路調査中。作業員の毛髪か動物毛か確認中。ヘアキャップ着用徹底と入室チェック強化を実施。',
    status: 'investigating',
  },
  {
    title: 'ゴム片混入',
    location: '製造ライン',
    description: '黒色ゴム片。機械部品由来の可能性。ラインの各ゴム製パーツ（Oリング・ガスケット）の点検実施中。',
    status: 'investigating',
  },
]

export async function GET() {
  // 環境変数を直接読み込み（モジュールレベルのsupabaseAdminに依存しない）
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // 診断: env vars が存在するか確認
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({
      error: 'Missing environment variables',
      diagnosis: {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? '✅ set' : '❌ missing',
        SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey ? '✅ set' : '❌ missing',
        hint: 'Vercelダッシュボード → Settings → Environment Variables に追加してから再デプロイしてください',
      },
    }, { status: 500 })
  }

  // Supabase クライアントをこのルート内で直接生成
  const db = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  // 疎通確認
  try {
    const { error: pingError } = await db.from('incidents').select('id').limit(1)
    if (pingError) {
      return NextResponse.json({
        error: 'Supabase connection failed',
        detail: pingError.message,
        hint: 'SUPABASE_SERVICE_ROLE_KEY が正しいか、Supabaseプロジェクトが一時停止されていないか確認してください',
      }, { status: 500 })
    }
  } catch (connErr) {
    return NextResponse.json({
      error: 'Supabase unreachable',
      detail: String(connErr),
      hint: 'NEXT_PUBLIC_SUPABASE_URL が正しいか確認してください',
    }, { status: 500 })
  }

  const results: { title: string; status: string; id?: number; error?: string }[] = []

  for (const incident of DEMO_INCIDENTS) {
    try {
      // 同タイトルが既に存在する場合はスキップ
      const { data: existing } = await db
        .from('incidents')
        .select('id')
        .eq('title', incident.title)
        .maybeSingle()

      if (existing) {
        results.push({ title: incident.title, status: 'skipped', id: existing.id })
        continue
      }

      const { data, error } = await db
        .from('incidents')
        .insert([incident])
        .select()
        .single()

      if (error) {
        results.push({ title: incident.title, status: 'error', error: error.message })
      } else {
        results.push({ title: incident.title, status: 'inserted', id: data.id })
      }
    } catch (err) {
      results.push({ title: incident.title, status: 'error', error: String(err) })
    }
  }

  const inserted = results.filter(r => r.status === 'inserted').length
  const skipped  = results.filter(r => r.status === 'skipped').length
  const errors   = results.filter(r => r.status === 'error').length

  return NextResponse.json({
    ok: errors === 0,
    summary: `挿入: ${inserted}件 / スキップ: ${skipped}件 / エラー: ${errors}件`,
    results,
  })
}
