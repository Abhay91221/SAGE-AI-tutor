import {
  Level,
  Misconception,
  QuizAttemptResult,
  Recommendation,
  StudentProfile,
  StudyPlan,
  TopicMastery,
} from "./tutor.types";

/**
 * Service for Student Profile management, Learner Level assessment,
 * Weak Topic Detection, Progress Analytics, and Study Roadmaps.
 */

const DEFAULT_PROFILE: StudentProfile = {
  id: "student_default",
  name: "Curious Learner",
  classOrSemester: "B.Tech Computer Science - Semester 4",
  course: "Computer Science & Engineering",
  subjects: ["Machine Learning", "Data Structures & Algorithms", "Physics", "Calculus"],
  goals: "Master machine learning fundamentals and ace upcoming semester exams.",
  level: "Beginner",
  strongTopics: ["Python", "Linear Algebra", "Atomic Structure"],
  weakTopics: ["Decision Trees", "Logistic Regression", "K-Means"],
  quizHistory: [],
  learningHistory: [],
};

const INITIAL_MASTERY: TopicMastery[] = [
  {
    topic: "Linear & Logistic Regression",
    subject: "Machine Learning",
    masteryPercentage: 88,
    attemptsCount: 6,
    lastPracticed: "Yesterday",
    status: "mastered",
  },
  {
    topic: "Bias-Variance Tradeoff",
    subject: "Machine Learning",
    masteryPercentage: 62,
    attemptsCount: 3,
    lastPracticed: "Today",
    status: "weak",
  },
  {
    topic: "Gradient Descent",
    subject: "Machine Learning",
    masteryPercentage: 85,
    attemptsCount: 5,
    lastPracticed: "2 days ago",
    status: "mastered",
  },
  {
    topic: "Evaluation Metrics",
    subject: "Machine Learning",
    masteryPercentage: 68,
    attemptsCount: 4,
    lastPracticed: "Today",
    status: "learning",
  },
  {
    topic: "Regularization (L1 & L2)",
    subject: "Machine Learning",
    masteryPercentage: 74,
    attemptsCount: 3,
    lastPracticed: "3 days ago",
    status: "learning",
  },
  {
    topic: "Ensemble Methods",
    subject: "Machine Learning",
    masteryPercentage: 58,
    attemptsCount: 2,
    lastPracticed: "Yesterday",
    status: "weak",
  },
  {
    topic: "Feature Engineering",
    subject: "Machine Learning",
    masteryPercentage: 91,
    attemptsCount: 5,
    lastPracticed: "Yesterday",
    status: "mastered",
  },
  {
    topic: "Dimensionality Reduction (PCA)",
    subject: "Machine Learning",
    masteryPercentage: 79,
    attemptsCount: 4,
    lastPracticed: "1 day ago",
    status: "learning",
  },
  {
    topic: "Clustering",
    subject: "Machine Learning",
    masteryPercentage: 52,
    attemptsCount: 3,
    lastPracticed: "Today",
    status: "weak",
  },
  {
    topic: "Transformers & Deep Learning",
    subject: "AI & Deep Learning",
    masteryPercentage: 82,
    attemptsCount: 4,
    lastPracticed: "2 days ago",
    status: "mastered",
  },
  {
    topic: "Structure of an Atom",
    subject: "Physics",
    masteryPercentage: 90,
    attemptsCount: 5,
    lastPracticed: "1 day ago",
    status: "mastered",
  },
];

