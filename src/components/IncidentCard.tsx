'use client'

import Link from 'next/link'
import type { Incident } from '@/lib/types'
import { DISCOVERY_PROCESS_LABELS, DISCOVERY_PROCESS_LABELS_EN, INCIDENT_STATUS_LABELS } from '@/lib/types'
import { generateIncidentCode, formatDateTime } from '@/lib/utils'
import { useLang } from '@/context/LanguageContext'

interface Props {
  incident: Incident
}

const STATUS_CLASS: Record<string, string> = {
  open: 'badge-open',
  investigating: 'badge-investigating',
  closed: 'badge-closed',
}

const URGENCY_ICON: Record<string, string> = {
  high: '🔴',
  medium: '🟠',
  low: '🟡',
}

const URGENCY_BAR_COLOR: Record<string, string> = {
  high: 'bg-red-400',
  medium: 'bg-orange-400',
  low: 'bg-yellow-400',
}

export default function IncidentCard({ incident }: Props) {
  const { t, lang } = useLang()
  const isEn = lang === 'en'

  // 優先順: ①確定名 → ②AI Vision → ③ルールベース
  const aiEst = incident.estimations?.find(e => e.source === 'ai_vision') ?? null
  const ruleEst = incident.estimations?.find(e => e.source !== 'ai_vision') ?? incident.estimations?.[0] ?? null
  const hasConfirmed = !!incident.confirmedName

  type DisplayMode = 'confirmed' | 'ai' | 'rule' | 'none'
  let displayMode: DisplayMode = 'none'
  let displayName = ''
  let displayUrgency: string | null = null

  if (hasConfirmed) {
    displayMode = 'confirmed'
    displayName = incident.confirmedName!
    displayUrgency = (aiEst ?? ruleEst)?.urgency ?? null
  } else if (aiEst) {
    displayMode = 'ai'
    displayName = (isEn ? aiEst.nameEn : aiEst.name) || aiEst.category
    displayUrgency = aiEst.urgency
  } else if (ruleEst) {
    displayMode = 'rule'
    displayName = ruleEst.category
    displayUrgency = ruleEst.urgency
  }

  const urgencyForIcon = displayUrgency
  const statusClass = STATUS_CLASS[incident.status] ?? 'badge-open'
  const urgencyIcon = urgencyForIcon ? (URGENCY_ICON[urgencyForIcon] ?? '⚪') : ''
  const barColor = urgencyForIcon ? (URGENCY_BAR_COLOR[urgencyForIcon] ?? 'bg-orange-400') : 'bg-orange-400'

  const urgencyLabel = (u: string) =>
    isEn
      ? (u === 'high' ? 'High' : u === 'medium' ? 'Medium' : 'Low')
      : (u === 'high' ? '高' : u === 'medium' ? '中' : '低')
  const urgencyChipColor = (u: string) =>
    u === 'high' ? 'bg-red-100 text-red-700' :
    u === 'medium' ? 'bg-orange-100 text-orange-700' :
    'bg-yellow-100 text-yellow-700'

  return (
    <Link href={`/record/${incident.id}`}>
      <div className="card p-4 hover:shadow-[0_4px_24px_rgba(251,146,60,0.15)] hover:border-orange-200 transition-all active:scale-[0.99]">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            {urgencyIcon && <span className="text-base">{urgencyIcon}</span>}
            <span className="font-mono text-xs text-gray-400">
              {generateIncidentCode(incident.id)}
            </span>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${statusClass}`}>
            {INCIDENT_STATUS_LABELS[incident.status]}
          </span>
        </div>

        <p className="font-bold text-gray-800 text-base truncate">
          {incident.productName || t('common.noProductName')}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-500">
          {incident.lotNumber && (
            <span>
              {isEn ? 'Lot: ' : 'ロット: '}<span className="text-gray-700 font-medium">{incident.lotNumber}</span>
            </span>
          )}
          {incident.factory && (
            <span>
              {isEn ? 'Factory: ' : '工場: '}<span className="text-gray-700 font-medium">{incident.factory}</span>
            </span>
          )}
          {incident.discoveryProcess && (
            <span className="text-gray-500">
              {(isEn ? DISCOVERY_PROCESS_LABELS_EN : DISCOVERY_PROCESS_LABELS)[incident.discoveryProcess] ?? incident.discoveryProcess}
            </span>
          )}
        </div>

        {displayMode !== 'none' && (
          <div className="mt-2.5 flex items-center gap-2 flex-wrap">
            {/* バッジ */}
            {displayMode === 'confirmed' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 shrink-0">
                ✅{isEn ? 'Confirmed' : '確定'}
              </span>
            )}
            {displayMode === 'ai' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200 shrink-0">
                🤖AI
              </span>
            )}
            {displayMode === 'rule' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200 shrink-0">
                {isEn ? 'Est.' : '参考'}
              </span>
            )}

            {/* 異物名 */}
            <span className="text-xs font-semibold text-orange-700 truncate flex-1 min-w-0">
              {displayName}
            </span>

            {/* 信頼度または確率バー */}
            {displayMode === 'rule' && ruleEst ? (
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-16 bg-orange-50 rounded-full h-2 overflow-hidden">
                  <div className={`h-full ${barColor} rounded-full`} style={{ width: `${ruleEst.probability}%` }} />
                </div>
                <span className="text-xs text-gray-500">{ruleEst.probability}%</span>
              </div>
            ) : displayUrgency ? (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 ${urgencyChipColor(displayUrgency)}`}>
                {urgencyLabel(displayUrgency)}
              </span>
            ) : null}
          </div>
        )}

        <p className="text-xs text-gray-400 mt-2">{formatDateTime(incident.createdAt)}</p>
      </div>
    </Link>
  )
}
