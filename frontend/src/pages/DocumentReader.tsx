import { useRef, useState } from 'react'
import styles from './DocumentReader.module.css'

interface IdentifiedTerm {
  term: string
  meaning: string
  context: string
}

interface UncertainReading {
  text: string
  possible_readings: string[]
  reason: string
}

interface GlossaryEntry {
  term: string
  expansion: string | null
  definition: string
  language: string | null
  see_also: string[] | null
}

interface AnalysisResult {
  transcription: string
  translation: string
  document_type: string
  identified_terms: IdentifiedTerm[]
  uncertain_readings: UncertainReading[]
  notes: string
  confidence: 'high' | 'medium' | 'low'
  glossary_entries: GlossaryEntry[]
}

type Status = 'idle' | 'analyzing' | 'done' | 'error'

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  async function copy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button className={styles.copyBtn} onClick={copy}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

function ConfidenceBadge({ level }: { level: string }) {
  const cls = level === 'high' ? styles.badgeHigh : level === 'medium' ? styles.badgeMedium : styles.badgeLow
  return <span className={`${styles.badge} ${cls}`}>{level} confidence</span>
}

export default function DocumentReader() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [expandedGlossary, setExpandedGlossary] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
  }

  async function processFile(file: File) {
    setStatus('analyzing')
    setError(null)
    setResult(null)
    setPreview(URL.createObjectURL(file))

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/analyze-document', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Server error (${res.status})`)
      }
      const data: AnalysisResult = await res.json()
      setResult(data)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setResult(null)
    setError(null)
    setPreview(null)
    setExpandedGlossary(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <h2 className={styles.heading}>WWII German Document Reader</h2>
        <p className={styles.subheading}>
          Upload a scan or photo of a handwritten or typed German document (Kurrent, Sütterlin,
          official records, camp documents). Claude will transcribe, translate, and identify
          abbreviations using the ITS glossary.
        </p>
      </div>

      {status === 'idle' || status === 'error' ? (
        <>
          <div
            className={styles.dropzone}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <span className={styles.dropIcon}>📄</span>
            <p className={styles.dropText}>Drop a document image here, or click to upload</p>
            <p className={styles.dropHint}>JPG, PNG, WEBP — max 20 MB</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif"
              className={styles.fileInput}
              onChange={handleFileChange}
            />
          </div>
          {status === 'error' && (
            <div className={styles.errorBox}>
              <span>⚠</span> {error}
              <button className={styles.retryBtn} onClick={reset}>Try again</button>
            </div>
          )}
        </>
      ) : status === 'analyzing' ? (
        <div className={styles.analyzing}>
          {preview && <img src={preview} className={styles.previewThumb} alt="Document preview" />}
          <div className={styles.analyzingText}>
            <span className={styles.spinner} />
            Analyzing document with Claude…
            <span className={styles.analyzingHint}>This may take 15–30 seconds</span>
          </div>
        </div>
      ) : result ? (
        <div className={styles.results}>
          <div className={styles.resultHeader}>
            <div>
              <span className={styles.docType}>{result.document_type}</span>
              <ConfidenceBadge level={result.confidence} />
            </div>
            <button className={styles.resetBtn} onClick={reset}>Analyze another</button>
          </div>

          <div className={styles.panels}>
            {/* Document preview */}
            {preview && (
              <div className={styles.panel}>
                <div className={styles.panelLabel}>Original Document</div>
                <img src={preview} className={styles.docImage} alt="Original document" />
              </div>
            )}

            {/* Transcription */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelLabel}>Transcription</span>
                <CopyBtn text={result.transcription} />
              </div>
              <div className={styles.panelText}>{result.transcription}</div>
            </div>

            {/* Translation */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelLabel}>English Translation</span>
                <CopyBtn text={result.translation} />
              </div>
              <div className={styles.panelText}>{result.translation}</div>
            </div>
          </div>

          {/* Identified terms */}
          {result.identified_terms?.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Identified Terms & Abbreviations</h3>
              <div className={styles.termsList}>
                {result.identified_terms.map((t, i) => (
                  <div key={i} className={styles.termCard}>
                    <div className={styles.termHeader}>
                      <span className={styles.termText}>{t.term}</span>
                      <CopyBtn text={t.term} />
                    </div>
                    <div className={styles.termMeaning}>{t.meaning}</div>
                    {t.context && <div className={styles.termContext}>{t.context}</div>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Uncertain readings */}
          {result.uncertain_readings?.length > 0 && (
            <div className={styles.section}>
              <h3 className={styles.sectionTitle}>Uncertain Readings</h3>
              <div className={styles.termsList}>
                {result.uncertain_readings.map((u, i) => (
                  <div key={i} className={styles.uncertainCard}>
                    <span className={styles.termText}>"{u.text}"</span>
                    <div className={styles.termMeaning}>
                      Possible: {u.possible_readings.join(' / ')}
                    </div>
                    <div className={styles.termContext}>{u.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {result.notes && (
            <div className={styles.notes}>
              <span className={styles.notesLabel}>Notes: </span>{result.notes}
            </div>
          )}

          {/* Full glossary matches */}
          {result.glossary_entries?.length > 0 && (
            <div className={styles.section}>
              <button
                className={styles.glossaryToggle}
                onClick={() => setExpandedGlossary(v => !v)}
              >
                {expandedGlossary ? '▾' : '▸'} ITS Glossary entries for identified terms ({result.glossary_entries.length})
              </button>
              {expandedGlossary && (
                <div className={styles.glossaryList}>
                  {result.glossary_entries.map((g, i) => (
                    <div key={i} className={styles.glossaryEntry}>
                      <div className={styles.glossaryTerm}>
                        {g.term}
                        {g.expansion && <span className={styles.glossaryExpansion}> — {g.expansion}</span>}
                      </div>
                      <div className={styles.glossaryDef}>{g.definition}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
