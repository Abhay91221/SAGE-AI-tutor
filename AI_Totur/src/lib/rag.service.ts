import { DocumentChunk, StudyMaterial } from "./tutor.types";
import fs from "node:fs";
import path from "node:path";

/**
 * Enhanced RAG engine for SAGE AI Tutor.
 * Features:
 * - Robust multi-format document chunking (PDF, Markdown, Notes, Text)
 * - Automatic Topic Extraction & Document Summarization
 * - Semantic & Keyword Retrieval with fallback overview chunks for targeted document chat
 * - Persistent local cache so uploaded notes survive server reloads
 */

const CACHE_FILE = path.resolve(process.cwd(), ".materials_cache.json");

// Helper to tokenize and calculate term frequency vectors
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function computeRelevanceScore(query: string, chunkText: string, docTopics: string[] = []): number {
  const queryLower = query.toLowerCase();
  const chunkLower = chunkText.toLowerCase();

  const queryTerms = tokenize(query);
  const chunkTerms = tokenize(chunkText);
  if (queryTerms.length === 0 || chunkTerms.length === 0) return 0;

  let score = 0;

  // 1. Exact phrase match bonus
  if (queryLower.length > 4 && chunkLower.includes(queryLower)) {
    score += 25;
  }

  // 2. Extracted topic match bonus
  for (const t of docTopics) {
    const tLower = t.toLowerCase();
    if (queryLower.includes(tLower) || tLower.includes(queryLower)) {
      if (chunkLower.includes(tLower)) {
        score += 15;
      }
    }
  }

  // 3. Term frequency matching
  const termFreqMap: Record<string, number> = {};
  for (const term of chunkTerms) {
    termFreqMap[term] = (termFreqMap[term] || 0) + 1;
  }

  let matches = 0;
  for (const term of queryTerms) {
    if (termFreqMap[term]) {
      matches += 1;
      score += (termFreqMap[term] / chunkTerms.length) * 10;
    } else {
      // Substring stem check (e.g. "regress" in "regression")
      if (term.length >= 4 && chunkTerms.some((ct) => ct.includes(term) || term.includes(ct))) {
        matches += 0.5;
        score += 2;
      }
    }
  }

  const matchRatio = matches / Math.max(1, new Set(queryTerms).size);
  return score + matchRatio * 8;
}

const CORE_HANDBOOK_TEXT = `
Page 1
Linear & Logistic Regression Notes:
Linear Regression fits a straight line to predict continuous numbers (e.g., house prices or salary).
Logistic Regression uses a sigmoid function sigma(z) = 1 / (1 + e^-z) to predict binary probabilities (0 or 1, such as spam detection or pass/fail).

Page 2
Bias-Variance Tradeoff Notes:
High Bias causes underfitting because the model is too simple to capture patterns.
High Variance causes overfitting because the model memorizes training noise and fails to generalize to test data.

Page 3
Gradient Descent Notes:
Gradient Descent is an optimization algorithm that iteratively updates weight parameters to minimize a model's cost/loss function by stepping in the negative gradient direction.

Page 4
Evaluation Metrics Notes:
Accuracy can fail on imbalanced data because predicting only the majority class yields high accuracy while missing rare positive cases.
Use Precision (avoiding false positives), Recall (avoiding false negatives), and F1-Score (the harmonic balance of both).

Page 5
Regularization (L1 & L2) Notes:
Prevents overfitting by penalizing large weights.
L1 Regularization (Lasso) adds absolute penalty and shrinks weights to zero for feature selection.
L2 Regularization (Ridge) adds squared penalty and shrinks weights close to zero to minimize feature impact smoothly.

Page 6
Ensemble Methods Notes:
Random Forest (Bagging) builds decision trees in parallel independently to lower model variance.
XGBoost (Boosting) builds decision trees sequentially to fix previous errors and lower model bias.

Page 7
Feature Engineering Notes:
Modifying data so algorithms can read it effectively.
Includes Feature Scaling (equalizing numeric ranges like MinMax or Z-Score) and One-Hot Encoding (turning text categories into binary 1s and 0s).

Page 8
Dimensionality Reduction (PCA) Notes:
Principal Component Analysis (PCA) compresses datasets with too many features by projecting them onto new orthogonal axes, maximizing variance retention while dropping noise.

Page 9
Clustering Notes:
Unsupervised grouping without labeled targets.
K-Means separates data into a fixed number of K distance-based groups.
DBSCAN groups data based on spatial density and isolates outliers.

Page 10
Transformers & Deep Learning Notes:
Neural networks learn complex data hierarchies through multi-layer architectures.
Transformers use self-attention mechanisms to process text sequences in parallel, powering all modern Large Language Models (LLMs).
`;

