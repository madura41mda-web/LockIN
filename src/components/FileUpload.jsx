import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import {
  buildProcessedDocument,
  composeStudyText,
  fileExtension,
  hashArrayBuffer,
  isLowTextPdfExtraction,
  MAX_OCR_UPLOAD_BYTES,
  validateStudyFile,
} from "../utils/documentProcessing";
import {
  findProcessedDocumentLocal,
  saveProcessedDocumentsLocal,
  saveProcessedDocumentsSupabase,
} from "../utils/documentStore";
import { supabase } from "../supabaseClient";

function slideNumber(path) {
  const match = path.match(/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : 0;
}

function extractTextFromXml(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  const textNodes = Array.from(doc.getElementsByTagName("a:t"));
  return textNodes
    .map((node) => node.textContent?.trim())
    .filter(Boolean)
    .join(" ");
}

async function readFreshArrayBuffer(file) {
  return await file.slice(0, file.size).arrayBuffer();
}

async function extractPdfText(file, arrayBuffer) {
  // Dynamically load pdfjs-dist
  const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
  GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url
  ).toString();

  const pdfBytes = new Uint8Array(arrayBuffer.slice(0));
  const pdf = await getDocument({ data: pdfBytes }).promise;

  const pages = [];
  for (let page = 1; page <= pdf.numPages; page++) {
    const pdfPage = await pdf.getPage(page);
    const content = await pdfPage.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    pages.push({ page, text: pageText });
  }

  return {
    text: pages.map((page) => `\n\n[PAGE ${page.page}]\n\n${page.text}\n\n`).join(""),
    pages,
    pageCount: pdf.numPages,
  };
}

