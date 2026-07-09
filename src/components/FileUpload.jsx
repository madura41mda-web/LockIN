import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";

// Tell pdf.js where its worker file is
GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

export default function FileUpload({ noteText, setNoteText }) {
  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Handle text files
    if (file.type === "text/plain") {
      const reader = new FileReader();
      reader.onload = (event) => {
        setNoteText(event.target.result);
      };
      reader.readAsText(file);
      return;
    }

    // Handle PDF files
    if (file.type === "application/pdf") {
      const arrayBuffer = await file.arrayBuffer();

      const pdf = await getDocument({
        data: arrayBuffer,
      }).promise;

      let text = "";

      for (let page = 1; page <= pdf.numPages; page++) {
        const pdfPage = await pdf.getPage(page);
        const content = await pdfPage.getTextContent();

        text +=
          content.items
            .map((item) => item.str)
            .join(" ") + "\n\n";
      }

      setNoteText(text);
    }
  }

  return (
    <div>
      <textarea
        placeholder="Paste your notes or upload a PDF..."
        value={noteText}
        onChange={(e) => setNoteText(e.target.value)}
      />

      <div className="file-row">
        <input
          type="file"
          accept=".txt,.pdf"
          onChange={handleFile}
        />
      </div>
    </div>
  );
}