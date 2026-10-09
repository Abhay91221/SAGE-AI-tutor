export type Level = "Beginner" | "Intermediate" | "Advanced";
export type Mode =
  | "Explain"
  | "Quiz me"
  | "Give an example"
  | "Step-by-Step"
  | "Real-Life Analogy"
  | "Show Formula"
  | "Give Hint";

export interface StudentProfile {
  id: string;
  name: string;
  classOrSemester: string;
  course: string;
  subjects: string[];
  goals: string;
  level: Level;
  strongTopics: string[];
  weakTopics: string[];
  quizHistory: QuizAttemptResult[];
  learningHistory: LearningHistoryEntry[];
}

export interface TopicMastery {
  topic: string;
  subject: string;
  masteryPercentage: number;
  attemptsCount: number;
  lastPracticed: string;
  status: "mastered" | "learning" | "weak";
}

export interface DocumentChunk {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber?: number;
  chunkIndex: number;
  text: string;
}

export interface StudyMaterial {
  id: string;
  name: string;
  size: number;
  uploadDate: string;
  chunksCount: number;
  chunks: DocumentChunk[];
}

export interface QuizQuestion {
  id: string;
  topic: string;
  question: string;
  questionType: "mcq" | "short_answer" | "true_false";
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: Level;
}

export interface Quiz {
  id: string;
  topic: string;
  difficulty: Level;
  questions: QuizQuestion[];
}

export interface StudentAnswer {
  questionId: string;
  answer: string;
}

export interface EvaluatedAnswer {
  questionId: string;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  scorePercentage: number;
  explanation: string;
  misconceptionDetected?: string;
  remedialHint?: string;
}

export interface QuizAttemptResult {
  id: string;
  quizId: string;
  topic: string;
  timestamp: string;
  scorePercentage: number;
  evaluatedAnswers: EvaluatedAnswer[];
  weakConcepts: string[];
  recommendedRevision: string;
}

export interface Misconception {
  id: string;
  topic: string;
  concept: string;
  studentAnswer: string;
  whyWrong: string;
  explanation: string;
  counterExample: string;
  remedialHint: string;
  resolved: boolean;
  dateDetected: string;
}

export interface LearningHistoryEntry {
  id: string;
  timestamp: string;
  topic: string;
  mode: string;
  userQuery: string;
  tutorResponseSnippet: string;
}

export interface StudyPlanNode {
  id: string;
  topic: string;
  subject: string;
  description: string;
  status: "completed" | "in_progress" | "recommended" | "locked";
  prerequisites: string[];
  estimatedMinutes: number;
}

export interface StudyPlan {
  id: string;
  subject: string;
  goal: string;
  nodes: StudyPlanNode[];
  currentStepIndex: number;
}

export interface Recommendation {
  id: string;
  type: "next_topic" | "revision" | "quiz" | "practice" | "study_material";
  title: string;
  description: string;
  topic: string;
  priority: "high" | "medium" | "low";
  reason: string;
}