const DEFAULT_STUDY_PLAN: StudyPlan = {
  id: "plan_ml_101",
  subject: "Machine Learning & AI Master Roadmap",
  goal: "Build end-to-end mastery from Regression & Gradient Descent to Transformers & LLMs",
  currentStepIndex: 3,
  nodes: [
    {
      id: "node_1",
      topic: "Linear & Logistic Regression",
      subject: "Machine Learning",
      description: "Linear line-fitting for continuous prediction vs Logistic sigmoid curve for binary probabilities.",
      status: "completed",
      prerequisites: [],
      estimatedMinutes: 50,
    },
    {
      id: "node_2",
      topic: "Gradient Descent",
      subject: "Machine Learning",
      description: "Iterative weight optimization to minimize loss functions.",
      status: "completed",
      prerequisites: ["node_1"],
      estimatedMinutes: 60,
    },
    {
      id: "node_3",
      topic: "Bias-Variance Tradeoff",
      subject: "Machine Learning",
      description: "Balancing High Bias (underfitting) against High Variance (overfitting noise).",
      status: "in_progress",
      prerequisites: ["node_2"],
      estimatedMinutes: 45,
    },
    {
      id: "node_4",
      topic: "Evaluation Metrics",
      subject: "Machine Learning",
      description: "Precision, Recall, F1-Score, and handling imbalanced datasets.",
      status: "recommended",
      prerequisites: ["node_3"],
      estimatedMinutes: 50,
    },
    {
      id: "node_5",
      topic: "Regularization (L1 & L2)",
      subject: "Machine Learning",
      description: "L1 (Lasso) feature selection vs L2 (Ridge) weight decay.",
      status: "recommended",
      prerequisites: ["node_4"],
      estimatedMinutes: 60,
    },
    {
      id: "node_6",
      topic: "Ensemble Methods",
      subject: "Machine Learning",
      description: "Random Forest (parallel Bagging) and XGBoost (sequential Boosting).",
      status: "locked",
      prerequisites: ["node_5"],
      estimatedMinutes: 75,
    },
    {
      id: "node_7",
      topic: "Feature Engineering",
      subject: "Machine Learning",
      description: "Numerical scaling and One-Hot Encoding categorical features.",
      status: "locked",
      prerequisites: ["node_6"],
      estimatedMinutes: 45,
    },
    {
      id: "node_8",
      topic: "Dimensionality Reduction (PCA)",
      subject: "Machine Learning",
      description: "Compressing high-dimensional features while retaining max variance.",
      status: "locked",
      prerequisites: ["node_7"],
      estimatedMinutes: 60,
    },
    {
      id: "node_9",
      topic: "Clustering",
      subject: "Machine Learning",
      description: "Distance-based K-Means vs density-based DBSCAN with outlier isolation.",
      status: "locked",
      prerequisites: ["node_8"],
      estimatedMinutes: 60,
    },
    {
      id: "node_10",
      topic: "Transformers & Deep Learning",
      subject: "AI & Deep Learning",
      description: "Self-Attention mechanisms, sequence modeling, and Large Language Models (LLMs).",
      status: "locked",
      prerequisites: ["node_9"],
      estimatedMinutes: 90,
    },
  ],
};

export class ProfileService {
  private static profile: StudentProfile = { ...DEFAULT_PROFILE };
  private static mastery: TopicMastery[] = [...INITIAL_MASTERY];
  private static misconceptions: Misconception[] = [];
  private static studyPlan: StudyPlan = { ...DEFAULT_STUDY_PLAN };

  public static getProfile(): StudentProfile {
    return ProfileService.profile;
  }

  public static updateProfile(updates: Partial<StudentProfile>): StudentProfile {
    ProfileService.profile = { ...ProfileService.profile, ...updates };
    return ProfileService.profile;
  }

  public static getMasteryList(): TopicMastery[] {
    return ProfileService.mastery;
  }

  /**
   * Automated Weak Topic Detection
   * Evaluates accuracy < 70% or repeated errors to tag weak topics
   */
  public static getWeakTopics(): TopicMastery[] {
    return ProfileService.mastery.filter((m) => m.masteryPercentage < 70 || m.status === "weak");
  }

  public static getStrongTopics(): TopicMastery[] {
    return ProfileService.mastery.filter(
      (m) => m.masteryPercentage >= 80 || m.status === "mastered",
    );
  }

  /**
   * Record a topic quiz attempt and update learner level & mastery dynamically
   */
  public static recordQuizAttempt(attempt: QuizAttemptResult) {
    ProfileService.profile.quizHistory.unshift(attempt);

    // Update mastery score for topic
    const existing = ProfileService.mastery.find(
      (m) => m.topic.toLowerCase() === attempt.topic.toLowerCase(),
    );

    if (existing) {
      existing.attemptsCount += 1;
      existing.lastPracticed = "Just now";
      // Weighted moving average for mastery score
      existing.masteryPercentage = Math.round(
        existing.masteryPercentage * 0.4 + attempt.scorePercentage * 0.6,
      );
      if (existing.masteryPercentage >= 80) existing.status = "mastered";
      else if (existing.masteryPercentage >= 70) existing.status = "learning";
      else existing.status = "weak";
    } else {
      const status =
        attempt.scorePercentage >= 80
          ? "mastered"
          : attempt.scorePercentage >= 70
            ? "learning"
            : "weak";
      ProfileService.mastery.push({
        topic: attempt.topic,
        subject: "Academic Core",
        masteryPercentage: attempt.scorePercentage,
        attemptsCount: 1,
        lastPracticed: "Just now",
        status,
      });
    }

    // Update profile arrays
    const weakList = ProfileService.getWeakTopics().map((t) => t.topic);
    const strongList = ProfileService.getStrongTopics().map((t) => t.topic);
    ProfileService.profile.weakTopics = weakList;
    ProfileService.profile.strongTopics = strongList;

    // Learner Level Assessment auto-tuning
    ProfileService.autoEvaluateLearnerLevel();
  }