export class RAGService {
  private static materials: StudyMaterial[] = [];
  private static initialized = false;

  private static ensureInitialized() {
    if (RAGService.initialized) return;
    RAGService.initialized = true;

    // Load from local disk cache if available
    try {
      if (fs.existsSync(CACHE_FILE)) {
        const raw = fs.readFileSync(CACHE_FILE, "utf-8");
        const cached = JSON.parse(raw);
        if (Array.isArray(cached) && cached.length > 0) {
          RAGService.materials = cached;
          return;
        }
      }
    } catch (err) {
      console.warn("Could not read .materials_cache.json:", err);
    }

    // Default seed handbook
    RAGService.processDocument("ML_AI_Core_Handbook.txt", CORE_HANDBOOK_TEXT, true);
  }

  private static saveCache() {
    try {
      // Save non-default materials or all materials to cache
      fs.writeFileSync(CACHE_FILE, JSON.stringify(RAGService.materials, null, 2), "utf-8");
    } catch (err) {
      console.warn("Failed to save .materials_cache.json:", err);
    }
  }

  /**
   * Automatically extracts topics, key concepts, and a summary from document text
   */
  public static extractTopicsAndSummary(
    filename: string,
    rawText: string,
  ): { topics: string[]; summary: string } {
    const topicsSet = new Set<string>();

    const baseName = filename
      .replace(/\.[^/.]+$/, "")
      .replace(/^[\d\s_.-]+/, "")
      .replace(/[-_]/g, " ")
      .trim()
      .toLowerCase();
    const cleanFilename = filename.toLowerCase();

    // 2. Scan lines for Headings & Titles (ONLY from document content, never the filename)
    const lines = rawText.split(/\r?\n/);
    const ignoreWords = new Set([
      "page",
      "notes",
      "chapter",
      "section",
      "module",
      "introduction",
      "summary",
      "conclusion",
      "overview",
      "table of contents",
      "references",
      "part",
    ]);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.length > 80) continue;

      // Matches Markdown headings (# Concept, ## Concept)
      const mdMatch = line.match(/^#{1,4}\s+(.+)$/);
      if (mdMatch && mdMatch[1]) {
        const candidate = cleanTopicCandidate(mdMatch[1]);
        if (isValidTopic(candidate, ignoreWords) && candidate.toLowerCase() !== baseName && candidate.toLowerCase() !== cleanFilename) {
          topicsSet.add(candidate);
        }
      }

      // Matches explicit headers (e.g. "Topic: Neural Networks", "Chapter 3: Gradient Descent")
      const prefixMatch = line.match(/^(?:Topic|Chapter\s+\d+|Section\s+\d+|Unit\s+\d+)[:\-]\s*(.+)$/i);
      if (prefixMatch && prefixMatch[1]) {
        const candidate = cleanTopicCandidate(prefixMatch[1]);
        if (isValidTopic(candidate, ignoreWords) && candidate.toLowerCase() !== baseName && candidate.toLowerCase() !== cleanFilename) {
          topicsSet.add(candidate);
        }
      }

      // Matches lines ending in colon that look like section titles (e.g. "Linear & Logistic Regression Notes:")
      const colonMatch = line.match(/^([A-Z][A-Za-z0-9\s&()/-]{2,50}):$/);
      if (colonMatch && colonMatch[1]) {
        const candidate = cleanTopicCandidate(colonMatch[1].replace(/Notes$/i, "").trim());
        if (isValidTopic(candidate, ignoreWords) && candidate.toLowerCase() !== baseName && candidate.toLowerCase() !== cleanFilename) {
          topicsSet.add(candidate);
        }
      }
    }

