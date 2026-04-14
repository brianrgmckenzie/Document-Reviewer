'use client'

const DIMENSIONS = [
  { key: 'craap_currency', label: 'Currency', description: 'How current and timely is this document?' },
  { key: 'craap_relevance', label: 'Relevance', description: 'How relevant to the engagement scope?' },
  { key: 'craap_authority', label: 'Authority', description: 'How authoritative is the source?' },
  { key: 'craap_completeness', label: 'Completeness', description: 'How complete and whole is this document?' },
  { key: 'craap_purpose', label: 'Purpose', description: 'How clearly does it inform this engagement?' },
] as const

type CRAAPKey = typeof DIMENSIONS[number]['key']

interface Props {
  scores: Record<CRAAPKey, number>
  weights: Record<string, number>
  onChange: (scores: Record<CRAAPKey, number>) => void
}

function scoreColor(score: number) {
  if (score >= 8) return 'text-green-600'
  if (score >= 5) return 'text-amber-600'
  return 'text-red-500'
}

function scoreBarColor(score: number) {
  if (score >= 8) return 'bg-green-500'
  if (score >= 5) return 'bg-amber-400'
  return 'bg-red-400'
}

export default function CRAAPEditor({ scores, weights, onChange }: Props) {
  function update(key: CRAAPKey, value: number) {
    onChange({ ...scores, [key]: value })
  }

  const rawTotal = DIMENSIONS.reduce((sum, d) => sum + (scores[d.key] ?? 5), 0)
  const weightedTotal = DIMENSIONS.reduce((sum, d) => {
    const w = weights[d.key.replace('craap_', '')] ?? 1
    return sum + (scores[d.key] ?? 5) * w
  }, 0)
  const maxWeighted = DIMENSIONS.reduce((sum, d) => {
    const w = weights[d.key.replace('craap_', '')] ?? 1
    return sum + 10 * w
  }, 0)

  return (
    <div>
      <div className="space-y-4 mb-5">
        {DIMENSIONS.map(({ key, label, description }) => {
          const score = scores[key] ?? 5
          const weight = weights[key.replace('craap_', '')] ?? 1
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <div>
                  <span className="text-sm font-medium text-gray-700">{label}</span>
                  {weight !== 1 && (
                    <span className="ml-2 text-xs text-gray-400">×{weight} weight</span>
                  )}
                  <p className="text-xs text-gray-400">{description}</p>
                </div>
                <span className={`text-xl font-bold w-10 text-right ${scoreColor(score)}`}>
                  {score}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={score}
                  onChange={e => update(key, Number(e.target.value))}
                  className="flex-1"
                />
                <div className="w-20 bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${scoreBarColor(score)}`}
                    style={{ width: `${(score / 10) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="border-t border-gray-100 pt-4 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          Raw total: <span className="font-semibold text-gray-700">{rawTotal}/50</span>
        </div>
        {maxWeighted !== 50 && (
          <div className="text-sm text-gray-500">
            Weighted: <span className="font-semibold text-gray-700">{weightedTotal.toFixed(1)}/{maxWeighted.toFixed(0)}</span>
          </div>
        )}
        <div className={`text-lg font-bold ${scoreColor(rawTotal / 5)}`}>
          CRAAP: {rawTotal}/50
        </div>
      </div>
    </div>
  )
}
