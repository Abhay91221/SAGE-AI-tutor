import { AgentOrchestrator } from "../src/lib/agent.orchestrator";
import { RAGService } from "../src/lib/rag.service";
import { AssessmentService } from "../src/lib/assessment.service";
import { ProfileService } from "../src/lib/profile.service";
import { SupabaseDataService } from "../src/lib/supabase-data.service";
import serverEntry from "../src/server";

async function runVerification() {
  console.log("=== SAGE AI TUTOR — VERIFICATION SUITE ===");
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  ✓ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${msg}`);
      failed++;
    }
  }

  // 1. Agent Orchestrator & Tool Calling
  console.log("\n[TEST 1] Agent Orchestrator & Tool Calling Pipeline");
  try {
    const res = await AgentOrchestrator.processRequest({
      topic: "Linear & Logistic Regression",
      level: "Beginner",
      mode: "Explain",
      messages: [{ role: "user", content: "How does logistic regression work?" }],
    });
    assert(Boolean(res.answer && res.answer.length > 50), "AI generates structured answer");
    assert(res.toolCallsExecuted.length >= 2, "Agent executes tools (profile, RAG search)");
    assert(
      res.toolCallsExecuted.some((t) => t.toolName === "get_student_profile"),
      "get_student_profile tool executed",
    );
    assert(
      res.toolCallsExecuted.some((t) => t.toolName === "search_study_material"),
      "search_study_material tool executed",
    );
    assert(res.citations.length > 0, "Citations included in response");
  } catch (e) {
    console.error(e);
    failed++;
  }

  // 2. Misconception Detection & Counter-Examples
  console.log("\n[TEST 2] Misconception Detection & Root-Cause Diagnosis");
  try {
    const misc = AssessmentService.detectMisconception(
      {
        id: "q1",
        topic: "Linear & Logistic Regression",
        question: "Can we use linear regression for binary classification?",
        questionType: "short_answer",
        correctAnswer: "No, linear regression is unbounded.",
        explanation: "Logistic regression uses sigmoid for 0-1 probability bounds.",
        difficulty: "Beginner",
      },
      "Yes, linear regression is fine because regression numbers can just be rounded.",
    );
    assert(Boolean(misc.whyWrong), "Detected conceptual error in student input");
    assert(Boolean(misc.counterExample), "Generated concrete counter-example");
    assert(Boolean(misc.remedialHint), "Provided targeted remedial hint");
  } catch (e) {
    console.error(e);
    failed++;
  }

  // 3. RAG Pipeline & Document Processing
  console.log("\n[TEST 3] RAG Pipeline (Ingestion, Chunking, Retrieval)");
  try {
    const newDoc = RAGService.processDocument(
      "Deep_Learning_Intro.txt",
      "Page 1\nConvolutional Neural Networks (CNNs) process grid-like topology such as images.\n\nPage 2\nRecurrent Neural Networks (RNNs) process sequential input such as time series.",
    );
    assert(newDoc.chunksCount >= 2, "Document chunked with page metadata");

    const searchHits = RAGService.searchContext(
      "Convolutional Neural Networks images",
      undefined,
      2,
    );
    assert(searchHits.length > 0, "Semantic search matched uploaded document");
    assert(
      searchHits[0].chunk.documentName === "Deep_Learning_Intro.txt",
      "Retrieved correct document chunk",
    );

    const contextResult = RAGService.buildAugmentedContext("CNN images");
    assert(
      contextResult.citations.length > 0,
      "Context generated with [Source: Filename, Page X] citation",
    );
  } catch (e) {
    console.error(e);
    failed++;
  }

  // 4. Adaptive Assessment Generator & Evaluation
  console.log("\n[TEST 4] Adaptive Assessment Engine");
  try {
    const quiz = AssessmentService.generateQuiz("Gradient Descent", "Intermediate");
    assert(quiz.questions.length === 3, "Adaptive quiz generated with 3 questions");
    assert(quiz.difficulty === "Intermediate", "Quiz matches requested difficulty level");

    const submission = await AssessmentService.evaluateQuizAnswers(quiz, [
      { questionId: quiz.questions[0].id, answer: quiz.questions[0].correctAnswer },
      { questionId: quiz.questions[1].id, answer: "incorrect answer" },
      { questionId: quiz.questions[2].id, answer: quiz.questions[2].correctAnswer },
    ]);
    assert(submission.evaluatedAnswers.length === 3, "All answers evaluated semantically");
    assert(submission.scorePercentage > 0, "Score percentage calculated accurately");
  } catch (e) {
    console.error(e);
    failed++;
  }

  // 5. Learner Profile, Mastery Tracking & Study Plan
  console.log("\n[TEST 5] Student Profile, Mastery & Roadmaps");
  try {
    const profile = ProfileService.getProfile();
    assert(Boolean(profile.name), "Student profile retrieved");

    const weak = ProfileService.getWeakTopics();
    assert(weak.length > 0, "Weak topics detected based on threshold");

    const plan = ProfileService.getStudyPlan();
    assert(plan.nodes.length >= 8, "Personalized roadmap with sequential nodes loaded");

    const recs = ProfileService.getRecommendations();
    assert(recs.length > 0, "Personalized revision & quiz recommendations generated");
  } catch (e) {
    console.error(e);
    failed++;
  }

  // 6. Supabase Persistence & Feedback Loop
  console.log("\n[TEST 6] Feedback Loop & Supabase Data Persistence");
  try {
    const fbRes = await SupabaseDataService.recordFeedback({
      topic: "Gradient Descent",
      question: "What is learning rate?",
      answerSnippet: "Learning rate alpha determines the step size taken down the loss curve...",
      rating: "helpful",
      comment: "Clear mountain-valley analogy",
    });
    assert(fbRes.success, "Feedback recorded successfully");

    const history = await SupabaseDataService.getRecentFeedback();
    assert(history.length > 0, "Recent feedback entries retrieved");
    assert(
      history.some((h) => h.topic === "Gradient Descent"),
      "Recorded feedback present in feedback history",
    );
  } catch (e) {
    console.error(e);
    failed++;
  }

  // 7. HTTP Server Endpoints (GET /api/tutor, POST /api/tutor, POST /api/feedback)
  console.log("\n[TEST 7] HTTP Server Endpoints (/api/tutor & /api/feedback)");
  try {
    // GET /api/tutor?topic=Math
    const reqGet = new Request(
      "http://localhost:8080/api/tutor?topic=Linear%20%26%20Logistic%20Regression&level=Beginner&mode=Explain",
      {
        method: "GET",
      },
    );
    const resGet = await serverEntry.fetch(reqGet, {}, {});
    assert(resGet.status === 200, "GET /api/tutor returns 200 OK");
    const jsonGet = (await resGet.json()) as { answer: string };
    assert(Boolean(jsonGet.answer), "GET /api/tutor returns AI response JSON");

    // POST /api/tutor
    const reqPost = new Request("http://localhost:8080/api/tutor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "Bias-Variance Tradeoff",
        level: "Intermediate",
        mode: "Explain",
        messages: [{ role: "user", content: "Explain overfitting vs underfitting." }],
      }),
    });
    const resPost = await serverEntry.fetch(reqPost, {}, {});
    assert(resPost.status === 200, "POST /api/tutor returns 200 OK");

    // POST /api/feedback
    const reqFb = new Request("http://localhost:8080/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic: "Bias-Variance Tradeoff",
        answerSnippet: "High bias causes underfitting...",
        rating: "helpful",
      }),
    });
    const resFb = await serverEntry.fetch(reqFb, {}, {});
    assert(resFb.status === 200, "POST /api/feedback returns 200 OK");

    // GET /api/feedback
    const reqFbGet = new Request("http://localhost:8080/api/feedback", { method: "GET" });
    const resFbGet = await serverEntry.fetch(reqFbGet, {}, {});
    assert(resFbGet.status === 200, "GET /api/feedback returns 200 OK");

    // CORS OPTIONS /api/tutor
    const reqOptions = new Request("http://localhost:8080/api/tutor", { method: "OPTIONS" });
    const resOptions = await serverEntry.fetch(reqOptions, {}, {});
    assert(resOptions.status === 204, "OPTIONS /api/tutor returns 204 No Content for CORS");
  } catch (e) {
    console.error(e);
    failed++;
  }

  console.log("\n==========================================");
  console.log(`RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log("==========================================");

  if (failed > 0) {
    process.exit(1);
  }
}

void runVerification();
