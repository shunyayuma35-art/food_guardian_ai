'use client'

import Link from 'next/link'
import type { Incident } from '@/lib/types'
import { DISCOVERY_PROCESS_LABELS, INCIDENT_STATUS_LABELS } from '@/lib/types'
import { generateIncidentCode, formatDateTime } from '@/lib/utils'

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
  const topEst = incident.estimations?.[0]
  const statusClass = STATUS_CLASS[incident.status] ?? 'badge-open'
  const urgencyIcon = topEst ? (URGENCY_ICON[topEst.urgency] ?? '⚪') : ''
  const barColor = topEst ? (URGENCY_BAR_COLOR[topEst.urgency] ?? 'bg-orange-400') : 'bg-orange-400'

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
          {incident.productName || '商品名未記入'}
        </p>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-sm text-gray-500">
          {incident.lotNumber && (
            <span>
              ロット: <span className="text-gray-700 font-medium">{incident.lotNumber}</span>
            </span>
          )}
          {incident.factory && (
            <span>
              工場: <span className="text-gray-700 font-medium">{incident.factory}</span>
            </span>
          )}
          <span className="text-gray-500">{DISCOVERY_PROCESS_LABELS[incident.discoveryProcess]}</span>
        </div>

        {topEst && (
          <div className="mt-2.5 flex items-center gap-2">
            <div className="flex-1 bg-orange-50 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full ${barColor} rounded-full transition-all`}
                style={{ width: `${topEst.probability}%` }}
              />
            </div>
            <span className="text-xs text-orange-600 font-semibold whitespace-nowrap">
              {topEst.category} {topEst.probability}%
            </span>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-2">{formatDateTime(incident.createdAt)}</p>
      </div>
    </Link>
  )
}
