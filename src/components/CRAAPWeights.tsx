'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const DIMENSIONS = [
  { key: 'currency', label: 'Currency' },
  { key: 'relevance', label: 'Relevance' },
  { key: 'authority', label: 'Authority' },
  { key: 'completeness', label: 'Completeness' },
  { key: 'purpose', label: 'Purpose' },
]

interface Props {
  projectId: string
  initialWeights: Record<string, number>
}

export default function CRAAPWeights({ projectId, initialWeights }: Props) {
  const [weights, setWeights] = useState(initialWeights)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [open, setOpen] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  async function handleSave() {
    setSaving(true)
    await supabase.from('projects').update({ craap_weights: weights }).eq('id', projectId)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
      >
        CRAAP Weights
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">CRAAP Dimension Weights</h3>
            <p className="text-sm text-gray-500 mb-6">
              Adjust how much each dimension contributes to the weighted total score. Default is 1.0 for each. Use 2.0 to double the impact of a dimension.
            </p>

            <div className="space-y-4 mb-6">
              {DIMENSIONS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="text-sm font-medium text-gray-700 w-28">{label}</span>
                  <input
                    type="range"
                    min={0.5}
                    max={3}
                    step={0.5}
                    value={weights[key] ?? 1}
                    onChange={e => setWeights({ ...weights, [key]: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-sm font-semibold text-gray-900 w-8 text-right">
                    ×{weights[key] ?? 1}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-xs text-gray-400 mb-5">
              Max weighted score: {DIMENSIONS.reduce((sum, d) => sum + 10 * (weights[d.key] ?? 1), 0).toFixed(0)} pts
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                {saved ? 'Done' : 'Cancel'}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Weights'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
