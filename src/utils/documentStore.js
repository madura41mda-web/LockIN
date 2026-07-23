const LOCAL_DOCUMENTS_KEY = "lockin_processed_documents";

function safeParse(value, fallback) {
  try {
    return JSON.parse(value) || fallback;
  } catch (error) {
    console.error("Failed to parse stored processed documents:", error);
    return fallback;
  }
}

export function saveProcessedDocumentsLocal(userId, documents) {
  const key = `${LOCAL_DOCUMENTS_KEY}_${userId || "anon"}`;
  const existing = safeParse(localStorage.getItem(key), []);
  const next = [...documents, ...existing].slice(0, 50);
  localStorage.setItem(key, JSON.stringify(next));
}

export function findProcessedDocumentLocal(userId, fileHash) {
  if (!fileHash) return null;
  const key = `${LOCAL_DOCUMENTS_KEY}_${userId || "anon"}`;
  const existing = safeParse(localStorage.getItem(key), []);
  return existing.find((document) => document.fileHash === fileHash) || null;
}

export function removeProcessedDocumentLocal(userId, { documentId, fileHash }) {
  const key = `${LOCAL_DOCUMENTS_KEY}_${userId || "anon"}`;
  const existing = safeParse(localStorage.getItem(key), []);
  const next = existing.filter((document) => {
    if (documentId && document.id === documentId) return false;
    if (fileHash && document.fileHash === fileHash) return false;
    return true;
  });
  localStorage.setItem(key, JSON.stringify(next));
}

export async function saveProcessedDocumentsSupabase(supabase, documents) {
  const remoteDocuments = documents.filter((document) => document.userId);
  if (remoteDocuments.length === 0) return { saved: false, error: null };

  const documentRows = remoteDocuments.map((document) => ({
    id: document.id,
    user_id: document.userId,
    filename: document.filename,
    file_type: document.fileType,
    file_size: document.fileSize,
    file_hash: document.fileHash,
    extraction_method: document.extractionMethod,
    ocr_confidence: document.ocrConfidence,
    subject: document.subject,
    extracted_text: document.text,
    chunk_count: document.chunks.length,
  }));

  const chunkRows = remoteDocuments.flatMap((document) =>
    document.chunks.map((chunk) => ({
      id: chunk.id,
      document_id: document.id,
      user_id: chunk.userId,
      filename: chunk.filename,
      page_number: chunk.pageNumber,
      chunk_order: chunk.chunkOrder,
      subject: chunk.subject,
      content: chunk.text,
    }))
  );

  const documentResult = await supabase.from("study_documents").upsert(documentRows);
  if (documentResult.error) return { saved: false, error: documentResult.error };

  const chunkResult = await supabase.from("study_document_chunks").upsert(chunkRows);
  if (chunkResult.error) return { saved: false, error: chunkResult.error };

  return { saved: true, error: null };
}
