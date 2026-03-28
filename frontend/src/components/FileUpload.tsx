import { useRef, useState } from 'react'
import type { AppStatus } from '../types'
import styles from './FileUpload.module.css'

interface Props {
  onFileSelected: (file: File) => void
  status: AppStatus
}

const ACCEPT = '.mp3,.wav,.flac,.m4a,.ogg'

export default function FileUpload({ onFileSelected, status }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const disabled = status === 'processing' || status === 'recording'

  function handleFile(file: File) {
    setSelectedFile(file)
  }

  function handleConvert() {
    if (selectedFile) onFileSelected(selectedFile)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    if (!disabled) setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''
  }

  return (
    <div className={styles.wrapper}>
      <div
        className={[
          styles.dropzone,
          isDragging ? styles.dragging : '',
          disabled ? styles.disabled : '',
        ].join(' ')}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className={styles.hiddenInput}
          onChange={handleInputChange}
          disabled={disabled}
        />
        <div className={styles.icon}>&#127925;</div>
        {selectedFile ? (
          <p className={styles.filename}>{selectedFile.name}</p>
        ) : (
          <>
            <p className={styles.label}>Drop an audio file here</p>
            <p className={styles.sublabel}>or click to browse</p>
            <p className={styles.formats}>MP3 · WAV · FLAC · M4A · OGG</p>
          </>
        )}
      </div>

      {selectedFile && status !== 'processing' && (
        <button className={styles.convertBtn} onClick={handleConvert} disabled={disabled}>
          Convert to IPA
        </button>
      )}

      {status === 'processing' && (
        <div className={styles.processing}>
          <span className={styles.spinner} />
          Processing audio…
        </div>
      )}
    </div>
  )
}
