/**
 * Client-side document parser for SAGE AI Tutor.
 * Extracts clean readable text and page metadata from PDF, Markdown, Text, and JSON documents.
 */

export interface ParsedDocument {
  filename: string;
  rawText: string;
  pageCount?: number;
}

export async function parseDocumentFile(file: File): Promise<ParsedDocument> {
  const filename = file.name;
  const extension = filename.split(".").pop()?.toLowerCase() || "";

  // 1. PDF File Parsing
  if (extension === "pdf") {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfText = await extractPdfText(arrayBuffer);
      if (pdfText && pdfText.trim().length > 20) {
        return {
          filename,
          rawText: pdfText,
        };
      }
    } catch (err) {
      console.warn("PDF extraction error, attempting raw stream fallback:", err);
    }

    // Secondary fallback for PDF text streams if PDF.js had trouble
    const rawFallback = await fallbackExtractPdfText(file);
    if (rawFallback && rawFallback.trim().length > 20) {
      return {
        filename,
        rawText: rawFallback,
      };
    }

    throw new Error(
      `Could not extract readable text from "${filename}". If this is a scanned image PDF, please copy and paste the text directly.`,
    );
  }

  // 2. Plain Text / Markdown / Code / JSON / CSV
  const text = await file.text();
  if (!text || text.trim().length < 5) {
    throw new Error(
      `"${filename}" appears to be empty or contains insufficient text. Please select a valid document.`,
    );
  }

  return {
    filename,
    rawText: text.trim(),
  };
}

/**
 * Extracts page-by-page text using PDF.js
 */
async function extractPdfText(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

  // Configure worker for web browser environment
  if (typeof window !== "undefined") {
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || "4.10.38"}/build/pdf.worker.min.mjs`;
      }
    } catch {
      // Worker configuration fallback
    }
  }

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
    isEvalSupported: false,
  });

  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .filter((str: string) => str && str.trim().length > 0);

      const combined = pageStrings.join(" ").trim();
      if (combined.length > 0) {
        pageTexts.push(`Page ${pageNum}\n${combined}`);
      }
    } catch (pageErr) {
      console.warn(`Error reading page ${pageNum}:`, pageErr);
    }
  }

  return pageTexts.join("\n\n");
}

/**
 * Lightweight regex stream decoder for raw PDF text objects (BT ... ET)
 * used as offline / robust fallback if worker fails.
 */
async function fallbackExtractPdfText(file: File): Promise<string> {
  try {
    const buffer = await file.arrayBuffer();
    const decoder = new TextDecoder("latin1");
    const raw = decoder.decode(buffer);

    const textPieces: string[] = [];
    const streamRegex = /\(([^)]+)\)\s*Tj/g;
    let match: RegExpExecArray | null;

    while ((match = streamRegex.exec(raw)) !== null) {
      if (match[1]) {
        const cleaned = match[1].replace(/\\([()\\])/g, "$1").trim();
        if (cleaned.length > 1) {
          textPieces.push(cleaned);
        }
      }
    }

    if (textPieces.length > 5) {
      return textPieces.join(" ");
    }
  } catch {
    // Ignore fallback errors
  }
  return "";
}
