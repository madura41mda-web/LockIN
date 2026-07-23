export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const MAX_OCR_UPLOAD_BYTES = 12 * 1024 * 1024;
export const MAX_GENERATION_BATCH_CHARS = 11000;
export const SUPPORTED_UPLOAD_EXTENSIONS = new Set(["txt", "md", "pdf", "pptx"]);

function makeId(prefix) {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function fileExtension(fileName) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

export function validateStudyFile(file) {
  if (!file) throw new Error("No file was selected.");
  if (file.size === 0) throw new Error(`${file.name} is empty.`);
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name} is larger than 25 MB. Split it into smaller files and upload again.`);
  }

  const ext = fileExtension(file.name);
  const isPdf = file.type === "application/pdf" || ext === "pdf";
  const isText = file.type === "text/plain" || ext === "txt" || ext === "md";
  const isPptx = ext === "pptx";

  if (ext === "ppt") {
    throw new Error(`${file.name}: legacy .ppt files are not readable yet. Export it as .pptx and upload again.`);
  }

  if (!isPdf && !isText && !isPptx) {
    throw new Error(`${file.name}: unsupported file type. Upload PDF, PPTX, TXT, or MD notes.`);
  }

  return { ext, isPdf, isText, isPptx };
}

export function cleanExtractedText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, lines) => line || lines[index - 1])
    .join("\n")
    .trim();
}

export function cleanOcrText(text) {
  return cleanExtractedText(text)
    .replace(/[|]{2,}/g, " ")
    .replace(/[_]{3,}/g, " ")
    .replace(/\b(?:page|fig|figure)\s*\d+\s*$/gim, "")
    .replace(/\n(?:\s*\d+\s*){3,}\n/g, "\n")
    .trim();
}

export function normalizeStudyContent(text) {
  const seenLines = new Set();
  return cleanOcrText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => {
      if (!line) return true;
      if (/^#\s+.+\.(pdf|pptx?|txt|md)$/i.test(line)) return false;
      if (/^\[[^\]]+\]$/.test(line) && seenLines.has(line.toLowerCase())) return false;
      const normalized = line.toLowerCase().replace(/\s+/g, " ");
      if (normalized.length > 18 && seenLines.has(normalized)) return false;
      if (normalized.length > 18) seenLines.add(normalized);
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function isLowTextPdfExtraction(pages) {
  if (!Array.isArray(pages) || pages.length === 0) return true;
  const readablePages = pages.filter((page) => cleanExtractedText(page.text).length >= 80).length;
  const totalTextLength = pages.reduce((sum, page) => sum + cleanExtractedText(page.text).length, 0);
  return totalTextLength < 500 || readablePages / pages.length < 0.35;
}

export async function hashArrayBuffer(arrayBuffer) {
  const hashInput = arrayBuffer.slice(0);
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return `${hashInput.byteLength}_${Date.now()}`;
  }
  const digest = await crypto.subtle.digest("SHA-256", hashInput);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function splitOversizedParagraph(paragraph, targetSize) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [paragraph];
  const chunks = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length > targetSize && current) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

export function splitTextIntoChunks(text, { targetSize = 3600, overlap = 450 } = {}) {
  const cleaned = cleanExtractedText(text);
  if (!cleaned) return [];

  const blocks = cleaned.split(/\n{2,}/).flatMap((block) => {
    if (block.length <= targetSize) return [block];
    return splitOversizedParagraph(block, targetSize);
  });

  const chunks = [];
  let current = "";
  let lastSeenPage = null;
  let currentPage = null;

  for (const block of blocks) {
    const pageMatch = block.match(/^\[(?:PAGE|SLIDE)\s+([^\]]+)\]/i);
    const blockPage = pageMatch ? pageMatch[1].trim() : lastSeenPage;
    if (pageMatch) lastSeenPage = blockPage;

    const next = current ? `${current}\n\n${block}` : block;
    if (next.length > targetSize && current) {
      chunks.push({ text: current, pageNumber: currentPage });
      const tail = current.slice(Math.max(0, current.length - overlap));
      current = tail ? `${tail}\n\n${block}` : block;
      currentPage = blockPage;
    } else {
      current = next;
      if (!currentPage) currentPage = blockPage;
    }
  }

  if (current) chunks.push({ text: current, pageNumber: currentPage });
  return chunks.map((chunk, index) => ({ ...chunk, chunkOrder: index + 1 }));
}

export function buildProcessedDocument({ file, rawText, subject, userId, fileHash, extractionMethod = "text", ocrConfidence = null }) {
  const cleanedText = extractionMethod === "ocr" ? cleanOcrText(rawText) : cleanExtractedText(rawText);
  if (!cleanedText) {
    throw new Error(`${file.name}: no readable academic text could be extracted.`);
  }

  const chunks = splitTextIntoChunks(cleanedText);
  if (chunks.length === 0) {
    throw new Error(`${file.name}: text extraction did not produce usable chunks.`);
  }

  const documentId = makeId("doc");
  return {
    id: documentId,
    filename: file.name,
    fileType: fileExtension(file.name),
    fileSize: file.size,
    fileHash,
    extractionMethod,
    ocrConfidence,
    subject: subject || "Full Document",
    userId: userId || null,
    text: cleanedText,
    chunks: chunks.map((chunk) => ({
      id: makeId("chunk"),
      documentId,
      filename: file.name,
      pageNumber: chunk.pageNumber,
      chunkOrder: chunk.chunkOrder,
      subject: subject || "Full Document",
      userId: userId || null,
      text: chunk.text,
    })),
  };
}

export function composeStudyText(documents) {
  return documents
    .map((document) => {
      const chunkText = document.chunks
        .map((chunk) => {
          const source = chunk.pageNumber ? `[${document.filename} PAGE ${chunk.pageNumber}]` : `[${document.filename}]`;
          return `${source}\n${chunk.text}`;
        })
        .join("\n\n");
      return `# ${document.filename}\n\n${chunkText}`;
    })
    .join("\n\n");
}

