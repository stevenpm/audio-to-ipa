import { useState } from 'react'
import type { AppStatus } from '../types'
import styles from './TextInput.module.css'

interface Props {
  onTextSubmit: (text: string) => void
  status: AppStatus
}

export default function TextInput({ onTextSubmit, status }: Props) {
  const [value, setValue] = useState('')
  const disabled = status === 'processing' || status === 'recording'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = value.trim()
    if (trimmed) onTextSubmit(trimmed)
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.label} htmlFor="text-input">
        Type a name or phrase
      </label>
      <div className={styles.row}>
        <input
          id="text-input"
          className={styles.input}
          type="text"
          placeholder="e.g. Siobhan, Nguyen, Søren…"
          value={value}
          onChange={e => setValue(e.target.value)}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          className={styles.btn}
          type="submit"
          disabled={disabled || !value.trim()}
        >
          Convert
        </button>
      </div>
    </form>
  )
}
