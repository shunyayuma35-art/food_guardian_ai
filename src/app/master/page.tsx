'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/context/AuthContext'
import { useLang } from '@/context/LanguageContext'
import Navigation from '@/components/Navigation'
import UsageGuide from '@/components/UsageGuide'
import toast from 'react-hot-toast'
import { getMasters, saveMasters, type MasterData } from '@/lib/firestore'

type DeviceEntry = MasterData['devices'][number]

export default function MasterPage() {
  const { user, loading } = useAuth()
  const { t } = useLang()
  const router = useRouter()
  const [masters, setMasters] = useState<MasterData>({ staff: [], products: [], devices: [] })
  const [saving, setSaving] = useState(false)

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
      toast.success(t('toast.saved') + ' ✅')
    } catch {
      toast.error(t('toast.failed'))
    } finally {
      setSaving(false)
    }
  }

  function addStaff() {
    const v = newStaff.trim()
    if (!v || masters.staff.includes(v)) { toast.error(t('master.duplicate')); return }
    save({ ...masters, staff: [...masters.staff, v] })
    setNewStaff('')
  }
  function removeStaff(name: string) {
    save({ ...masters, staff: masters.staff.filter((s) => s !== name) })
  }

  function addProduct() {
    const v = newProduct.trim()
    if (!v || masters.products.includes(v)) { toast.error(t('master.enterName')); return }
    save({ ...masters, products: [...masters.products, v] })
    setNewProduct('')
  }
  function removeProduct(name: string) {
    save({ ...masters, products: masters.products.filter((p) => p !== name) })
  }

  function addDevice() {
    const v = newDevice.name.trim()
    if (!v) { toast.error(t('master.enterDeviceName')); return }
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
          <h1 className="font-extrabold text-gray-800 text-base">{t('master.title')}</h1>
          <span className="text-xs text-purple-600 bg-purple-50 font-bold px-3 py-1 rounded-full">{t('master.badge')}</span>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-5 py-5 space-y-5">
        <UsageGuide
          title={t('master.guide.title')}
          color="purple"
          steps={[
            { icon: '👤', title: t('master.guide.step1.title'), desc: t('master.guide.step1.desc') },
            { icon: '📦', title: t('master.guide.step2.title'), desc: t('master.guide.step2.desc') },
            { icon: '🔧', title: t('master.guide.step3.title'), desc: t('master.guide.step3.desc') },
            { icon: '💾', title: t('master.guide.step4.title'), desc: t('master.guide.step4.desc') },
          ]}
          tips={[t('master.guide.tip1'), t('master.guide.tip2')]}
        />
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-3">
          <p className="text-xs text-purple-700 font-medium">{t('master.info')}</p>
        </div>

        {/* Staff */}
        <div className="card p-4">
          <p className="section-title">
            {t('master.staff.title')}
            {' '}<span className="text-gray-400 font-normal text-xs">
              ({masters.staff.length}{t('master.unit.staff')})
            </span>
          </p>
          <div className="flex gap-2 mb-3">
            <input value={newStaff} onChange={(e) => setNewStaff(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addStaff()}
              className="input-field flex-1" placeholder={t('master.staff.placeholder')} />
            <button onClick={addStaff} disabled={saving}
              className="px-4 py-2 bg-purple-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-purple-600 transition-all">
              {t('master.staff.addBtn')}
            </button>
          </div>
          {masters.staff.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">{t('master.staff.empty')}</p>
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

        {/* Products */}
        <div className="card p-4">
          <p className="section-title">
            {t('master.product.title')}
            {' '}<span className="text-gray-400 font-normal text-xs">
              ({masters.products.length}{t('master.unit.products')})
            </span>
          </p>
          <div className="flex gap-2 mb-3">
            <input value={newProduct} onChange={(e) => setNewProduct(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addProduct()}
              className="input-field flex-1" placeholder={t('master.product.placeholder')} />
            <button onClick={addProduct} disabled={saving}
              className="px-4 py-2 bg-purple-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-purple-600 transition-all">
              {t('master.product.addBtn')}
            </button>
          </div>
          {masters.products.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">{t('master.product.empty')}</p>
          ) : (
            <div className="space-y-1.5">
              {masters.products.map((name) => (
                <div key={name} className="flex items-center justify-between bg-purple-50 border border-purple-100 rounded-xl px-3 py-2">
                  <span className="text-sm font-medium text-gray-800">📦 {name}</span>
                  <button onClick={() => removeProduct(name)}
                    className="text-xs text-gray-400 hover:text-red-500 font-bold transition-colors">{t('master.deleteBtn')}</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Devices */}
        <div className="card p-4">
          <p className="section-title">
            {t('master.device.title')}
            {' '}<span className="text-gray-400 font-normal text-xs">
              ({masters.devices.length}{t('master.unit.devices')})
            </span>
          </p>
          <div className="space-y-2 mb-3">
            <input value={newDevice.name} onChange={(e) => setNewDevice({ ...newDevice, name: e.target.value })}
              className="input-field" placeholder={t('master.device.namePlaceholder')} />
            <div className="grid grid-cols-2 gap-2">
              <select value={newDevice.type} onChange={(e) => setNewDevice({ ...newDevice, type: e.target.value as 'metal_detector' | 'xray' })}
                className="input-field text-sm">
                <option value="metal_detector">{t('master.device.typeMetal')}</option>
                <option value="xray">{t('master.device.typeXray')}</option>
              </select>
              <input value={newDevice.line ?? ''} onChange={(e) => setNewDevice({ ...newDevice, line: e.target.value })}
                className="input-field text-sm" placeholder={t('master.device.linePlaceholder')} />
            </div>
            <button onClick={addDevice} disabled={saving}
              className="w-full py-2.5 bg-purple-500 text-white text-sm font-bold rounded-xl disabled:opacity-50 hover:bg-purple-600 transition-all">
              {t('master.device.addBtn')}
            </button>
          </div>
          {masters.devices.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">{t('master.device.empty')}</p>
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
                      {dev.type === 'metal_detector' ? t('insp.device.metalDetector') : t('insp.device.xray')}
                    </span>
                  </div>
                  <button onClick={() => removeDevice(idx)}
                    className="text-xs text-gray-400 hover:text-red-500 font-bold transition-colors">{t('master.deleteBtn')}</button>
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