function arrayBufferToBase64(arrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(arrayBuffer.slice(0));
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function extractScannedPdfText(file, arrayBuffer, fileHash) {
  if (file.size > MAX_OCR_UPLOAD_BYTES) {
    throw new Error(`${file.name} appears to be scanned and is too large for OCR in this app. Use a searchable PDF or split it below 12 MB.`);
  }

  const response = await fetch("/api/ocr-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      fileHash,
      pdfBase64: arrayBufferToBase64(arrayBuffer),
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (error) {
    throw new Error(`OCR failed for ${file.name}: the server returned an invalid response.`);
  }

  if (!response.ok) {
    throw new Error(payload?.error || `OCR failed for ${file.name}.`);
  }

  if (!payload?.text?.trim()) {
    throw new Error(`OCR finished for ${file.name}, but no readable text was found.`);
  }

  return payload;
}

async function extractPptxText(file) {
  // Dynamically load jszip
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(await readFreshArrayBuffer(file));
  const slidePaths = Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort((a, b) => slideNumber(a) - slideNumber(b));

  if (slidePaths.length === 0) {
    throw new Error("No readable slides were found in this PPTX.");
  }

  const slides = [];
  for (const path of slidePaths) {
    const xml = await zip.files[path].async("text");
    const slideText = extractTextFromXml(xml);
    if (slideText) {
      slides.push(`\n\n[SLIDE ${slideNumber(path)}]\n\n${slideText}\n\n`);
    }
  }

  if (slides.length === 0) {
    throw new Error("This PPTX did not contain readable slide text.");
  }

  return slides.join("");
}

export default function FileUpload({ noteText, setNoteText, onFileRead, session, subject }) {
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef(null);

  async function handleFile(e) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setFileName(files.map((file) => file.name).join(", "));
    setExtracting(true);
    setUploadError("");
    setUploadStatus(`Reading ${files.length} file${files.length === 1 ? "" : "s"}...`);

    const processedDocuments = [];

    try {
      for (const file of files) {
        const fileInfo = validateStudyFile(file);
        let rawText = "";
        let extractionMethod = "text";
        let ocrConfidence = null;
        let fileHash = "";

        try {
          const hashBuffer = await readFreshArrayBuffer(file);
          fileHash = await hashArrayBuffer(hashBuffer);
        } catch (stageErr) {
          throw new Error(`Hashing failed for ${file.name}: ${stageErr.message || "Could not read the file."}`);
        }

        const cachedDocument = findProcessedDocumentLocal(session?.user?.id, fileHash);
        if (cachedDocument) {
          processedDocuments.push(cachedDocument);
          continue;
        }

        if (fileInfo.isText) {
          try {
            rawText = await file.text();
          } catch (stageErr) {
            throw new Error(`Text extraction failed for ${file.name}: ${stageErr.message || "Could not read text."}`);
          }
        } else if (fileInfo.isPdf) {
          let extracted = null;
          try {
            const pdfBuffer = await readFreshArrayBuffer(file);
            extracted = await extractPdfText(file, pdfBuffer);
          } catch (stageErr) {
            throw new Error(`Embedded text extraction failed for ${file.name}: ${stageErr.message || "PDF.js could not read this PDF."}`);
          }
          rawText = extracted.text;
          if (isLowTextPdfExtraction(extracted.pages)) {
            setUploadStatus(`Running OCR for scanned PDF: ${file.name}`);
            let ocrResult = null;
            try {
              const ocrBuffer = await readFreshArrayBuffer(file);
              ocrResult = await extractScannedPdfText(file, ocrBuffer, fileHash);
            } catch (stageErr) {
              throw new Error(`OCR failed for ${file.name}: ${stageErr.message || "Scanned PDF OCR could not complete."}`);
            }
            rawText = ocrResult.text;
            extractionMethod = "ocr";
            ocrConfidence = ocrResult.confidence ?? null;
          }
        } else if (fileInfo.isPptx) {
          try {
            rawText = await extractPptxText(file);
          } catch (stageErr) {
            throw new Error(`PPTX extraction failed for ${file.name}: ${stageErr.message || "Could not read slides."}`);
          }
        }

        try {
          processedDocuments.push(buildProcessedDocument({
            file,
            rawText,
            subject,
            userId: session?.user?.id,
            fileHash,
            extractionMethod,
            ocrConfidence,
          }));
        } catch (stageErr) {
          throw new Error(`Chunking failed for ${file.name}: ${stageErr.message || "Could not create study chunks."}`);
        }
      }

      const combinedText = composeStudyText(processedDocuments);
      setNoteText(combinedText);

      try {
        saveProcessedDocumentsLocal(session?.user?.id, processedDocuments);
      } catch (localErr) {
        console.error("Failed to save processed documents locally:", localErr);
      }

      if (session) {
        const result = await saveProcessedDocumentsSupabase(supabase, processedDocuments);
        if (result.error) {
          console.error("Processed document cloud save failed:", result.error);
          setUploadStatus(
            `Processed locally. Cloud document cache failed (${result.error.code || "Supabase error"}). Run migrations 202607230001_study_documents_and_lobby.sql and 202607230002_study_document_extraction_metadata.sql.`
          );
        } else {
          setUploadStatus(`Processed ${processedDocuments.length} file${processedDocuments.length === 1 ? "" : "s"} and cached for reuse.`);
        }
      } else {
        setUploadStatus(`Processed ${processedDocuments.length} file${processedDocuments.length === 1 ? "" : "s"} locally. Sign in to sync them securely.`);
      }

      onFileRead?.({
        fileName: processedDocuments.map((document) => document.filename).join(", "),
        documents: processedDocuments,
      });
    } catch (err) {
      setFileName("");
      setNoteText("");
      onFileRead?.(null);
      setUploadError(err.message || "Could not read this file.");
      setUploadStatus("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setExtracting(false);
    }
  }

  function removeFile() {
    setFileName("");
    setNoteText("");
    onFileRead?.(null);
    setUploadError("");
    setUploadStatus("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="upload-box">
      {fileName && (
        <div className="file-chip">
          <FileText size={16} />
          <span className="file-chip-name">{fileName}</span>
          {extracting ? (
            <span className="file-chip-status">Reading...</span>
          ) : (
            <button type="button" className="file-chip-remove" onClick={removeFile} aria-label="Remove file" style={{ display: "inline-flex", alignItems: "center", gap: "4px", marginLeft: "8px", fontWeight: "600" }}>
              <X size={14} />
              <span>Remove</span>
            </button>
          )}
        </div>
      )}

      <div className="upload-row">
        <button
          type="button"
          className="attach-btn"
          onClick={() => fileInputRef.current?.click()}
          title="Attach a PDF, PPTX, or text file"
        >
          <Paperclip size={18} />
        </button>

        <input
          type="text"
          className="upload-text-input"
          placeholder={
            fileName
              ? "File attached - ready to generate"
              : "Attach PDF, PPTX, TXT, MD, or paste notes here..."
          }
          value={fileName ? "" : noteText}
          onChange={(e) => setNoteText(e.target.value)}
          disabled={!!fileName}
        />

        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.pdf,.pptx,.ppt"
          multiple
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>

      {uploadStatus && <p className="upload-status mono">{uploadStatus}</p>}
      {uploadError && <p className="upload-error mono">{uploadError}</p>}
    </div>
  );
}
