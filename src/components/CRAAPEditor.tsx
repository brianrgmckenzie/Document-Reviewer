'use client'

const DIMENSIONS = [
  { key: 'craap_purpose',      short: 'purpose',      label: 'Purpose',    letter: 'P', description: 'The reason the information exists. Is it intended to inform, teach, sell, entertain, or persuade?', color: '#4f7cff' },
  { key: 'craap_authority',    short: 'authority',    label: 'Authority',  letter: 'A', description: 'The source of the information. Check the author\'s credentials and the publisher\'s reputation.', color: '#9b7dff' },
  { key: 'craap_relevance',    short: 'relevance',    label: 'Relevance',  letter: 'R', description: 'The importance of the information for your specific needs. Does it answer your question and fit your topic?', color: '#ff4d4d' },
  { key: 'craap_completeness', short: 'completeness', label: 'Currency',   letter: 'C', description: 'The timeliness of the information. Check publication dates and if the information is updated.', color: '#2dd88a' },
  { key: 'craap_currency',     short: 'currency',     label: 'Accuracy',   letter: 'A', description: 'The reliability and truthfulness of the content. Is it supported by evidence and peer-reviewed?', color: '#f5a623' },
] as const

type CRAAPKey = typeof DIMENSIONS[number]['key']

interface Props {
  scores: Record<CRAAPKey, number>
  weights: Record<string, number>
  aiScores?: Record<string, number> | null
  onChange: (scores: Record<CRAAPKey, number>) => void
}

function parcaColor(total: number) {
  const pct = total / 50
  if (pct >= 0.7) return 'var(--success)'
  if (pct >= 0.45) return 'var(--warning)'
  return 'var(--risk)'
}

export default function CRAAPEditor({ scores, weights, aiScores, onChange }: Props) {
  function update(key: CRAAPKey, value: number) {
    onChange({ ...scores, [key]: value })
  }

  const rawTotal = DIMENSIONS.reduce((sum, d) => sum + (scores[d.key] ?? 5), 0)
  const weightedTotal = DIMENSIONS.reduce((sum, d) => {
    const w = weights[d.short] ?? 1
    return sum + (scores[d.key] ?? 5) * w
  }, 0)
  const maxWeighted = DIMENSIONS.reduce((sum, d) => {
    const w = weights[d.short] ?? 1
    return sum + 10 * w
  }, 0)

  return (
    <div>
      {/* Top row: total score + mini grid */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Total PARCA Score</p>
          <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, fontSize: 42, color: parcaColor(rawTotal), lineHeight: 1 }}>
            {rawTotal}
          </span>
          <span style={{ fontFamily: 'var(--font-space-mono)', fontSize: 18, color: 'var(--text-muted)', fontWeight: 400 }}>/50</span>
          {maxWeighted !== 50 && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Weighted: <span style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-space-mono)' }}>{weightedTotal.toFixed(1)}/{maxWeighted.toFixed(0)}</span>
            </p>
          )}
        </div>

        {/* Mini score grid */}
        <div className="flex gap-1.5">
          {DIMENSIONS.map(d => {
            const score = scores[d.key] ?? 5
            return (
              <div key={d.key} className="flex flex-col items-center justify-center rounded-lg" style={{
                width: 40, height: 48,
                background: `${d.color}18`,
                border: `1px solid ${d.color}33`,
              }}>
                <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, fontSize: 11, color: d.color }}>{d.letter}</span>
                <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{score}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Dimension sliders */}
      <div className="space-y-5">
        {DIMENSIONS.map(({ key, short, label, letter, description, color }) => {
          const score = scores[key] ?? 5
          const weight = weights[short] ?? 1
          const aiScore = aiScores?.[short]
          const isAdjusted = aiScore != null && score !== aiScore
          const pct = (score / 10) * 100

          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center justify-center rounded text-xs font-bold" style={{
                    width: 22, height: 22, background: `${color}22`,
                    border: `1px solid ${color}44`, color, fontFamily: 'var(--font-space-mono)',
                  }}>{letter}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontFamily: 'var(--font-space-grotesk)', fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{label}</span>
                      {weight !== 1 && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>×{weight}</span>
                      )}
                      {aiScore != null && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={isAdjusted
                          ? { background: 'var(--accent-dim)', color: 'var(--accent)' }
                          : { background: 'var(--surface-3)', color: 'var(--text-muted)' }
                        }>
                          {isAdjusted ? `Adjusted (AI: ${aiScore})` : 'AI'}
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{description}</p>
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-space-mono)', fontWeight: 700, fontSize: 18, color, minWidth: 28, textAlign: 'right' }}>
                  {score}
                </span>
              </div>

              {/* Slider */}
              <div style={{ position: 'relative' }}>
                <div style={{ height: 4, borderRadius: 2, background: 'var(--surface-3)' }}>
                  <div style={{
                    width: `${pct}%`, height: '100%', borderRadius: 2,
                    background: `linear-gradient(90deg, ${color}88, ${color})`,
                    transition: 'width 0.1s',
                  }} />
                </div>
                <input
                  type="range" min={1} max={10} value={score}
                  onChange={e => update(key, Number(e.target.value))}
                  style={{
                    position: 'absolute', inset: 0, opacity: 0,
                    cursor: 'pointer', width: '100%', height: '100%',
                    margin: 0,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
