export const config = {
  maxDuration: 60,
  api: {
    bodyParser: {
      sizeLimit: "18mb",
    },
  },
};

function cleanOcrPageText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/[|]{2,}/g, " ")
    .replace(/[_]{3,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function renderPageToPng(page, scale = 2) {
  const { createCanvas } = await import("@napi-rs/canvas");
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const canvasContext = canvas.getContext("2d");
  await page.render({ canvasContext, viewport }).promise;
  return canvas.toBuffer("image/png");
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const startedAt = Date.now();
  let worker = null;

  try {
    const { filename, pdfBase64 } = req.body || {};
    if (!pdfBase64 || typeof pdfBase64 !== "string") {
      return res.status(400).json({ error: "No PDF data was sent for OCR." });
    }

    const pdfBytes = Buffer.from(pdfBase64, "base64");
    if (pdfBytes.length === 0) {
      return res.status(400).json({ error: "The PDF sent for OCR was empty." });
    }

    if (pdfBytes.length > 12 * 1024 * 1024) {
      return res.status(413).json({ error: "This scanned PDF is too large for OCR. Split it below 12 MB and try again." });
    }

    const [{ getDocument }, { createWorker, PSM }] = await Promise.all([
      import("pdfjs-dist/legacy/build/pdf.mjs"),
      import("tesseract.js"),
    ]);

    const pdf = await getDocument({
      data: new Uint8Array(pdfBytes),
      disableWorker: true,
      useSystemFonts: true,
    }).promise;

    if (!pdf.numPages) {
      return res.status(422).json({ error: "OCR could not find any pages in this PDF." });
    }

    worker = await createWorker("eng", 1, {
      logger: (message) => {
        if (message.status === "recognizing text") {
          console.info("OCR progress:", filename, Math.round((message.progress || 0) * 100));
        }
      },
    });
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
      user_defined_dpi: "180",
    });

    const pages = [];
    let confidenceTotal = 0;
    let confidenceCount = 0;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const image = await renderPageToPng(page);
      const result = await worker.recognize(image);
      const pageText = cleanOcrPageText(result?.data?.text);
      const confidence = Number(result?.data?.confidence);
      if (Number.isFinite(confidence)) {
        confidenceTotal += confidence;
        confidenceCount += 1;
      }
      pages.push({ page: pageNumber, text: pageText, confidence });
    }

    const text = pages
      .filter((page) => page.text)
      .map((page) => `\n\n[PAGE ${page.page}]\n\n${page.text}\n\n`)
      .join("");

    if (!text.trim()) {
      console.error("OCR produced no text", { filename, pages: pdf.numPages, elapsedMs: Date.now() - startedAt });
      return res.status(422).json({ error: "OCR completed, but no readable text was found in this PDF." });
    }

    return res.status(200).json({
      text,
      pages,
      pageCount: pdf.numPages,
      confidence: confidenceCount ? Math.round(confidenceTotal / confidenceCount) : null,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (error) {
    console.error("PDF OCR failed:", {
      message: error?.message,
      stack: error?.stack,
      elapsedMs: Date.now() - startedAt,
    });
    return res.status(500).json({
      error: "OCR failed for this scanned PDF. Try a clearer scan or split the file into fewer pages.",
    });
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (error) {
        console.error("Failed to terminate OCR worker:", error);
      }
    }
  }
}
