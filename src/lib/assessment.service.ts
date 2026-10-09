import {
  EvaluatedAnswer,
  Level,
  Misconception,
  Quiz,
  QuizAttemptResult,
  QuizQuestion,
  StudentAnswer,
} from "./tutor.types";
import { ProfileService } from "./profile.service";

/**
 * Service for Quiz Generation, Semantic Answer Evaluation, and Misconception Detection.
 */

// Fallback bank for reliable instant offline/fast quiz generation
const QUIZ_BANK: Record<string, QuizQuestion[]> = {
  "structure of an atom": [
    {
      id: "q_atom_1",
      topic: "Structure of an atom",
      question: "Which subatomic particle carries a negative electric charge?",
      questionType: "mcq",
      options: ["Proton", "Neutron", "Electron", "Nucleus"],
      correctAnswer: "Electron",
      explanation: "Electrons orbit the atomic nucleus and carry a -1 elementary charge.",
      difficulty: "Beginner",
    },
    {
      id: "q_atom_2",
      topic: "Structure of an atom",
      question: "The mass of an atom is concentrated almost entirely in its nucleus.",
      questionType: "true_false",
      options: ["True", "False"],
      correctAnswer: "True",
      explanation:
        "Protons and neutrons reside in the nucleus and make up >99.9% of the atom's mass.",
      difficulty: "Beginner",
    },
    {
      id: "q_atom_3",
      topic: "Structure of an atom",
      question: "What determines the atomic number of an element?",
      questionType: "short_answer",
      correctAnswer: "The number of protons in its nucleus.",
      explanation: "The number of protons uniquely identifies an element.",
      difficulty: "Intermediate",
    },
  ],
  "decision trees": [
    {
      id: "q_dt_1",
      topic: "Decision Trees",
      question:
        "Which metric is commonly used to measure impurity when splitting nodes in a classification decision tree?",
      questionType: "mcq",
      options: ["Mean Squared Error", "Gini Impurity / Entropy", "Euclidean Distance", "R-squared"],
      correctAnswer: "Gini Impurity / Entropy",
      explanation:
        "Decision trees split on features that maximize Information Gain (reducing Gini Impurity or Entropy).",
      difficulty: "Intermediate",
    },
    {
      id: "q_dt_2",
      topic: "Decision Trees",
      question:
        "What is a major risk of letting a decision tree grow without limiting its maximum depth?",
      questionType: "short_answer",
      correctAnswer: "Overfitting on the training data.",
      explanation:
        "Unconstrained decision trees memorize noise and outliers, causing high variance (overfitting).",
      difficulty: "Intermediate",
    },
  ],
  "logistic regression": [
    {
      id: "q_lr_1",
      topic: "Logistic Regression",
      question:
        "What function is used in Logistic Regression to map any real-valued number into a probability between 0 and 1?",
      questionType: "mcq",
      options: [
        "ReLU function",
        "Sigmoid (Logistic) function",
        "Softplus function",
        "Linear activation",
      ],
      correctAnswer: "Sigmoid (Logistic) function",
      explanation: "The Sigmoid function σ(z) = 1 / (1 + e^-z) squeezes output scores into (0, 1).",
      difficulty: "Intermediate",
    },
  ],
};

export class AssessmentService {
  /**
   * Generate a structured adaptive quiz for a given topic and level
   */
  public static generateQuiz(topic: string, level: Level): Quiz {
    const key = topic.toLowerCase();
    let questions: QuizQuestion[] = [];

    // Find matching questions from fallback bank or construct dynamic template
    for (const k of Object.keys(QUIZ_BANK)) {
      if (key.includes(k) || k.includes(key)) {
        questions = QUIZ_BANK[k] ?? [];
        break;
      }
    }

    if (questions.length === 0) {
      questions = [
        {
          id: `q_gen_1_${Date.now()}`,
          topic,
          question: `Which core principle best defines ${topic}?`,
          questionType: "mcq",
          options: [
            `Systematic execution of ${topic} rules`,
            `Random trial without feedback`,
            `Static tabular lookup`,
            `Unrelated data synthesis`,
          ],
          correctAnswer: `Systematic execution of ${topic} rules`,
          explanation: `${topic} relies on clear structural principles tailored to input parameters.`,
          difficulty: level,
        },
        {
          id: `q_gen_2_${Date.now()}`,
          topic,
          question: `Explain why understanding ${topic} is critical in practical applications.`,
          questionType: "short_answer",
          correctAnswer: `${topic} provides the foundational logic required to solve real-world domain problems.`,
          explanation: `Conceptual understanding allows generalization to novel problem contexts.`,
          difficulty: level,
        },
      ];
    }

    return {
      id: "quiz_" + Date.now(),
      topic,
      difficulty: level,
      questions,
    };
  }

