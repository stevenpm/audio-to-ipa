import { useRef, useState } from 'react'
import styles from './SuttterlinReader.module.css'

interface UncertainChar {
  position: string
  options: string[]
  chosen: string
}

interface DecodeResult {
  decoded_text: string
  uncertain_characters: UncertainChar[]
  notes: string
  confidence: 'high' | 'medium' | 'low'
}

type Status = 'idle' | 'decoding' | 'done' | 'error'

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

export default function SuttterlinReader() {
  const [status, setStatus] = useState<Status>('idle')
  const [result, setResult] = useState<DecodeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [showChart, setShowChart] = useState(true)
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
    setStatus('decoding')
    setError(null)
    setResult(null)
    setPreview(URL.createObjectURL(file))

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/decode-sutterlin', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Server error (${res.status})`)
      }
      const data: DecodeResult = await res.json()
      setResult(data)
      setStatus('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Decoding failed.')
      setStatus('error')
    }
  }

  function reset() {
    setStatus('idle')
    setResult(null)
    setError(null)
    setPreview(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className={styles.page}>
      <div className={styles.intro}>
        <h2 className={styles.heading}>Sütterlin Script Decoder</h2>
        <p className={styles.subheading}>
          Upload a scan or photo of a document written in Sütterlin Script. Claude will decode
          it letter by letter using the reference chart below — producing the German text exactly
          as written, without translation.
        </p>
      </div>

      {/* Reference chart */}
      <div className={styles.chartSection}>
        <button className={styles.chartToggle} onClick={() => setShowChart(v => !v)}>
          {showChart ? '▾' : '▸'} Sütterlin Script Reference Chart
        </button>
        {showChart && (
          <div className={styles.chartWrapper}>
            <img
              src="/api/sutterlin-chart"
              alt="Sütterlin Script reference chart showing each letter and its Latin equivalent"
              className={styles.chartImg}
            />
          </div>
        )}
      </div>

      {/* Upload area */}
      {status === 'idle' || status === 'error' ? (
        <>
          <div
            className={styles.dropzone}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
          >
            <span className={styles.dropIcon}>✍️</span>
            <p className={styles.dropText}>Drop a Sütterlin document here, or click to upload</p>
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
      ) : status === 'decoding' ? (
        <div className={styles.decoding}>
          {preview && <img src={preview} className={styles.previewThumb} alt="Document preview" />}
          <div className={styles.decodingText}>
            <span className={styles.spinner} />
            Decoding Sütterlin letter by letter…
            <span className={styles.decodingHint}>This may take 15–30 seconds</span>
          </div>
        </div>
      ) : result ? (
        <div className={styles.results}>
          <div className={styles.resultHeader}>
            <ConfidenceBadge level={result.confidence} />
            <button className={styles.resetBtn} onClick={reset}>Decode another</button>
          </div>

          <div className={styles.panels}>
            {preview && (
              <div className={styles.panel}>
                <div className={styles.panelLabel}>Original Document</div>
                <img src={preview} className={styles.docImage} alt="Original Sütterlin document" />
              </div>
            )}

            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span className={styles.panelLabel}>Decoded German Text</span>
                <CopyBtn text={result.decoded_text} />
              </div>
              <div className={styles.decodedText}>{result.decoded_text}</div>
            </div>
          </div>

          {result.uncertain_characters?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Uncertain Characters</div>
              <div className={styles.uncertainList}>
                {result.uncertain_characters.map((u, i) => (
                  <div key={i} className={styles.uncertainItem}>
                    <span className={styles.uncertainPos}>"{u.position}"</span>
                    <span className={styles.uncertainChosen}>→ chose <strong>{u.chosen}</strong></span>
                    <span className={styles.uncertainOptions}>other option{u.options.length > 1 ? 's' : ''}: {u.options.filter(o => o !== u.chosen).join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.notes && (
            <div className={styles.notes}>
              <span className={styles.notesLabel}>Notes: </span>{result.notes}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
