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
  "linear & logistic regression": [
    {
      id: "q_llr_1",
      topic: "Linear & Logistic Regression",
      question: "What is the key functional difference between Linear Regression and Logistic Regression?",
      questionType: "mcq",
      options: [
        "Linear Regression fits a straight line for continuous predictions, while Logistic uses a sigmoid function for binary (0/1) probabilities",
        "Linear Regression works only on text, while Logistic Regression works only on numbers",
        "Logistic Regression predicts continuous numbers, while Linear Regression predicts 0 or 1",
        "Both use sigmoid functions to fit decision curves"
      ],
      correctAnswer: "Linear Regression fits a straight line for continuous predictions, while Logistic uses a sigmoid function for binary (0/1) probabilities",
      explanation: "Linear Regression outputs continuous values (-\u221E to +\u221E), whereas Logistic Regression applies the Sigmoid function \u03C3(z) = 1/(1+e^-z) to constrain predictions into binary probabilities between 0 and 1.",
      difficulty: "Beginner",
    },
    {
      id: "q_llr_2",
      topic: "Linear & Logistic Regression",
      question: "Which activation function squeezes real-valued numbers into probabilities between 0 and 1 in Logistic Regression?",
      questionType: "short_answer",
      correctAnswer: "Sigmoid function",
      explanation: "The Sigmoid (logistic) function maps any real input to a valid probability in the range (0, 1).",
      difficulty: "Intermediate",
    }
  ],
  "bias-variance tradeoff": [
    {
      id: "q_bvt_1",
      topic: "Bias-Variance Tradeoff",
      question: "A model suffers from High Variance. What behavior will it exhibit on training vs test data?",
      questionType: "mcq",
      options: [
        "Overfitting: High training accuracy but fails to generalize to test data",
        "Underfitting: Poor accuracy on both training and test data",
        "Zero error on all datasets",
        "Slow training speed due to small dataset size"
      ],
      correctAnswer: "Overfitting: High training accuracy but fails to generalize to test data",
      explanation: "High Variance means the model is overly complex and memorizes noise in the training set, leading to overfitting and poor test generalization.",
      difficulty: "Intermediate",
    },
    {
      id: "q_bvt_2",
      topic: "Bias-Variance Tradeoff",
      question: "High Bias in a machine learning model causes underfitting because the model is too simple.",
      questionType: "true_false",
      options: ["True", "False"],
      correctAnswer: "True",
      explanation: "High Bias occurs when model assumptions are overly simplistic (e.g., fitting a linear model to quadratic data), leading to underfitting.",
      difficulty: "Beginner",
    }
  ],
  "gradient descent": [
    {
      id: "q_gd_1",
      topic: "Gradient Descent",
      question: "What is the primary goal of the Gradient Descent optimization algorithm?",
      questionType: "mcq",
      options: [
        "Iteratively update model weights to minimize the cost/loss function",
        "Increase model bias to prevent overfitting",
        "Randomly shuffle feature columns before training",
        "Convert continuous numbers into binary 0s and 1s"
      ],
      correctAnswer: "Iteratively update model weights to minimize the cost/loss function",
      explanation: "Gradient Descent computes the gradient of the loss function with respect to weight parameters and updates weights in the negative gradient direction.",
      difficulty: "Intermediate",
    }
  ],
  "evaluation metrics": [
    {
      id: "q_em_1",
      topic: "Evaluation Metrics",
      question: "Why can raw Accuracy be a misleading evaluation metric for highly imbalanced datasets?",
      questionType: "short_answer",
      correctAnswer: "A model predicting only the majority class achieves high accuracy while failing completely on minority cases.",
      explanation: "On a 99% negative dataset, a dummy model predicting 100% negative gets 99% accuracy but zero recall on positive cases.",
      difficulty: "Intermediate",
    },
    {
      id: "q_em_2",
      topic: "Evaluation Metrics",
      question: "Which metric measures a model's ability to avoid False Positives?",
      questionType: "mcq",
      options: ["Precision", "Recall", "Accuracy", "Mean Absolute Error"],
      correctAnswer: "Precision",
      explanation: "Precision = True Positives / (True Positives + False Positives). High precision minimizes false alarms.",
      difficulty: "Intermediate",
    }
  ],
  "regularization (l1 & l2)": [
    {
      id: "q_reg_1",
      topic: "Regularization (L1 & L2)",
      question: "How does L1 Regularization (Lasso) differ from L2 Regularization (Ridge)?",
      questionType: "mcq",
      options: [
        "L1 (Lasso) shrinks unhelpful weights exactly to zero for feature selection; L2 (Ridge) shrinks weights close to zero",
        "L2 eliminates features completely, while L1 increases model variance",
        "L1 regularization is only used for image data",
        "L2 regularization multiplies loss by infinity"
      ],
      correctAnswer: "L1 (Lasso) shrinks unhelpful weights exactly to zero for feature selection; L2 (Ridge) shrinks weights close to zero",
      explanation: "L1 uses the absolute value of weights penalty |w| forcing sparse solutions, whereas L2 uses squared penalty w^2 for smooth weight decay.",
      difficulty: "Intermediate",
    }
  ],
  "ensemble methods": [
    {
      id: "q_ens_1",
      topic: "Ensemble Methods",
      question: "What is the key structural difference between Random Forest and XGBoost?",
      questionType: "mcq",
      options: [
        "Random Forest builds trees independently in parallel (Bagging); XGBoost builds trees sequentially to fix prior errors (Boosting)",
        "Random Forest is a single decision tree, while XGBoost uses linear regression",
        "XGBoost trains trees in parallel to reduce variance, while Random Forest builds sequentially",
        "Neither uses decision trees"
      ],
      correctAnswer: "Random Forest builds trees independently in parallel (Bagging); XGBoost builds trees sequentially to fix prior errors (Boosting)",
      explanation: "Bagging (Random Forest) reduces variance by averaging independent trees. Boosting (XGBoost) reduces bias by sequentially fitting new trees to residual errors.",
      difficulty: "Intermediate",
    }
  ],
  "feature engineering": [
    {
      id: "q_fe_1",
      topic: "Feature Engineering",
      question: "Which technique converts categorical text labels into binary indicator columns of 1s and 0s?",
      questionType: "mcq",
      options: ["One-Hot Encoding", "Feature Scaling", "Principal Component Analysis", "Sigmoid Activation"],
      correctAnswer: "One-Hot Encoding",
      explanation: "One-Hot Encoding transforms categorical variables into binary vectors so numerical algorithms can digest them without imposing false ordinal rank.",
      difficulty: "Beginner",
    }
  ],
  "dimensionality reduction (pca)": [
    {
      id: "q_pca_1",
      topic: "Dimensionality Reduction (PCA)",
      question: "What does Principal Component Analysis (PCA) preserve when projecting high-dimensional data onto fewer axes?",
      questionType: "short_answer",
      correctAnswer: "Maximum variance of the original dataset while dropping noise.",
      explanation: "PCA identifies orthogonal principal components along which data variance is maximized.",
      difficulty: "Advanced",
    }
  ],
  "clustering": [
    {
      id: "q_cls_1",
      topic: "Clustering",
      question: "How does DBSCAN clustering differ from K-Means clustering?",
      questionType: "mcq",
      options: [
        "K-Means partitions data into a fixed K distance-based clusters; DBSCAN groups based on spatial density and isolates noise/outliers",
        "K-Means automatically detects outliers, while DBSCAN requires K centroids upfront",
        "DBSCAN requires a target label Y, while K-Means is supervised",
        "K-Means uses decision trees to split clusters"
      ],
      correctAnswer: "K-Means partitions data into a fixed K distance-based clusters; DBSCAN groups based on spatial density and isolates noise/outliers",
      explanation: "K-Means assumes spherical clusters around K centroids. DBSCAN finds arbitrarily shaped dense clusters and explicitly labels sparse points as outliers.",
      difficulty: "Intermediate",
    }
  ],
  "transformers & deep learning": [
    {
      id: "q_tf_1",
      topic: "Transformers & Deep Learning",
      question: "What core mechanism enables Transformer neural networks to dynamically weigh connections across all sequence tokens in parallel?",
      questionType: "mcq",
      options: ["Self-Attention Mechanism", "Convolutions", "Recurrent Latent Loops", "Gradient Clipping"],
      correctAnswer: "Self-Attention Mechanism",
      explanation: "Self-Attention calculates attention scores between every pair of input tokens simultaneously, allowing Transformers to power modern LLMs.",
      difficulty: "Advanced",
    }
  ]
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

    const topicLower = topic.toLowerCase();

    if (topicLower.includes("linear & logistic") || topicLower.includes("logistic regression")) {
      whyWrong = "Misconception: Confusing continuous regression output with probability classification.";
      explanation = "Linear regression predicts unbounded continuous numbers (y = wx + b). Logistic regression uses a Sigmoid function to map inputs into binary probabilities (0 to 1).";
      counterExample = "Predicting house prices requires Linear Regression (\$500k continuous value), whereas predicting spam vs not-spam requires Logistic Regression (0.92 probability).";
      remedialHint = "Check whether your target variable Y is continuous (numeric) or discrete (category/probability).";
    } else if (topicLower.includes("bias-variance")) {
      whyWrong = "Misconception: Confusing underfitting (High Bias) with overfitting (High Variance).";
      explanation = "High Bias means the model is too simple (underfitting both train and test data). High Variance means the model memorizes training noise (overfitting).";
      counterExample = "A straight line fitted to complex curved data has High Bias (underfits). A 100th-degree polynomial connecting every noisy point has High Variance (overfits).";
      remedialHint = "Remember: High Bias = underfit (too simple); High Variance = overfit (memorizes noise).";
    } else if (topicLower.includes("gradient descent")) {
      whyWrong = "Misconception: Believing Gradient Descent updates parameters in the direction of steepest loss increase.";
      explanation = "Gradient Descent steps in the OPPOSITE (negative) direction of the gradient to MINIMIZE the cost function.";
      counterExample = "Walking uphill increases elevation (Gradient Ascent). Walking downhill into a valley minimizes elevation (Gradient Descent).";
      remedialHint = "Remember w_new = w_old - learning_rate * gradient (note the minus sign).";
    } else if (topicLower.includes("evaluation metrics")) {
      whyWrong = "Misconception: Assuming Accuracy is always a reliable metric regardless of class distribution.";
      explanation = "Accuracy fails on imbalanced data because predicting only the majority class gives high accuracy but misses all rare positive events.";
      counterExample = "In rare disease screening (1 in 10,000 cases), a test saying 'Healthy' for everyone has 99.99% accuracy but 0% recall, letting all sick patients go undetected.";
      remedialHint = "Use Precision (avoiding false positives), Recall (avoiding false negatives), and F1-Score (their balance) for imbalanced data.";
    } else if (topicLower.includes("regularization")) {
      whyWrong = "Misconception: Confusing L1 (Lasso) feature selection with L2 (Ridge) weight decay.";
      explanation = "L1 (Lasso) uses absolute penalties to drive weights completely to ZERO for feature selection. L2 (Ridge) uses squared penalties to shrink weights close to zero without dropping features.";
      counterExample = "In a 1000-feature model where only 10 matter, L1 zeroes out 990 noise features. L2 keeps all 1000 features with small weights.";
      remedialHint = "L1 = Lasso = zero weights = feature selection. L2 = Ridge = smooth weight reduction.";
    } else if (topicLower.includes("ensemble methods")) {
      whyWrong = "Misconception: Confusing parallel tree building (Bagging) with sequential error correction (Boosting).";
      explanation = "Random Forest (Bagging) builds trees in parallel independently to lower variance. XGBoost (Boosting) builds trees sequentially, fitting each new tree on prior residual errors to lower bias.";
      counterExample = "100 experts voting independently (Random Forest) lowers variance. A chain of tutors where each corrects the previous tutor's mistake (XGBoost) lowers bias.";
      remedialHint = "Bagging = parallel independent trees (low variance). Boosting = sequential error-correcting trees (low bias).";
    } else if (topicLower.includes("feature engineering")) {
      whyWrong = "Misconception: Confusing numeric scaling with categorical label encoding.";
      explanation = "Feature Scaling (MinMax/Z-score) normalizes numerical ranges. One-Hot Encoding converts text categories into binary (0/1) indicator columns.";
      counterExample = "Encoding 'Red', 'Green', 'Blue' as 1, 2, 3 tricks algorithms into thinking Blue is '3x greater than Red'. One-Hot Encoding creates separate 0/1 columns instead.";
      remedialHint = "Use One-Hot Encoding for unstructured text categories, and Scaling for continuous numbers.";
    } else if (topicLower.includes("dimensionality reduction") || topicLower.includes("pca")) {
      whyWrong = "Misconception: Believing PCA simply deletes unpromising feature columns.";
      explanation = "PCA does not just pick existing columns; it projects data onto entirely NEW linear axes (principal components) that maximize variance retention.";
      counterExample = "Instead of dropping Height or Weight, PCA creates a new axis 'Body Size' combining both to capture max variance.";
      remedialHint = "PCA constructs new orthogonal projection axes to compress high dimensions into fewer components.";
    } else if (topicLower.includes("clustering")) {
      whyWrong = "Misconception: Assuming K-Means and DBSCAN group data in the same way.";
      explanation = "K-Means partitions data into a fixed number of K distance-based spherical clusters. DBSCAN groups points based on local density and explicitly isolates noise/outliers.";
      counterExample = "For concentric ring patterns or data with random outlier dots, K-Means fails by slicing spherical groups, whereas DBSCAN traces the dense rings and flags outliers.";
      remedialHint = "Use K-Means when K is known and clusters are spherical; use DBSCAN for density-based arbitrary shapes and outlier removal.";
    } else if (topicLower.includes("transformers") || topicLower.includes("deep learning")) {
      whyWrong = "Misconception: Believing Transformers process sequence tokens one by one sequentially like old RNNs.";
      explanation = "Transformers process all sequence tokens simultaneously in parallel using Self-Attention mechanisms, enabling massive scalability in LLMs.";
      counterExample = "RNNs read word 1, then word 2, then word 3 sequentially. Transformers look at the entire sentence at once, calculating attention pairs between all words in parallel.";
      remedialHint = "Self-attention evaluates all token relationships simultaneously rather than step-by-step recurrence.";
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
