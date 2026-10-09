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
    topic: "Python",
    subject: "Machine Learning",
    masteryPercentage: 92,
    attemptsCount: 5,
    lastPracticed: "Yesterday",
    status: "mastered",
  },
  {
    topic: "Statistics",
    subject: "Machine Learning",
    masteryPercentage: 84,
    attemptsCount: 4,
    lastPracticed: "2 days ago",
    status: "mastered",
  },
  {
    topic: "Linear Regression",
    subject: "Machine Learning",
    masteryPercentage: 88,
    attemptsCount: 6,
    lastPracticed: "3 days ago",
    status: "mastered",
  },
  {
    topic: "Logistic Regression",
    subject: "Machine Learning",
    masteryPercentage: 65,
    attemptsCount: 3,
    lastPracticed: "Today",
    status: "learning",
  },
  {
    topic: "Decision Trees",
    subject: "Machine Learning",
    masteryPercentage: 48,
    attemptsCount: 4,
    lastPracticed: "Today",
    status: "weak",
  },
  {
    topic: "K-Means",
    subject: "Machine Learning",
    masteryPercentage: 55,
    attemptsCount: 2,
    lastPracticed: "Yesterday",
    status: "weak",
  },
  {
    topic: "Structure of an Atom",
    subject: "Physics",
    masteryPercentage: 90,
    attemptsCount: 5,
    lastPracticed: "1 day ago",
    status: "mastered",
  },
  {
    topic: "Photosynthesis",
    subject: "Biology",
    masteryPercentage: 78,
    attemptsCount: 3,
    lastPracticed: "4 days ago",
    status: "learning",
  },
];

const DEFAULT_STUDY_PLAN: StudyPlan = {
  id: "plan_ml_101",
  subject: "Machine Learning Core Roadmap",
  goal: "Build end-to-end understanding from fundamentals to PCA & Clustering",
  currentStepIndex: 4,
  nodes: [
    {
      id: "node_1",
      topic: "Python & Numpy Fundamentals",
      subject: "Machine Learning",
      description: "Array operations, vectorization, and data structures.",
      status: "completed",
      prerequisites: [],
      estimatedMinutes: 45,
    },
    {
      id: "node_2",
      topic: "Probability & Descriptive Statistics",
      subject: "Machine Learning",
      description: "Mean, variance, standard deviation, and distributions.",
      status: "completed",
      prerequisites: ["node_1"],
      estimatedMinutes: 60,
    },
    {
      id: "node_3",
      topic: "Linear Regression & Gradient Descent",
      subject: "Machine Learning",
      description: "Cost functions, mean squared error, and optimization.",
      status: "completed",
      prerequisites: ["node_2"],
      estimatedMinutes: 75,
    },
    {
      id: "node_4",
      topic: "Logistic Regression & Classification",
      subject: "Machine Learning",
      description: "Sigmoid function, cross-entropy loss, and decision boundaries.",
      status: "in_progress",
      prerequisites: ["node_3"],
      estimatedMinutes: 60,
    },
    {
      id: "node_5",
      topic: "Decision Trees & Entropy",
      subject: "Machine Learning",
      description: "Information gain, Gini impurity, and overfitting prevention.",
      status: "recommended",
      prerequisites: ["node_4"],
      estimatedMinutes: 90,
    },
    {
      id: "node_6",
      topic: "K-Means Clustering",
      subject: "Machine Learning",
      description: "Unsupervised centroid placement and elbow method.",
      status: "locked",
      prerequisites: ["node_5"],
      estimatedMinutes: 60,
    },
    {
      id: "node_7",
      topic: "PCA (Principal Component Analysis)",
      subject: "Machine Learning",
      description: "Dimensionality reduction, eigenvalues, and variance ratio.",
      status: "locked",
      prerequisites: ["node_6"],
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
