export interface TTSRequest {
  text: string;
  dialect: string;
  tone: string;
  voiceName: string;
  gender: string;
}

export interface TTSResponse {
  success: boolean;
  audioData: string; // base64
  sampleRate: number;
  voiceFeedback?: string;
  error?: string;
}

export interface DialectOption {
  id: string;
  label: string;
  flag: string;
  description: string;
}

export interface ToneOption {
  id: string;
  label: string;
  icon: string;
  description: string;
}

export interface VoiceOption {
  id: string; // prebuilt voiceName
  label: string;
  gender: 'male' | 'female' | 'neutral';
  description: string;
}

export interface HistoryItem {
  id: string;
  text: string;
  textOriginal?: string;
  dialect: string;
  tone: string;
  voiceName: string;
  gender: string;
  timestamp: string;
  audioData: string; // saved base64 so they can re-listen offline
  duration?: number;
  isMp3?: boolean;
}