    // 3. Fallback: If few topics detected, look for capitalized noun phrases or definitions
    if (topicsSet.size < 2) {
      for (const line of lines) {
        const defMatch = line.match(/^([A-Z][A-Za-z0-9\s-]{2,30})\s+(?:is defined as|is an?|refers to|uses|operates)/);
        if (defMatch && defMatch[1]) {
          const candidate = cleanTopicCandidate(defMatch[1]);
          if (isValidTopic(candidate, ignoreWords) && candidate.toLowerCase() !== baseName && candidate.toLowerCase() !== cleanFilename) {
            topicsSet.add(candidate);
          }
        }
        if (topicsSet.size >= 6) break;
      }
    }

    const topics = Array.from(topicsSet)
      .filter((t) => t.toLowerCase() !== baseName && t.toLowerCase() !== cleanFilename)
      .slice(0, 10);

    // 4. Generate a clean summary
    const cleanParagraphs = rawText
      .split(/\n\s*\n/)
      .map((p) => p.replace(/^Page\s+\d+\s*/i, "").trim())
      .filter((p) => p.length > 40);

    let summary = "";
    if (cleanParagraphs.length > 0) {
      summary = cleanParagraphs[0].slice(0, 220);
      if (cleanParagraphs[0].length > 220) summary += "...";
    } else {
      summary = `Contains ${topics.join(", ")}.`;
    }

