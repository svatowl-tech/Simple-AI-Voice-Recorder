export interface AudioRecording {
  id: string;
  title: string;
  date: number; // Timestamp
  duration: number; // Seconds
  blob?: Blob; // Not stored in LocalStorage, retrieved from IndexedDB
  status: 'recorded' | 'processing_stt' | 'transcribed' | 'processing_ai' | 'analyzed' | 'error';
  transcription?: string;
  summary?: string;
  tasks?: string[];
  keyPoints?: string[];
}

export interface PolzaTranscribeResponse {
  text: string;
  language: string;
  duration: number;
  segments: any[];
  model: string;
}

export interface AIAnalysisResult {
  summary: string;
  tasks: string[];
  keyPoints: string[];
}

export enum Tab {
  RECORD = 'record',
  LIST = 'list',
  SETTINGS = 'settings'
}

export const POLZA_MODELS = [
  { id: 'qwen/qwen3-30b-a3b-thinking-2507', name: 'Qwen 3 (30B Thinking) - Рекомендуемая' },
  { id: 'meta-llama/llama-4-scout', name: 'Llama 4 Scout' },
  { id: 'amazon/nova-lite-v1', name: 'Amazon Nova Lite' },
  { id: 'google/gemini-2.0-flash-lite-001', name: 'Gemini 2.0 Flash Lite' },
  { id: 'mistralai/devstral-2512', name: 'Mistral Devstral' }
];

export const POLZA_STT_MODELS = [
  { id: 'gpt-4o-mini-transcribe', name: 'GPT-4o Mini (Быстрая, эконом) - 0.308₽/мин' },
  { id: 'whisper-1', name: 'Whisper-1 (Баланс) - 0.564₽/мин' },
  { id: 'gpt-4o-transcribe', name: 'GPT-4o Transcribe (Высокое качество) - 0.564₽/мин' }
];

export const DEFAULT_MODEL = 'qwen/qwen3-30b-a3b-thinking-2507';
export const DEFAULT_STT_MODEL = 'gpt-4o-mini-transcribe';