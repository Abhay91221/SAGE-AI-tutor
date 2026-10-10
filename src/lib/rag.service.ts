import { DocumentChunk, StudyMaterial } from "./tutor.types";

/**
 * In-memory / Server RAG engine for SAGE AI Tutor.
 * Handles document text processing, chunking with overlap, keyword & similarity search,
 * and context formatting with source citations.
 */

// Helper to tokenize and calculate term frequency vectors
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
}

function computeTFIDFScore(query: string, chunkText: string): number {
  const queryTerms = tokenize(query);
  const chunkTerms = tokenize(chunkText);
  if (queryTerms.length === 0 || chunkTerms.length === 0) return 0;

  const termFreqMap: Record<string, number> = {};
  for (const term of chunkTerms) {
    termFreqMap[term] = (termFreqMap[term] || 0) + 1;
  }

  let matches = 0;
  let score = 0;
  for (const term of queryTerms) {
    if (termFreqMap[term]) {
      matches += 1;
      score += termFreqMap[term] / chunkTerms.length;
    }
  }

  // Bonus weight for unique query term matches
  const matchRatio = matches / new Set(queryTerms).size;
  return score * 10 + matchRatio * 5;
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
    if (!RAGService.initialized) {
      RAGService.initialized = true;
      RAGService.processDocument("ML_AI_Core_Handbook.txt", CORE_HANDBOOK_TEXT);
    }
  }

  /**
   * Process raw uploaded text or document content into chunked study material
   */
  public static processDocument(
    filename: string,
    rawText: string,
    chunkSize: number = 450,
    overlap: number = 60,
  ): StudyMaterial {
    RAGService.ensureInitialized();

    const docId = "doc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 7);
    const cleanedText = rawText.replace(/\r\n/g, "\n").trim();
    const paragraphs = cleanedText.split(/\n\s*\n/);

    const chunks: DocumentChunk[] = [];
    let currentChunk = "";
    let chunkIndex = 0;
    let currentPage = 1;

    for (const para of paragraphs) {
      if (para.toLowerCase().includes("page ") && para.length < 30) {
        const match = para.match(/page\s+(\d+)/i);
        if (match && match[1]) currentPage = parseInt(match[1], 10);
      }

      if ((currentChunk + "\n" + para).length > chunkSize && currentChunk.trim().length > 0) {
        chunks.push({
          id: `${docId}_chunk_${chunkIndex}`,
          documentId: docId,
          documentName: filename,
          pageNumber: currentPage,
          chunkIndex,
          text: currentChunk.trim(),
        });
        chunkIndex++;

        // Keep last 'overlap' characters for context continuity
        currentChunk = currentChunk.slice(-overlap) + "\n" + para;
      } else {
        currentChunk += (currentChunk ? "\n" : "") + para;
      }
    }

    if (currentChunk.trim().length > 0) {
      chunks.push({
        id: `${docId}_chunk_${chunkIndex}`,
        documentId: docId,
        documentName: filename,
        pageNumber: currentPage,
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
    };

    RAGService.materials.push(material);
    return material;
  }

  /**
   * Add pre-processed material into active search index
   */
  public static addMaterial(material: StudyMaterial) {
    RAGService.ensureInitialized();
    const existingIdx = RAGService.materials.findIndex((m) => m.id === material.id);
    if (existingIdx >= 0) {
      RAGService.materials[existingIdx] = material;
    } else {
      RAGService.materials.push(material);
    }
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
  }

  /**
   * Perform vector/similarity context search across all or specific documents
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
        const score = computeTFIDFScore(query, chunk.text);
        if (score > 0.1) {
          results.push({ chunk, score });
        }
      }
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  /**
   * Format context with explicit source citations for LLM context window
   */
  public static buildAugmentedContext(
    query: string,
    documentId?: string,
  ): { contextPrompt: string; citations: string[] } {
    const relevant = RAGService.searchContext(query, documentId, 4);

    if (relevant.length === 0) {
      return { contextPrompt: "", citations: [] };
    }

    const citations: string[] = [];
    const contextBlocks = relevant.map((item, idx) => {
      const pageInfo = item.chunk.pageNumber ? `, Page ${item.chunk.pageNumber}` : "";
      const citation = `[Source ${idx + 1}: ${item.chunk.documentName}${pageInfo}]`;
      citations.push(citation);
      return `${citation}\n"${item.chunk.text}"`;
    });

    const contextPrompt = `
=== UPLOADED STUDY MATERIAL CONTEXT ===
The following reference chunks were retrieved from the student's uploaded notes.
Use these details to answer the student's question accurately. If citing facts from these chunks, append [Source: Filename, Page X].
${contextBlocks.join("\n\n")}
=== END STUDY MATERIAL CONTEXT ===
`;

    return { contextPrompt, citations };
  }
}
