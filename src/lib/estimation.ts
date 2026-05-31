import type { FeatureChecklist, DiscoveryProcess, EstimationResult } from './types'

const URGENCY_MAP: Record<string, 'high' | 'medium' | 'low'> = {
  '金属片': 'high',
  '骨片': 'high',
  '虫・昆虫': 'medium',
  '毛髪・繊維': 'medium',
  'ゴムパッキン': 'medium',
  '手袋片': 'medium',
  '洗浄スポンジ': 'medium',
  '樹脂片': 'low',
  '炭化物': 'low',
  '木片': 'low',
  '包材フィルム': 'low',
  '香辛料凝集': 'low',
}

export function estimateForeignMaterial(
  features: FeatureChecklist,
  process: DiscoveryProcess
): EstimationResult[] {
  type ScoreEntry = { raw: number; basis: string[] }
  const scores: Record<string, ScoreEntry> = {}
  const categories = Object.keys(URGENCY_MAP)
  categories.forEach((c) => (scores[c] = { raw: 0, basis: [] }))

  const add = (key: string, val: number, reason?: string) => {
    if (!scores[key]) return
    scores[key].raw += val
    if (reason && !scores[key].basis.includes(reason)) scores[key].basis.push(reason)
  }

  const { texture: tx, appearance: ap, color: co, smell: sm, waterTest: wt } = features

  // ゴムパッキン
  if (tx.elastic) add('ゴムパッキン', 40, '弾力あり')
  if (co.black) add('ゴムパッキン', 20, '黒色')
  if (!sm.burnedSmell) add('ゴムパッキン', 8)
  if (wt.sinks) add('ゴムパッキン', 10)
  if (tx.soft) add('ゴムパッキン', 10)
  if (!ap.metallic && !ap.fibrous) add('ゴムパッキン', 5)
  if (process === 'after_packaging' || process === 'before_packaging')
    add('ゴムパッキン', 20, '包装工程')

  // 金属片
  if (ap.metallic) add('金属片', 55, '金属感')
  if (co.metalColor) add('金属片', 30, '金属色')
  if (tx.hard) add('金属片', 20, '固い')
  if (ap.glossy) add('金属片', 12, '光沢')
  if (wt.sinks) add('金属片', 10)

  // 毛髪・繊維
  if (ap.fibrous) add('毛髪・繊維', 55, '繊維状')
  if (co.black || co.brown) add('毛髪・繊維', 12)
  if (wt.sinks) add('毛髪・繊維', 8)
  if (!tx.hard && !tx.elastic) add('毛髪・繊維', 12)

  // 虫・昆虫
  if (tx.crumbly) add('虫・昆虫', 30, '崩れやすい')
  if (co.brown) add('虫・昆虫', 15, '茶色')
  if (co.black) add('虫・昆虫', 10)
  if (ap.fibrous) add('虫・昆虫', 8)
  if (process === 'raw_material_receipt' || process === 'before_heating')
    add('虫・昆虫', 18, '加熱前')

  // 炭化物
  if (sm.burnedSmell) add('炭化物', 42, '焦げ臭')
  if (ap.burned) add('炭化物', 38, '焦げ')
  if (co.black) add('炭化物', 18, '黒色')
  if (process === 'after_heating') add('炭化物', 25, '加熱後')
  if (tx.crumbly) add('炭化物', 10)

  // 樹脂片
  if (ap.bubbly) add('樹脂片', 28, '気泡構造')
  if (ap.layered) add('樹脂片', 22, '層構造')
  if (ap.translucent) add('樹脂片', 18, '半透明')
  if (wt.floats) add('樹脂片', 12)
  if (!sm.burnedSmell) add('樹脂片', 5)

  // 木片
  if (tx.hard && co.brown) add('木片', 32, '固い+茶色')
  if (ap.fibrous && tx.hard) add('木片', 25, '繊維状+固い')
  if (process === 'raw_material_receipt') add('木片', 15, '原料受入')

  // 包材フィルム
  if (ap.translucent && tx.soft) add('包材フィルム', 35, '半透明+柔らかい')
  if (wt.floats) add('包材フィルム', 22, '水に浮く')
  if (process === 'after_packaging') add('包材フィルム', 30, '包装後')
  if (!sm.burnedSmell && !sm.oilSmell) add('包材フィルム', 5)

  // 手袋片
  if (tx.elastic && (ap.translucent || co.white || co.transparent))
    add('手袋片', 42, '弾力+白/透明')
  if (co.white || co.transparent) add('手袋片', 12)
  if (tx.elastic && !co.black) add('手袋片', 15, '弾力あり')

  // 洗浄スポンジ
  if (tx.soft && ap.bubbly) add('洗浄スポンジ', 48, '柔らかい+気泡')
  if (co.green) add('洗浄スポンジ', 32, '緑色')
  if (tx.elastic) add('洗浄スポンジ', 15)
  if (wt.floats) add('洗浄スポンジ', 12)

  // 香辛料凝集
  if (ap.granular) add('香辛料凝集', 32, '粒状')
  if (sm.oilSmell) add('香辛料凝集', 15, '油臭')
  if (tx.crumbly) add('香辛料凝集', 18, '崩れやすい')
  if (co.brown || co.green) add('香辛料凝集', 10)

  // 骨片
  if (tx.hard && co.white) add('骨片', 32, '固い+白色')
  if (wt.sinks) add('骨片', 15)
  if (!ap.metallic) add('骨片', 6)

  const filtered = Object.entries(scores)
    .filter(([, v]) => v.raw > 0)
    .sort((a, b) => b[1].raw - a[1].raw)
    .slice(0, 5)

  const total = filtered.reduce((s, [, v]) => s + v.raw, 0)

  return filtered.map(([category, v]) => ({
    category,
    probability: total > 0 ? Math.round((v.raw / total) * 100) : 0,
    basis: v.basis,
    urgency: URGENCY_MAP[category] ?? 'low',
  }))
}
