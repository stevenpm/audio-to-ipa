import { useEffect, useRef, useState } from 'react'
import type { AppStatus } from '../types'
import styles from './MicRecorder.module.css'

interface Props {
  onRecordingComplete: (blob: Blob) => void
  status: AppStatus
}

export default function MicRecorder({ onRecordingComplete, status }: Props) {
  const [isRecording, setIsRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [permissionError, setPermissionError] = useState<string | null>(null)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const disabled = status === 'processing'

  if (!window.MediaRecorder) {
    return (
      <p className={styles.unsupported}>
        Microphone recording is not supported in this browser.
      </p>
    )
  }

  async function startRecording() {
    setPermissionError(null)
    chunksRef.current = []

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setPermissionError('Microphone access denied. Please allow microphone permissions.')
      return
    }

    const recorder = new MediaRecorder(stream)
    recorderRef.current = recorder

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
      onRecordingComplete(blob)
    }

    recorder.start()
    setIsRecording(true)
    setElapsed(0)
    timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)
  }

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop()
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function formatTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className={styles.wrapper}>
      {permissionError && <p className={styles.error}>{permissionError}</p>}

      {isRecording ? (
        <div className={styles.recording}>
          <span className={styles.dot} />
          <span className={styles.timer}>{formatTime(elapsed)}</span>
          <button className={styles.stopBtn} onClick={stopRecording}>
            Stop Recording
          </button>
        </div>
      ) : (
        <button
          className={styles.recordBtn}
          onClick={startRecording}
          disabled={disabled}
        >
          <span className={styles.micIcon}>&#127908;</span>
          <span className={styles.recordLabel}>Record from Microphone</span>
          <span className={styles.recordHint}>Click to start recording</span>
        </button>
      )}
    </div>
  )
}
