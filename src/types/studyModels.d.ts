export interface StudyDocument {
  id: string;
  filename: string;
  fileType: string;
  fileSize: number;
  fileHash?: string;
  extractionMethod?: "text" | "ocr";
  ocrConfidence?: number | null;
  subject: string;
  userId: string | null;
  text: string;
  chunks: StudyDocumentChunk[];
}

export interface StudyDocumentChunk {
  id: string;
  documentId: string;
  filename: string;
  pageNumber?: string | null;
  chunkOrder: number;
  subject: string;
  userId: string | null;
  text: string;
}

export interface StudyLobbyRoom {
  id: string;
  code: string;
  host_user_id: string;
  status: "active" | "closed" | "expired";
  timer_status: "idle" | "running" | "paused";
  timer_duration_seconds: number;
  timer_remaining_seconds: number;
  timer_started_at?: string | null;
  timer_ends_at?: string | null;
}

export interface StudyLobbyParticipant {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  avatar: string;
  custom_status: string;
  current_action: string;
  is_host: boolean;
  is_online: boolean;
  joined_at: string;
  last_seen_at: string;
}

export interface StudyLobbyMessage {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  body: string;
  created_at: string;
}

export interface StudyLobbyTimerState {
  status: "idle" | "running" | "paused";
  durationSeconds: number;
  remainingSeconds: number;
  startedAt?: string | null;
  endsAt?: string | null;
}
