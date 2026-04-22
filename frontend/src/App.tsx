import { useReducer, useState } from 'react'
import type { AppAction, AppState, TranscribeResponse } from './types'
import FileUpload from './components/FileUpload'
import MicRecorder from './components/MicRecorder'
import TextInput from './components/TextInput'
import IPADisplay from './components/IPADisplay'
import Nav from './components/Nav'
import type { Page } from './components/Nav'
import DocumentReader from './pages/DocumentReader'
import SuttterlinReader from './pages/SuttterlinReader'
import styles from './App.module.css'

const initialState: AppState = {
  status: 'idle',
  result: null,
  errorMessage: null,
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'START_PROCESSING':
      return { ...state, status: 'processing', errorMessage: null }
    case 'SET_RECORDING':
      return { ...state, status: action.recording ? 'recording' : 'idle' }
    case 'SUCCESS':
      return { status: 'done', result: action.result, errorMessage: null }
    case 'ERROR':
      return { status: 'error', result: null, errorMessage: action.message }
    case 'RESET':
      return initialState
    default:
      return state
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('ipa')
  const [state, dispatch] = useReducer(reducer, initialState)

  async function processFile(file: File) {
    dispatch({ type: 'START_PROCESSING' })

    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Server error (${res.status})`)
      }
      const result: TranscribeResponse = await res.json()
      dispatch({ type: 'SUCCESS', result })
    } catch (err) {
      dispatch({ type: 'ERROR', message: err instanceof Error ? err.message : 'An unknown error occurred.' })
    }
  }

  function handleFileSelected(file: File) {
    processFile(file)
  }

  function handleRecordingComplete(blob: Blob) {
    const ext = blob.type.includes('ogg') ? 'ogg' : 'webm'
    const file = new File([blob], `recording.${ext}`, { type: blob.type })
    processFile(file)
  }

  async function processText(text: string) {
    dispatch({ type: 'START_PROCESSING' })
    try {
      const res = await fetch('/api/phonemize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language: 'en' }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.detail ?? `Server error (${res.status})`)
      }
      const result: TranscribeResponse = await res.json()
      dispatch({ type: 'SUCCESS', result })
    } catch (err) {
      dispatch({ type: 'ERROR', message: err instanceof Error ? err.message : 'An unknown error occurred.' })
    }
  }

  const showReset = state.status === 'done' || state.status === 'error'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>ScriptBridge</h1>
        <p className={styles.subtitle}>
          Phonetics, historical documents, and handwriting — decoded
        </p>
      </header>

      <main className={styles.main}>
        <Nav activePage={page} onNavigate={setPage} />

        {page === 'document' ? (
          <DocumentReader />
        ) : page === 'sutterlin' ? (
          <SuttterlinReader />
        ) : (
          <>
            <section className={styles.inputSection}>
              <TextInput onTextSubmit={processText} status={state.status} />
              <div className={styles.divider}>
                <span>or</span>
              </div>
              <div className={styles.audioRow}>
                <FileUpload onFileSelected={handleFileSelected} status={state.status} />
                <div className={styles.dividerVertical}>
                  <span>or</span>
                </div>
                <MicRecorder onRecordingComplete={handleRecordingComplete} status={state.status} />
              </div>
            </section>

            {(state.status !== 'idle') && (
              <section className={styles.outputSection}>
                <IPADisplay
                  result={state.result}
                  status={state.status}
                  errorMessage={state.errorMessage}
                />
                {showReset && (
                  <button className={styles.resetBtn} onClick={() => dispatch({ type: 'RESET' })}>
                    Start over
                  </button>
                )}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  )
}
