import { useRef, useState } from "react";
import { FileText, Paperclip, X } from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import JSZip from "jszip";

GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

function fileExtension(fileName) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
}

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

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  let text = "";
  for (let page = 1; page <= pdf.numPages; page++) {
    const pdfPage = await pdf.getPage(page);
    const content = await pdfPage.getTextContent();
    text +=
      `\n\n[PAGE ${page}]\n\n` +
      content.items.map((item) => item.str).join(" ") +
      "\n\n";
  }

  return text;
}

async function extractPptxText(file) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
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

export default function FileUpload({ noteText, setNoteText, onFileRead }) {
  const [fileName, setFileName] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    setFileName(file.name);
    setExtracting(true);
    setUploadError("");

    const ext = fileExtension(file.name);

    try {
      if (file.type === "text/plain" || ext === "txt" || ext === "md") {
        const text = await file.text();
        setNoteText(text);
        onFileRead?.(file.name);
        return;
      }

      if (file.type === "application/pdf" || ext === "pdf") {
        setNoteText(await extractPdfText(file));
        onFileRead?.(file.name);
        return;
      }

      if (ext === "pptx") {
        setNoteText(await extractPptxText(file));
        onFileRead?.(file.name);
        return;
      }

      if (ext === "ppt") {
        throw new Error("Legacy .ppt files are not readable yet. Export it as .pptx and upload again.");
      }

      throw new Error("Unsupported file type. Upload PDF, PPTX, TXT, or MD notes.");
    } catch (err) {
      setFileName("");
      setNoteText("");
      onFileRead?.(null);
      setUploadError(err.message || "Could not read this file.");
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
            <button type="button" className="file-chip-remove" onClick={removeFile} aria-label="Remove file">
              <X size={14} />
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
          onChange={handleFile}
          style={{ display: "none" }}
        />
      </div>

      {uploadError && <p className="upload-error mono">{uploadError}</p>}
    </div>
  );
}