  /**
   * Evaluate student quiz answers semantically and analyze misconceptions
   */
  public static evaluateQuizAnswers(
    quiz: Quiz,
    studentAnswers: StudentAnswer[],
  ): QuizAttemptResult {
    let totalScore = 0;
    const evaluatedAnswers: EvaluatedAnswer[] = [];
    const weakConceptsSet = new Set<string>();
    let recommendedRevision = "";

    for (const q of quiz.questions) {
      const studentAnsObj = studentAnswers.find((a) => a.questionId === q.id);
      const rawAns = studentAnsObj ? studentAnsObj.answer.trim() : "";

      let isCorrect = false;
      let scorePct = 0;
      let misconceptionText: string | undefined = undefined;
      let remedialHint: string | undefined = undefined;

      if (q.questionType === "mcq" || q.questionType === "true_false") {
        isCorrect = rawAns.toLowerCase() === q.correctAnswer.toLowerCase();
        scorePct = isCorrect ? 100 : 0;
      } else {
        // Semantic matching for short answers
        const cleanStudent = rawAns.toLowerCase();
        const cleanCorrect = q.correctAnswer.toLowerCase();
        const keywords = cleanCorrect.split(/\s+/).filter((w) => w.length > 3);
        const matchCount = keywords.filter((kw) => cleanStudent.includes(kw)).length;

        if (
          cleanStudent.includes(cleanCorrect) ||
          (keywords.length > 0 && matchCount / keywords.length >= 0.5)
        ) {
          isCorrect = true;
          scorePct = 100;
        } else if (matchCount > 0) {
          isCorrect = false;
          scorePct = 50;
        } else {
          isCorrect = false;
          scorePct = 0;
        }
      }

      if (!isCorrect) {
        weakConceptsSet.add(q.topic);

        // Misconception Detection logic
        const misconception = AssessmentService.detectMisconception(q, rawAns);
        misconceptionText = misconception.whyWrong;
        remedialHint = misconception.remedialHint;

        ProfileService.logMisconception(misconception);
      }

      totalScore += scorePct;
      evaluatedAnswers.push({
        questionId: q.id,
        questionText: q.question,
        studentAnswer: rawAns || "(No answer provided)",
        correctAnswer: q.correctAnswer,
        isCorrect,
        scorePercentage: scorePct,
        explanation: q.explanation,
        misconceptionDetected: misconceptionText,
        remedialHint,
      });
    }

    const overallScorePercentage = Math.round(totalScore / quiz.questions.length);
    const weakConcepts = Array.from(weakConceptsSet);

    if (weakConcepts.length > 0) {
      recommendedRevision = `Focus on reviewing: ${weakConcepts.join(", ")}. Review fundamental definitions and step-by-step examples.`;
    } else {
      recommendedRevision = `Great job! You have demonstrated strong mastery in ${quiz.topic}. Ready for advanced topics!`;
    }

    const result: QuizAttemptResult = {
      id: "attempt_" + Date.now(),
      quizId: quiz.id,
      topic: quiz.topic,
      timestamp: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      scorePercentage: overallScorePercentage,
      evaluatedAnswers,
      weakConcepts,
      recommendedRevision,
    };

    ProfileService.recordQuizAttempt(result);
    return result;
  }

  /**
   * Pinpoints why an answer is wrong and builds counter-examples & hints
   */
  public static detectMisconception(question: QuizQuestion, studentAnswer: string): Misconception {
    const topic = question.topic;
    const ansLower = studentAnswer.toLowerCase();

    let whyWrong = "The answer does not match the core principles of the concept.";
    let explanation = question.explanation;
    let counterExample = "Consider what happens when extreme or inverse conditions are applied.";
    let remedialHint = "Focus on the fundamental definition before attempting problem-solving.";

    if (topic.toLowerCase().includes("binary search") && ansLower.includes("unsorted")) {
      whyWrong = "Misconception: Believing Binary Search operates on unsorted arrays.";
      explanation =
        "Binary Search relies on dividing a sorted range in half. Unsorted arrays provide no directional signal for halving.";
      counterExample =
        "In array [5, 1, 9], comparing middle element 1 to target 9 gives no information about whether 9 is left or right.";
      remedialHint = "Always verify if the array is sorted before applying Binary Search.";
    } else if (topic.toLowerCase().includes("decision trees")) {
      whyWrong = "Misconception: Confusing split criteria or model capacity limitations.";
      explanation =
        "Decision trees create axis-aligned decision boundaries. Deep trees fit noise rather than underlying patterns.";
      counterExample =
        "A tree with depth 100 on 50 data points creates a leaf for every point, predicting training data perfectly but failing on new data.";
      remedialHint = "Use max_depth or min_samples_split to prevent overfitting.";
    }

    return {
      id: "misc_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6),
      topic,
      concept: question.question,
      studentAnswer: studentAnswer || "(Empty)",
      whyWrong,
      explanation,
      counterExample,
      remedialHint,
      resolved: false,
      dateDetected: new Date().toISOString(),
    };
  }
}
