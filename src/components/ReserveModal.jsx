import { useState } from 'react'
import { patchVehicleFields } from '../lib/sanityData'
import { linesToReservationConditions } from '../lib/reservationConditions'
import { Lock, X, Plus } from 'lucide-react'

const inputClass = 'w-full px-4 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:ring-2 focus:ring-amber-500 focus:border-transparent'
const labelClass = 'block text-sm font-medium text-zinc-400 mb-1'

const MAX_CONDITIONS = 15

export function ReserveModal({ vehicle, onClose, onSuccess }) {
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    deposit_amount: '0',
    deposit_agreement_url: '',
    carplay_included: false,
    reserved_date: new Date().toISOString().slice(0, 10),
    conditionLines: [''],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  const updateConditionLine = (idx, value) =>
    setForm((f) => ({
      ...f,
      conditionLines: f.conditionLines.map((line, i) => (i === idx ? value : line)),
    }))

  const addConditionLine = () => {
    setForm((f) => {
      if (f.conditionLines.length >= MAX_CONDITIONS) return f
      return { ...f, conditionLines: [...f.conditionLines, ''] }
    })
  }

  const removeConditionLine = (idx) => {
    setForm((f) => {
      if (f.conditionLines.length <= 1) return { ...f, conditionLines: [''] }
      return { ...f, conditionLines: f.conditionLines.filter((_, i) => i !== idx) }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.customer_name?.trim()) {
      setError('Customer name is required')
      return
    }
    if (!form.customer_email?.trim()) {
      setError('Customer email is required')
      return
    }
    if (!form.customer_phone?.trim()) {
      setError('Customer phone is required')
      return
    }
    setLoading(true)
    try {
      const pickupToken = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      const reservation_conditions = linesToReservationConditions(form.conditionLines)
      const payload = {
        reserved: true,
        sold: false,
        vehicle_status: 'Reserved',
        reserved_date: form.reserved_date || new Date().toISOString().slice(0, 10),
        deposit_amount: parseFloat(form.deposit_amount) || 0,
        customer_name: form.customer_name.trim(),
        customer_email: form.customer_email.trim(),
        customer_phone: form.customer_phone.trim(),
        deposit_agreement_url: form.deposit_agreement_url?.trim() || null,
        carplay_included: form.carplay_included,
        buyers_name: form.customer_name.trim(),
        pickup_token: pickupToken,
        reservation_conditions,
      }
      await patchVehicleFields(vehicle.id, payload)
      onSuccess?.()
      onClose?.()
    } catch (err) {
      setError(err.message || 'Failed to reserve')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md max-h-[90vh] rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col">
        <div className="shrink-0 px-4 py-3 border-b border-zinc-800 bg-amber-500/10 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-amber-400 flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Reserve vehicle
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <p className="text-sm text-zinc-400">
            <span className="font-semibold text-white">{vehicle.brand} {vehicle.model}</span>
            {vehicle.stock_id && <span className="text-zinc-500"> · Stock #{vehicle.stock_id}</span>}
          </p>
          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
          )}
          <div>
            <label className={labelClass}>Customer name *</label>
            <input
              type="text"
              value={form.customer_name}
              onChange={(e) => update('customer_name', e.target.value)}
              placeholder="Full name"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Customer email *</label>
            <input
              type="email"
              value={form.customer_email}
              onChange={(e) => update('customer_email', e.target.value)}
              placeholder="customer@example.com"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Customer phone *</label>
            <input
              type="tel"
              value={form.customer_phone}
              onChange={(e) => update('customer_phone', e.target.value)}
              placeholder="e.g. 07700 900000"
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Deposit amount (£)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.deposit_amount}
              onChange={(e) => update('deposit_amount', e.target.value)}
              placeholder="0 if none"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Reserved date</label>
            <input
              type="date"
              value={form.reserved_date}
              onChange={(e) => update('reserved_date', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Deposit agreement URL</label>
            <input
              type="url"
              value={form.deposit_agreement_url}
              onChange={(e) => update('deposit_agreement_url', e.target.value)}
              placeholder="Link to signed agreement (optional)"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Reservation conditions (optional)</label>
            <p className="text-xs text-zinc-500 mb-2">
              Note anything the customer should expect before handover — e.g. minor bodywork, parts on order.
            </p>
            <div className="space-y-2">
              {form.conditionLines.map((line, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={line}
                    onChange={(e) => updateConditionLine(i, e.target.value)}
                    placeholder={`Condition ${i + 1}`}
                    className={`flex-1 ${inputClass}`}
                  />
                  <div className="flex gap-1 shrink-0">
                    {form.conditionLines.length < MAX_CONDITIONS && i === form.conditionLines.length - 1 && (
                      <button
                        type="button"
                        onClick={addConditionLine}
                        className="px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-zinc-950"
                        aria-label="Add condition"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => removeConditionLine(i)}
                      className="px-3 py-2 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-300"
                      aria-label="Remove condition"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.carplay_included}
                onChange={(e) => update('carplay_included', e.target.checked)}
                className="rounded border-zinc-600 text-amber-500"
              />
              <span className="text-zinc-300 text-sm">CarPlay included</span>
            </label>
          </div>
        </div>
        <div className="shrink-0 p-4 border-t border-zinc-800 bg-zinc-900/95 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-zinc-600 text-zinc-400 hover:bg-zinc-800 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold transition disabled:opacity-50"
          >
            {loading ? 'Reserving...' : 'Reserve'}
          </button>
        </div>
        </form>
      </div>
    </div>
  )
}