  /**
   * Auto-tune learner level based on recent quiz scores
   */
  public static autoEvaluateLearnerLevel(): Level {
    const recent = ProfileService.profile.quizHistory.slice(0, 3);
    if (recent.length === 0) return ProfileService.profile.level;

    const avgScore = recent.reduce((sum, item) => sum + item.scorePercentage, 0) / recent.length;

    let targetLevel: Level = ProfileService.profile.level;
    if (avgScore >= 88 && ProfileService.profile.level === "Beginner") {
      targetLevel = "Intermediate";
    } else if (avgScore >= 92 && ProfileService.profile.level === "Intermediate") {
      targetLevel = "Advanced";
    } else if (avgScore < 50 && ProfileService.profile.level === "Advanced") {
      targetLevel = "Intermediate";
    } else if (avgScore < 45 && ProfileService.profile.level === "Intermediate") {
      targetLevel = "Beginner";
    }

    if (targetLevel !== ProfileService.profile.level) {
      ProfileService.profile.level = targetLevel;
    }

    return targetLevel;
  }

  /**
   * Misconception Management
   */
  public static logMisconception(misconception: Misconception) {
    ProfileService.misconceptions.unshift(misconception);
  }

  public static getMisconceptions(): Misconception[] {
    return ProfileService.misconceptions;
  }

  public static resolveMisconception(id: string) {
    const item = ProfileService.misconceptions.find((m) => m.id === id);
    if (item) item.resolved = true;
  }

  /**
   * Personalized Recommendations Generator
   */
  public static getRecommendations(): Recommendation[] {
    const weak = ProfileService.getWeakTopics();
    const list: Recommendation[] = [];

    const firstWeak = weak[0];
    if (firstWeak) {
      list.push({
        id: "rec_weak_1",
        type: "revision",
        title: `Revise ${firstWeak.topic}`,
        description: `Your mastery in ${firstWeak.topic} is currently ${firstWeak.masteryPercentage}%. Let's solidify key concepts with an analogy and practice question.`,
        topic: firstWeak.topic,
        priority: "high",
        reason: `Topic mastery is under threshold (${firstWeak.masteryPercentage}%).`,
      });

      list.push({
        id: "rec_quiz_1",
        type: "quiz",
        title: `Take Quiz: ${firstWeak.topic}`,
        description: `Test your understanding with 3 target questions on ${firstWeak.topic}.`,
        topic: firstWeak.topic,
        priority: "high",
        reason: "Active recall reinforces weak neural pathways.",
      });
    }

    const currentPlanNode = ProfileService.studyPlan.nodes.find(
      (n) => n.status === "in_progress" || n.status === "recommended",
    );

    if (currentPlanNode) {
      list.push({
        id: "rec_next_1",
        type: "next_topic",
        title: `Explore ${currentPlanNode.topic}`,
        description: currentPlanNode.description,
        topic: currentPlanNode.topic,
        priority: "medium",
        reason: "Next logical step in your personalized study plan.",
      });
    }

    list.push({
      id: "rec_study_mat",
      type: "study_material",
      title: "Upload Lecture Notes or PDFs",
      description: "Ask SAGE AI Tutor questions directly from your syllabus or uploaded PDFs.",
      topic: "General Study Material",
      priority: "medium",
      reason: "Enhances answer accuracy with RAG source citations.",
    });

    return list;
  }

  /**
   * Study Plan & Roadmap Management
   */
  public static getStudyPlan(): StudyPlan {
    return ProfileService.studyPlan;
  }

  public static updateStudyPlanNodeStatus(
    nodeId: string,
    status: "completed" | "in_progress" | "recommended" | "locked",
  ) {
    const node = ProfileService.studyPlan.nodes.find((n) => n.id === nodeId);
    if (node) {
      node.status = status;
    }
  }
}
