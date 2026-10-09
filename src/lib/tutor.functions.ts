import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { AgentOrchestrator } from "./agent.orchestrator";
import { ProfileService } from "./profile.service";
import { RAGService } from "./rag.service";
import { AssessmentService } from "./assessment.service";

// Zod schemas for input validation
const askSchema = z.object({
  topic: z.string().max(120),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  mode: z.enum([
    "Explain",
    "Quiz me",
    "Give an example",
    "Step-by-Step",
    "Real-Life Analogy",
    "Show Formula",
    "Give Hint",
  ]),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(30),
  documentId: z.string().optional(),
});

const profileUpdateSchema = z.object({
  name: z.string().optional(),
  classOrSemester: z.string().optional(),
  course: z.string().optional(),
  goals: z.string().optional(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]).optional(),
});

const documentUploadSchema = z.object({
  filename: z.string(),
  rawText: z.string().min(5),
});

const quizGenerateSchema = z.object({
  topic: z.string(),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
});

const quizSubmitSchema = z.object({
  quizId: z.string(),
  topic: z.string(),
  difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
  questions: z.array(
    z.object({
      id: z.string(),
      topic: z.string(),
      question: z.string(),
      questionType: z.enum(["mcq", "short_answer", "true_false"]),
      options: z.array(z.string()).optional(),
      correctAnswer: z.string(),
      explanation: z.string(),
      difficulty: z.enum(["Beginner", "Intermediate", "Advanced"]),
    }),
  ),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string(),
    }),
  ),
});

/**
 * Server Function: Primary Agentic AI Tutor Chat Endpoint
 */
export const askTutor = createServerFn({ method: "POST" })
  .inputValidator((data) => askSchema.parse(data))
  .handler(async ({ data }) => {
    return await AgentOrchestrator.processRequest({
      topic: data.topic,
      level: data.level,
      mode: data.mode,
      messages: data.messages,
      documentId: data.documentId,
    });
  });

/**
 * Server Function: Fetch Student Profile & Mastery State
 */
export const getStudentProfileServerFn = createServerFn({ method: "POST" }).handler(async () => {
  return {
    profile: ProfileService.getProfile(),
    mastery: ProfileService.getMasteryList(),
    weakTopics: ProfileService.getWeakTopics(),
    strongTopics: ProfileService.getStrongTopics(),
    misconceptions: ProfileService.getMisconceptions(),
  };
});

/**
 * Server Function: Update Student Profile
 */
export const updateStudentProfileServerFn = createServerFn({ method: "POST" })
  .inputValidator((data) => profileUpdateSchema.parse(data))
  .handler(async ({ data }) => {
    return ProfileService.updateProfile(data);
  });

/**
 * Server Function: Upload & Process Study Material Document (RAG)
 */
export const uploadStudyMaterialServerFn = createServerFn({ method: "POST" })
  .inputValidator((data) => documentUploadSchema.parse(data))
  .handler(async ({ data }) => {
    const material = RAGService.processDocument(data.filename, data.rawText);
    return material;
  });

/**
 * Server Function: Fetch Uploaded Study Materials List
 */
export const getStudyMaterialsServerFn = createServerFn({ method: "POST" }).handler(async () => {
  return RAGService.getMaterials();
});

/**
 * Server Function: Delete Uploaded Study Material Document
 */
export const removeStudyMaterialServerFn = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    RAGService.removeMaterial(data.id);
    return { success: true };
  });

/**
 * Server Function: Generate Adaptive Quiz
 */
export const generateQuizServerFn = createServerFn({ method: "POST" })
  .inputValidator((data) => quizGenerateSchema.parse(data))
  .handler(async ({ data }) => {
    return AssessmentService.generateQuiz(data.topic, data.level);
  });

/**
 * Server Function: Submit & Evaluate Quiz Answers (Semantic AI Evaluation & Misconceptions)
 */
export const submitQuizServerFn = createServerFn({ method: "POST" })
  .inputValidator((data) => quizSubmitSchema.parse(data))
  .handler(async ({ data }) => {
    return AssessmentService.evaluateQuizAnswers(
      {
        id: data.quizId,
        topic: data.topic,
        difficulty: data.difficulty,
        questions: data.questions,
      },
      data.answers,
    );
  });

/**
 * Server Function: Fetch Personalized Recommendations
 */
export const getRecommendationsServerFn = createServerFn({ method: "POST" }).handler(async () => {
  return ProfileService.getRecommendations();
});

/**
 * Server Function: Fetch Personalized Study Plan & Roadmap
 */
export const getStudyPlanServerFn = createServerFn({ method: "POST" }).handler(async () => {
  return ProfileService.getStudyPlan();
});
