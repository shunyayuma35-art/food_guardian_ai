'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import toast from 'react-hot-toast'
import { getMasters, saveMasters, type MasterData } from '@/lib/firestore'

type DeviceEntry = MasterData['devices'][number]

const DEVICE_TYPE_LABELS = { metal_detector: '金属探知機', xray: 'X線検査機' } as const

export default function MasterPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [masters, setMasters] = useState<MasterData>({ staff: [], products: [], devices: [] })
  const [saving, setSaving] = useState(false)

  // 入力用
  const [newStaff, setNewStaff] = useState('')
  const [newProduct, setNewProduct] = useState('')
  const [newDevice, setNewDevice] = useState<DeviceEntry>({ name: '', type: 'metal_detector', line: '' })

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [user, loading, router])

  useEffect(() => {
    getMasters()
      .then((d) => setMasters(d))
      .catch(console.error)
  }, [])

  async function save(updated: MasterData) {
    setSaving(true)
    try {
      await saveMasters(updated)
      setMasters(updated)
      toast.success('保存しました ✅')
    } catch {
      toast.error('保存に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  function addStaff() {
    const v = newStaff.trim()
    if (!v || masters.staff.includes(v)) { toast.error('重複または空の名前です'); return }
    save({ ...masters, staff: [...masters.staff, v] })
    setNewStaff('')
  }
  function removeStaff(name: string) {
    save({ ...masters, staff: masters.staff.filter((s) => s !== name) })
  }

  function addProduct() {
    const v = newProduct.trim()
    if (!v || masters.products.includes(v)) { toast.error('重複または空の製品名です'); return }
    save({ ...masters, products: [...masters.products, v] })
    setNewProduct('')
  }
  function removeProduct(name: string) {
    save({ ...masters, products: masters.products.filter((p) => p !== name) })
  }

  function addDevice() {
    const v = newDevice.name.trim()
    if (!v) { toast.error('機器名を入力してください'); return }
    save({ ...masters, devices: [...masters.devices, { ...newDevice, name: v, line: newDevice.line?.trim() || undefined }] })
    setNewDevice({ name: '', type: 'metal_detector', line: '' })
  }
  function removeDevice(idx: number) {
    save({ ...masters, devices: masters.devices.filter((_, i) => i !== idx) })
  }

  if (loading || !user) {
    return <div className="min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-purple-400 border-t-transparent rounded-full animate-spin" />
    </div>
  }

  return (
    <div className="min-h-screen pb-28">
      <header className="bg-white/85 backdrop-blur-xl border-b border-purple-100 shadow-sm px-5 py-4 sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <button onClick={() => router.push('/')} className="back-btn">←</button>
          <h1 className="font-extrabold text-gray-800 text-base">マスターデータ管理</h1>
          <span className="text-xs text-purple-600 bg-purple-50 font-bold px-3 py-1 rounded-full">設定</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">
        <UsageGuide
          title="📖 マスターデータの使い方"
          color="purple"
          steps={[
            { icon: '👤', title: '担当者を登録する', desc: '工場の担当者・スタッフの名前を登録します。登録後は異物登録・検査記録の担当者欄で選択できるようになります。' },
            { icon: '📦', title: '製品を登録する', desc: '取り扱う製品名を登録します。登録後は各画面の製品名欄で選択できるようになり、入力ミス・表記ゆれを防げます。' },
            { icon: '🔧', title: '検査機器を登録する', desc: '工場の金属探知機・X線検査機の名前・ライン番号を登録します。検査記録登録時にドロップダウンから選択できます。' },
            { icon: '💾', title: '追加したら自動保存される', desc: '「追加」ボタンを押すと即座に保存されます。削除する場合は各アイテムの「削除」ボタンを押してください。' },
          ]}
          tips={[
            '最初にここで担当者・製品・機器を全て登録しておくと、毎日の入力がとても速くなります',
            '担当者が増えた・機器が追加された場合はいつでも追加できます',
          ]}
        />
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3">
          <p className="text-xs text-purple-700 font-medium">
            ここで登録した担当者・製品名・検査機器は、各登録フォームでドロップダウン選択できます。
            毎回手入力が不要になり、入力ミス・表記ゆれを防げます。
          </p>
        </div>

        {/* ── 担当者マスター ── */}
        <div className="card p-4">
          <p className="section-title">👤 担当者マスター <span className="text-gray-400 font-normal text-xs">({masters.staff.length}名)</span></p>
          <div className="flex gap-2 mb-3">
            <input value={newStaff} onChange={(e) => setNewStaff(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStaff()}
              className="input-field flex-1" placeholder="例: 山田 太郎" />
            <button onClick={addStaff} disabled={saving}
              className="px-4 py-2 bg-purple-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-purple-600 transition-all">
              追加
            </button>
          </div>
          {masters.staff.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">担当者が登録されていません</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {masters.staff.map((name) => (
                <span key={name}
                  className="flex items-center gap-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-3 py-1 text-sm font-semibold">
                  {name}
                  <button onClick={() => removeStaff(name)}
                    className="text-purple-400 hover:text-red-500 font-bold leading-none transition-colors">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* ── 製品マスター ── */}
        <div className="card p-4">
          <p className="section-title">📦 製品マスター <span className="text-gray-400 font-normal text-xs">({masters.products.length}件)</span></p>
          <div className="flex gap-2 mb-3">
            <input value={newProduct} onChange={(e) => setNewProduct(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProduct()}
              className="input-field flex-1" placeholder="例: 万能ごま 220g" />
            <button onClick={addProduct} disabled={saving}
              className="px-4 py-2 bg-purple-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-purple-600 transition-all">
              追加
            </button>
          </div>
          {masters.products.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">製品が登録されていません</p>
          ) : (
            <div className="space-y-1.5">
              {masters.products.map((name) => (
                <div key={name} className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">📦 {name}</span>
                  <button onClick={() => removeProduct(name)}
                    className="text-xs text-gray-400 hover:text-red-500 font-bold transition-colors">削除</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── 機器マスター ── */}
        <div className="card p-4">
          <p className="section-title">🔧 検査機器マスター <span className="text-gray-400 font-normal text-xs">({masters.devices.length}台)</span></p>
          <div className="space-y-2 mb-3">
            <input value={newDevice.name} onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
              className="input-field" placeholder="機器名 例: 1号金属探知機" />
            <div className="grid grid-cols-2 gap-2">
              <select value={newDevice.type} onChange={(e) => setNewDevice({ ...newDevice, type: e.target.value as 'metal_detector' | 'xray' })}
                className="input-field text-sm">
                <option value="metal_detector">🧲 金属探知機</option>
                <option value="xray">☢️ X線検査機</option>
              </select>
              <input value={newDevice.line ?? ''} onChange={(e) => setNewDevice({ ...newDevice, line: e.target.value })}
                className="input-field text-sm" placeholder="ライン例: 1ライン" />
            </div>
            <button onClick={addDevice} disabled={saving}
              className="w-full py-2.5 bg-purple-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-purple-600 transition-all">
              機器を追加
            </button>
          </div>
          {masters.devices.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">機器が登録されていません</p>
          ) : (
            <div className="space-y-1.5">
              {masters.devices.map((dev, idx) => (
                <div key={idx} className="flex items-center justify-between bg-teal-50 border border-teal-100 rounded-xl px-3 py-2">
                  <div>
                    <span className="text-sm font-bold text-gray-800">
                      {dev.type === 'metal_detector' ? '🧲' : '☢️'} {dev.name}
                    </span>
                    {dev.line && <span className="ml-2 text-xs text-gray-500">{dev.line}</span>}
                    <span className="ml-2 text-[10px] text-teal-600 bg-teal-100 px-1.5 py-0.5 rounded-full font-semibold">
                      {DEVICE_TYPE_LABELS[dev.type]}
                    </span>
                  </div>
                  <button onClick={() => removeDevice(idx)}
                    className="text-xs text-gray-400 hover:text-red-500 font-bold transition-colors">削除</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Navigation />
    </div>
  )
}
