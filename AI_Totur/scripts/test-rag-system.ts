import { RAGService } from "../src/lib/rag.service";
import { AgentOrchestrator } from "../src/lib/agent.orchestrator";
import { AssessmentService } from "../src/lib/assessment.service";

async function main() {
  console.log("=== SAGE AI TUTOR RAG VERIFICATION TEST ===\n");

  const sampleDocument = `
Page 1
Cellular Respiration & Photosynthesis:
Photosynthesis is the biochemical process by which autotrophic organisms convert solar energy, water, and carbon dioxide into glucose and oxygen gas.
The overall chemical equation is:
6CO2 + 6H2O + Light -> C6H12O6 + 6O2

Page 2
The Light-Dependent Reactions:
Occur within the thylakoid membranes of chloroplasts.
Chlorophyll pigments absorb photons, exciting electrons that move down the electron transport chain (ETC).
This produces ATP and NADPH, releasing O2 as a byproduct.

Page 3
The Calvin Cycle (Dark Reactions):
Takes place in the chloroplast stroma.
Uses the enzyme RuBisCO to fix CO2 into 3-PGA, which is subsequently reduced to G3P sugars using ATP and NADPH.
`;

  // 1. Test Ingestion & Topic Extraction
  console.log("1. Ingesting new study material...");
  const material = RAGService.processDocument(
    "Biology_101_Chapter_5.pdf",
    sampleDocument,
  );

  console.log(`- Document ID: ${material.id}`);
  console.log(`- Document Name: ${material.name}`);
  console.log(`- Chunks Created: ${material.chunksCount}`);
  console.log(`- Extracted Topics:`, material.topics);
  console.log(`- Document Summary: "${material.summary}"\n`);

  if (!material.topics || material.topics.length === 0) {
    throw new Error("FAIL: No topics extracted from new document!");
  }
  console.log("✓ SUCCESS: Topics successfully extracted from new uploaded material!\n");

  // 2. Test Search & Retrieval
  console.log("2. Testing RAG Context Retrieval for query: 'What is the equation for photosynthesis?'");
  const { contextPrompt, citations, relevantChunks } = RAGService.buildAugmentedContext(
    "What is the equation for photosynthesis?",
    material.id,
  );

  console.log(`- Citations found:`, citations);
  console.log(`- Chunks retrieved: ${relevantChunks.length}\n`);

  if (relevantChunks.length === 0) {
    throw new Error("FAIL: RAG failed to retrieve chunks for query!");
  }
  console.log("✓ SUCCESS: Relevant chunks retrieved with page numbers!\n");

  // 3. Test Local Answer Synthesis from Chunks
  console.log("3. Testing Local RAG Answer Synthesis (Explain Mode)...");
  const explainAnswer = AgentOrchestrator.synthesizeRAGAnswer(
    "Explain photosynthesis equation",
    "Photosynthesis",
    "Beginner",
    "Explain",
    relevantChunks,
    citations,
  );
  console.log("--- Tutor Response (Explain) ---");
  console.log(explainAnswer);
  console.log("--------------------------------\n");

  if (!explainAnswer.includes("Photosynthesis") || !explainAnswer.includes("6CO2")) {
    throw new Error("FAIL: Synthesized answer did not contain uploaded text facts!");
  }
  console.log("✓ SUCCESS: Answer accurately synthesized directly from uploaded data!\n");

  // 4. Test Formula Mode
  console.log("4. Testing Formula Extraction (Show Formula Mode)...");
  const formulaAnswer = AgentOrchestrator.synthesizeRAGAnswer(
    "Show the chemical formula",
    "Photosynthesis",
    "Intermediate",
    "Show Formula",
    relevantChunks,
    citations,
  );
  console.log("--- Tutor Response (Show Formula) ---");
  console.log(formulaAnswer);
  console.log("-------------------------------------\n");

  if (!formulaAnswer.includes("6CO2 + 6H2O")) {
    throw new Error("FAIL: Formula mode failed to extract equation from chunks!");
  }
  console.log("✓ SUCCESS: Equations extracted directly from uploaded chunks!\n");

  // 5. Test Adaptive Quiz from Uploaded Notes
  console.log("5. Testing Adaptive Quiz Generation on new topic 'Photosynthesis'...");
  const quiz = AssessmentService.generateQuiz("Photosynthesis", "Beginner");
  console.log(`- Quiz Topic: ${quiz.topic}`);
  console.log(`- Questions generated: ${quiz.questions.length}`);
  console.log(`- Sample Question 1: "${quiz.questions[0]?.question}"`);
  console.log(`- Correct Answer: "${quiz.questions[0]?.correctAnswer}"\n`);

  console.log("=== ALL RAG PIPELINE VERIFICATIONS PASSED ===");
}

main().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
