export interface StudyDocument {
  id: string;
  databaseId?: string;
  persisted?: boolean;
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
  databaseId?: string;
  persisted?: boolean;
  documentId: string;
  filename: string;
  pageNumber?: string | null;
  chunkOrder: number;
  subject: string;
  userId: string | null;
  text: string;
}
