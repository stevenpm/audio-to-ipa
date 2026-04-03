import styles from './Nav.module.css'

export type Page = 'ipa' | 'document' | 'sutterlin'

interface Props {
  activePage: Page
  onNavigate: (page: Page) => void
}

export default function Nav({ activePage, onNavigate }: Props) {
  return (
    <nav className={styles.nav}>
      <button
        className={`${styles.tab} ${activePage === 'ipa' ? styles.active : ''}`}
        onClick={() => onNavigate('ipa')}
      >
        Audio → IPA
      </button>
      <button
        className={`${styles.tab} ${activePage === 'document' ? styles.active : ''}`}
        onClick={() => onNavigate('document')}
      >
        Document Reader
      </button>
      <button
        className={`${styles.tab} ${activePage === 'sutterlin' ? styles.active : ''}`}
        onClick={() => onNavigate('sutterlin')}
      >
        Sütterlin Script
      </button>
    </nav>
  )
}