function selectedDocumentChunks(documents, selectedModule) {
  if (!Array.isArray(documents) || documents.length === 0) return [];
  return documents.flatMap((document) =>
    document.chunks.map((chunk) => ({
      documentId: document.id,
      filename: document.filename,
      subject: chunk.subject || document.subject,
      pageNumber: chunk.pageNumber,
      chunkOrder: chunk.chunkOrder,
      text: normalizeStudyContent(chunk.text),
    }))
  ).filter((chunk) => {
    if (!chunk.text) return false;
    if (!selectedModule || selectedModule === "__ALL__") return true;
    return chunk.subject === selectedModule || documentMatchesModule(chunk.text, selectedModule);
  });
}

function documentMatchesModule(text, selectedModule) {
  return selectedModule && text.toLowerCase().includes(selectedModule.toLowerCase());
}

function fallbackTextChunks(text) {
  return splitTextIntoChunks(normalizeStudyContent(text), {
    targetSize: 3200,
    overlap: 250,
  }).map((chunk) => ({
    documentId: null,
    filename: "Pasted notes",
    subject: "Full Document",
    pageNumber: chunk.pageNumber,
    chunkOrder: chunk.chunkOrder,
    text: chunk.text,
  }));
}

function hardSplitText(text, maxChars) {
  const parts = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    const window = remaining.slice(0, maxChars);
    const splitAt = Math.max(
      window.lastIndexOf("\n\n"),
      window.lastIndexOf(". "),
      window.lastIndexOf("; "),
      window.lastIndexOf(", ")
    );
    const safeSplitAt = splitAt > maxChars * 0.5 ? splitAt + 1 : maxChars;
    parts.push(remaining.slice(0, safeSplitAt).trim());
    remaining = remaining.slice(safeSplitAt).trim();
  }
  if (remaining) parts.push(remaining);
  return parts;
}

function formatBatchUnit(unit) {
  const parts = [];
  if (unit.filename) parts.push(unit.filename);
  if (unit.pageNumber) parts.push(`Page ${unit.pageNumber}`);
  if (unit.subject) parts.push(unit.subject);
  const source = parts.length ? `[${parts.join(" - ")}]` : "[Study source]";
  return `${source}\n${unit.text}`;
}

export function createGenerationBatches({ text, documents, selectedModule, maxChars = MAX_GENERATION_BATCH_CHARS }) {
  const units = selectedDocumentChunks(documents, selectedModule);
  const sourceUnits = units.length > 0 ? units : fallbackTextChunks(text);
  const batches = [];
  let currentUnits = [];
  let currentLength = 0;

  for (const unit of sourceUnits) {
    const formatted = formatBatchUnit(unit);
    if (formatted.length > maxChars) {
      if (currentUnits.length) {
        batches.push(currentUnits);
        currentUnits = [];
        currentLength = 0;
      }
      for (const [splitIndex, splitText] of hardSplitText(unit.text, maxChars - 500).entries()) {
        batches.push([{ ...unit, text: splitText, chunkOrder: `${unit.chunkOrder}.${splitIndex + 1}` }]);
      }
      continue;
    }

    const nextLength = currentLength + formatted.length + 2;
    if (nextLength > maxChars && currentUnits.length) {
      batches.push(currentUnits);
      currentUnits = [unit];
      currentLength = formatted.length;
    } else {
      currentUnits.push(unit);
      currentLength = nextLength;
    }
  }

  if (currentUnits.length) batches.push(currentUnits);

  return batches.map((batchUnits, index) => ({
    index: index + 1,
    count: batches.length,
    chunkCount: batchUnits.length,
    text: batchUnits.map(formatBatchUnit).join("\n\n"),
    sources: batchUnits.map((unit) => ({
      documentId: unit.documentId,
      filename: unit.filename,
      pageNumber: unit.pageNumber,
      chunkOrder: unit.chunkOrder,
      subject: unit.subject,
    })),
  }));
}

export function normalizeFlashcardQuestion(question) {
  return String(question || "")
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function mergeFlashcardBatches(batchCards, maxCards = 24) {
  const seen = new Set();
  const merged = [];
  for (const card of batchCards.flat()) {
    const question = String(card?.question || "").trim();
    const answer = String(card?.answer || "").trim();
    if (!question || !answer) continue;
    if (question.length < 12 || answer.length < 8) continue;
    const key = normalizeFlashcardQuestion(question);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push({ ...card, question, answer });
    if (merged.length >= maxCards) break;
  }
  return merged;
}