    return { topics, summary };
  }

  /**
   * Process raw uploaded text or document content into chunked study material
   */
  public static processDocument(
    filename: string,
    rawText: string,
    isSeed: boolean = false,
    chunkSize: number = 480,
    overlap: number = 70,
  ): StudyMaterial {
    if (!isSeed) {
      RAGService.ensureInitialized();
    }

    const docId = "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const cleanedText = rawText.replace(/\r\n/g, "\n").trim();

    // 1. Extract topics and summary
    const { topics, summary } = RAGService.extractTopicsAndSummary(filename, cleanedText);

    // 2. Intelligent chunking (paragraph & sentence boundary aware)
    const rawParagraphs = cleanedText.split(/\n\s*\n/);
    const segments: { text: string; page?: number }[] = [];
    let currentPage = 1;

    for (const rawPara of rawParagraphs) {
      let para = rawPara.trim();
      if (!para) continue;

      const pageLineMatch = para.match(/^(?:page\s+(\d+)|\[page\s+(\d+)\])/i);
      if (pageLineMatch) {
        currentPage = parseInt(pageLineMatch[1] || pageLineMatch[2] || "1", 10);
        para = para.replace(/^(?:page\s+(\d+)|\[page\s+(\d+)\])\s*\n?/i, "").trim();
      }

      if (!para) continue;

      // If a single paragraph is larger than chunkSize, break by sentences
      if (para.length > chunkSize * 1.5) {
        const sentences = para.match(/[^.!?]+[.!?]+(\s|$)|[^.!?]+$/g) || [para];
        let sub = "";
        for (const s of sentences) {
          if ((sub + " " + s).length > chunkSize && sub.trim().length > 0) {
            segments.push({ text: sub.trim(), page: currentPage });
            sub = s;
          } else {
            sub += (sub ? " " : "") + s;
          }
        }
        if (sub.trim().length > 0) {
          segments.push({ text: sub.trim(), page: currentPage });
        }
      } else {
        segments.push({ text: para, page: currentPage });
      }
    }

    const chunks: DocumentChunk[] = [];
    let currentChunk = "";
    let chunkIndex = 0;
    let chunkPage = 1;

    for (const seg of segments) {
      if (seg.page) chunkPage = seg.page;

      if ((currentChunk + "\n" + seg.text).length > chunkSize && currentChunk.trim().length > 0) {
        chunks.push({
          id: `${docId}_chunk_${chunkIndex}`,
          documentId: docId,
          documentName: filename,
          pageNumber: chunkPage,
          chunkIndex,
          text: currentChunk.trim(),
        });
        chunkIndex++;

        // Keep last 'overlap' characters for semantic continuity
        currentChunk = currentChunk.slice(-overlap) + "\n" + seg.text;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + seg.text;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${docId}_chunk_${chunkIndex}`,
        documentId: docId,
        documentName: filename,
        pageNumber: chunkPage,
        chunkIndex,
        text: currentChunk.trim(),
      });
    }

    const material: StudyMaterial = {
      id: docId,
      name: filename,
      size: rawText.length,
      uploadDate: new Date().toISOString(),
      chunksCount: chunks.length,
      chunks,
      topics,
      summary,
    };

    RAGService.materials.unshift(material);
    RAGService.saveCache();

    return material;
  }

  /**
   * Retrieve all uploaded study materials
   */
  public static getMaterials(): StudyMaterial[] {
    RAGService.ensureInitialized();
    return RAGService.materials;
  }

  /**
   * Remove a study material by ID
   */
  public static removeMaterial(id: string) {
    RAGService.ensureInitialized();
    RAGService.materials = RAGService.materials.filter((m) => m.id !== id);
    RAGService.saveCache();
  }

  /**
   * Perform context search across all or specific documents
   */
  public static searchContext(
    query: string,
    documentId?: string,
    topK: number = 4,
  ): { chunk: DocumentChunk; score: number }[] {
    RAGService.ensureInitialized();
    const results: { chunk: DocumentChunk; score: number }[] = [];

    const targetMaterials = documentId
      ? RAGService.materials.filter((m) => m.id === documentId)
      : RAGService.materials;

    for (const mat of targetMaterials) {
      for (const chunk of mat.chunks) {
        const score = computeRelevanceScore(query, chunk.text, mat.topics || []);
        if (score > 0.05) {
          results.push({ chunk, score });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);

    // Fallback: If a document is explicitly selected, but user query was general (e.g. "summarize",
    // "teach me this note", "what is this?"), return the document's introductory chunks.
    if (results.length === 0 && documentId) {
      const selectedDoc = RAGService.materials.find((m) => m.id === documentId);
      if (selectedDoc && selectedDoc.chunks.length > 0) {
        return selectedDoc.chunks.slice(0, topK).map((chunk, idx) => ({
          chunk,
          score: 1.0 - idx * 0.1,
        }));
      }
    }

    return results.slice(0, topK);
  }

  /**
   * Format context with explicit source citations for LLM and local synthesis
   */
  public static buildAugmentedContext(
    query: string,
    documentId?: string,
  ): { contextPrompt: string; citations: string[]; relevantChunks: DocumentChunk[] } {
    const relevant = RAGService.searchContext(query, documentId, 4);

    if (relevant.length === 0) {
      return { contextPrompt: "", citations: [], relevantChunks: [] };
    }

    const citations: string[] = [];
    const relevantChunks = relevant.map((r) => r.chunk);

    const contextBlocks = relevant.map((item, idx) => {
      const pageInfo = item.chunk.pageNumber ? `, Page ${item.chunk.pageNumber}` : "";
      const citation = `[Source ${idx + 1}: ${item.chunk.documentName}${pageInfo}]`;
      citations.push(citation);
      return `${citation}\n"${item.chunk.text}"`;
    });

    const contextPrompt = `
=== UPLOADED STUDY MATERIAL CONTEXT ===
The following reference chunks were retrieved from the student's uploaded notes:
${contextBlocks.join("\n\n")}
Use these details to answer the student's question accurately. If citing facts from these chunks, append [Source: Filename, Page X].
=== END STUDY MATERIAL CONTEXT ===
`;

    return { contextPrompt, citations, relevantChunks };
  }
}

function cleanTopicCandidate(str: string): string {
  return str
    .replace(/^[\d\s_.:-]+/, "")
    .replace(/[#*`:]/g, "")
    .trim();
}

function isValidTopic(candidate: string, ignoreWords: Set<string>): boolean {
  if (!candidate || candidate.length < 3 || candidate.length > 45) return false;
  const lower = candidate.toLowerCase();
  if (ignoreWords.has(lower)) return false;
  if (/^page\s+\d+$/i.test(lower)) return false;
  if (/^\d+$/.test(lower)) return false;
  if (/\b(is|are|was|were|of|and|in|to|for|with|that|the|by)$/i.test(candidate.trim())) return false;
  return true;
}

function capitalizeWords(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}
