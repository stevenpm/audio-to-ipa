export interface TranscribeResponse {
  transcript: string;
  ipa: string;
  language: string;
  language_name: string;
}

export type AppStatus = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export interface AppState {
  status: AppStatus;
  result: TranscribeResponse | null;
  errorMessage: string | null;
}

export type AppAction =
  | { type: 'START_PROCESSING' }
  | { type: 'SET_RECORDING'; recording: boolean }
  | { type: 'SUCCESS'; result: TranscribeResponse }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };
