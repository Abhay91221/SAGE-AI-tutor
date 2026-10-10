import { Level, Mode } from "./tutor.types";
import { ProfileService } from "./profile.service";
import { RAGService } from "./rag.service";
import { AssessmentService } from "./assessment.service";

/**
 * Agentic Tutor Orchestrator (Server-side compatible).
 * Coordinates tool calls, RAG retrieval, profile state, misconception alerts,
 * and adaptive prompt synthesis.
 */

export interface AgentRequest {
  topic: string;
  level: Level;
  mode: Mode;
  messages: { role: "user" | "assistant"; content: string }[];
  documentId?: string;
}

export interface AgentToolCall {
  toolName: string;
  args: Record<string, string>;
  output: string;
}

export interface AgentResponse {
  answer: string;
  toolCallsExecuted: AgentToolCall[];
  citations: string[];
  detectedMisconception?: string;
  suggestedFollowUp?: string;
  updatedLevel?: Level;
}

export class AgentOrchestrator {
  /**
   * Main entrypoint for processing user messages through the Agentic AI Tutor
   */
  public static async processRequest(req: AgentRequest): Promise<AgentResponse> {
    const toolCallsExecuted: AgentToolCall[] = [];
    const profile = ProfileService.getProfile();
    const lastUserMessage = req.messages[req.messages.length - 1]?.content || "";

    // 1. Tool Call: get_student_profile
    toolCallsExecuted.push({
      toolName: "get_student_profile",
      args: { studentId: profile.id },
      output: `Name: ${profile.name}, Level: ${req.level || profile.level}, Weak Topics: ${profile.weakTopics.join(", ")}`,
    });

    // 2. Tool Call: search_study_material (RAG Context)
    const { contextPrompt, citations } = RAGService.buildAugmentedContext(
      lastUserMessage || req.topic,
      req.documentId,
    );
    if (contextPrompt) {
      toolCallsExecuted.push({
        toolName: "search_study_material",
        args: { query: lastUserMessage, documentId: req.documentId || "" },
        output: `Retrieved ${citations.length} context chunk(s) from uploaded study materials: ${citations.join(", ")}`,
      });
    }

    // 3. Tool Call: Check for misconceptions in student query if answering a concept
    let detectedMisconception: string | undefined = undefined;
    if (
      lastUserMessage.toLowerCase().includes("unsorted") &&
      req.topic.toLowerCase().includes("binary search")
    ) {
      const misc = AssessmentService.detectMisconception(
        {
          id: "q_check",
          topic: req.topic,
          question: lastUserMessage,
          questionType: "short_answer",
          correctAnswer: "Binary search requires sorted data.",
          explanation: "Sorted arrays allow halving search space.",
          difficulty: req.level,
        },
        lastUserMessage,
      );
      detectedMisconception = misc.whyWrong;
      toolCallsExecuted.push({
        toolName: "detect_misconception",
        args: { topic: req.topic, studentInput: lastUserMessage },
        output: `Misconception detected: ${misc.whyWrong}. Counter-example: ${misc.counterExample}`,
      });
    }

    // 4. Construct System Instruction with Adaptive Strategy
    const systemPrompt = AgentOrchestrator.buildSystemPrompt(
      req.topic,
      req.level,
      req.mode,
      profile.name,
      contextPrompt,
      detectedMisconception,
    );

    // 5. Call LLM Gateway
    let answer = await AgentOrchestrator.callLLMGateway(systemPrompt, req.messages);

    if (!answer) {
      answer = AgentOrchestrator.generateLocalFallback(
        req.topic,
        req.level,
        req.mode,
        lastUserMessage,
        citations,
      );
    }

    // Append citation footer if RAG was used and answer doesn't include it
    if (citations.length > 0 && !answer.includes("[Source:")) {
      answer += `\n\n📌 *Reference Sources:* ${citations.join(", ")}`;
    }

    return {
      answer,
      toolCallsExecuted,
      citations,
      detectedMisconception,
      suggestedFollowUp: AgentOrchestrator.generateSuggestedFollowUp(
        req.topic,
        req.level,
        req.mode,
      ),
      updatedLevel: ProfileService.getProfile().level,
    };
  }

  private static buildSystemPrompt(
    topic: string,
    level: Level,
    mode: Mode,
    studentName: string,
    contextPrompt: string,
    misconceptionAlert?: string,
  ): string {
    let strategyGuidance = "";

    switch (level) {
      case "Beginner":
        strategyGuidance =
          "Use simple language, clear everyday analogies, zero jargon without explanation, short sentences, and friendly encouragement.";
        break;
      case "Intermediate":
        strategyGuidance =
          "Use technical terminology accurately, include practical code/math examples, explain trade-offs, and prompt for conceptual verification.";
        break;
      case "Advanced":
        strategyGuidance =
          "Dive into algorithmic complexity, mathematical formulations, edge cases, implementation caveats, and theoretical foundations.";
        break;
    }

    let modeGuidance = "";
    switch (mode) {
      case "Explain":
        modeGuidance =
          "Give a crisp explanation, one concrete analogy or code snippet, then close with a single check-for-understanding question to encourage active learning.";
        break;
      case "Quiz me":
        modeGuidance =
          "Ask exactly ONE targeted question testing understanding. Do not reveal the correct answer until the learner responds.";
        break;
      case "Give an example":
        modeGuidance =
          "Provide a detailed step-by-step worked example with input, step-by-step logic, and final output.";
        break;
      case "Step-by-Step":
        modeGuidance = "Break down the concept into 3-4 numbered sequential steps.";
        break;
      case "Real-Life Analogy":
        modeGuidance =
          "Use a vivid real-life metaphor (e.g. library catalog, post office, cookbook) to make the abstract concept instantly relatable.";
        break;
      case "Show Formula":
        modeGuidance =
          "Present the key mathematical formula or algorithmic pseudocode with clear variable definitions.";
        break;
      case "Give Hint":
        modeGuidance =
          "Give a subtle hint that guides the student to the answer without revealing the complete solution.";
        break;
    }

    return `You are SAGE AI Tutor (Smart Adaptive Guidance & Education), an expert academic teacher tutoring ${studentName}.
Topic: ${topic}
Learner Level: ${level} (${strategyGuidance})
Current Mode: ${mode} (${modeGuidance})

${misconceptionAlert ? `⚠️ ALERT: The learner holds a specific misconception: "${misconceptionAlert}". Address this directly with a counter-example before explaining further!` : ""}

${contextPrompt}

CRITICAL RULES:
1. Always encourage active learning—ask follow-up questions instead of just giving long passive lectures.
2. If RAG study material context is provided above, cite specific facts using [Source: Filename, Page X].
3. Be accurate, concise (~120-180 words), structured with markdown formatting, and clear. Never pretend an incorrect answer is correct.`;
  }

  private static async callLLMGateway(
    systemPrompt: string,
    messages: { role: "user" | "assistant"; content: string }[],
  ): Promise<string | null> {
    const apiKey =
      process.env["LOVABLE_API_KEY"] ||
      process.env["GEMINI_API_KEY"] ||
      process.env["OPENAI_API_KEY"] ||
      process.env["OPENROUTER_API_KEY"];

    if (!apiKey) return null;

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: systemPrompt }, ...messages.slice(-12)],
        }),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch {
      return null;
    }
  }

  private static generateLocalFallback(
    topic: string,
    level: Level,
    mode: Mode,
    userQuery: string,
    citations: string[],
  ): string {
    const citationNote = citations.length > 0 ? ` (based on notes in ${citations[0]})` : "";
    const topicLower = topic.toLowerCase();

    // Custom fallback explanations for the 10 core ML & AI topics
    if (topicLower.includes("linear & logistic") || topicLower.includes("logistic regression")) {
      if (mode === "Quiz me") {
        return `Here is a check question on **Linear & Logistic Regression** (${level} level)${citationNote}:\n\n*Question:* If you are predicting whether a student passes or fails an exam, which model should you choose (Linear or Logistic Regression) and why?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for **Linear & Logistic Regression** (${level} level)${citationNote}:\n\n💡 *Hint:* Linear Regression fits a continuous trend line ($-\\infty$ to $+\\infty$), while Logistic Regression applies a Sigmoid function $\\sigma(z) = \\frac{1}{1 + e^{-z}}$ to output probabilities ($0$ to $1$).`;
      }
      if (mode === "Real-Life Analogy") {
        return `Think of **Linear Regression** as drawing a straight trend line through house sizes to estimate their dollar prices (continuous value). Think of **Logistic Regression** as a credit approval desk that turns applicant scores into a Yes/No approval probability between 0% and 100% using a Sigmoid curve! Does that distinction make sense?`;
      }
      if (mode === "Show Formula") {
        return `Here are the core mathematical equations for **Linear & Logistic Regression**:\n\n- **Linear Regression:** $y = \\beta_0 + \\beta_1 x + \\epsilon$ (outputs continuous numbers $-\\infty$ to $+\\infty$)\n- **Logistic Regression:** $p = \\sigma(z) = \\frac{1}{1 + e^{-z}}$, where $z = \\mathbf{w}^T \\mathbf{x} + b$ (outputs probabilities $p \\in (0,1)$)\n\n*Check:* What happens to $\\sigma(z)$ when $z$ becomes very large and positive?`;
      }
      return `Here is the explanation for **Linear & Logistic Regression** (${level} level)${citationNote}:\n\n- **Linear Regression:** Fits a straight line to predict **continuous numbers** (e.g., predicting house prices, temperature, or salary).\n- **Logistic Regression:** Applies a **sigmoid function** $\\sigma(z) = \\frac{1}{1 + e^{-z}}$ to predict **binary probabilities** (0 or 1, e.g., spam vs. not spam, pass vs. fail).\n\n*Check for understanding:* If you are predicting whether a student passes or fails an exam, which model should you choose and why?`;
    }

    if (topicLower.includes("bias-variance")) {
      if (mode === "Quiz me") {
        return `Here is a check question on the **Bias-Variance Tradeoff** (${level} level)${citationNote}:\n\n*Question:* If your model gets 99% accuracy on training data but only 55% on test data, does it suffer from High Bias or High Variance?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for the **Bias-Variance Tradeoff** (${level} level)${citationNote}:\n\n💡 *Hint:* High Bias stems from an oversimplified model (underfitting), whereas High Variance stems from an overcomplicated model memorizing training noise (overfitting).`;
      }
      if (mode === "Real-Life Analogy") {
        return `Imagine taking an exam! **High Bias** is like a student who only studied 1 page and guesses 'C' for every question—too simple, fails everywhere (**underfitting**). **High Variance** is like a student who memorized the practice test font and typos word-for-word—gets 100% on practice but fails on new exam questions (**overfitting**). We want the sweet spot in the middle!`;
      }
      return `Here is the breakdown of the **Bias-Variance Tradeoff** (${level} level)${citationNote}:\n\n- **High Bias (Underfitting):** The model is **too simple** to capture underlying patterns (e.g., fitting a straight line to complex curved data).\n- **High Variance (Overfitting):** The model is **overly complex** and memorizes training noise instead of generalizing to unseen test data.\n- **Goal:** Minimize Total Error = $\\text{Bias}^2 + \\text{Variance} + \\text{Irreducible Error}$.\n\n*Check for understanding:* If your model gets 99% accuracy on training data but only 55% on test data, does it suffer from High Bias or High Variance?`;
    }

    if (topicLower.includes("gradient descent")) {
      if (mode === "Quiz me") {
        return `Here is a check question on **Gradient Descent** (${level} level)${citationNote}:\n\n*Question:* What happens if the learning rate $\\alpha$ is set too large during gradient descent optimization?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for **Gradient Descent** (${level} level)${citationNote}:\n\n💡 *Hint:* The gradient vector $\\nabla J(\\theta)$ points in the direction of steepest loss increase, so parameters are updated by stepping downhill: $\\theta := \\theta - \\alpha \\nabla J(\\theta)$.`;
      }
      if (mode === "Show Formula") {
        return `Here is the parameter update equation for **Gradient Descent**:\n\n$$\\theta_{j} := \\theta_{j} - \\alpha \\frac{\\partial}{\\partial \\theta_{j}} J(\\theta)$$\n\n- $\\theta_j$: Weight parameter\n- $\\alpha$: Learning rate (step size)\n- $J(\\theta)$: Cost/Loss function (e.g., Mean Squared Error)\n\n*Check:* Why do we subtract the gradient instead of adding it?`;
      }
      return `Here is how **Gradient Descent** works (${level} level)${citationNote}:\n\n- **Concept:** An optimization algorithm that iteratively adjusts weight parameters to **minimize a model's cost/loss function**.\n- **Analogy:** Imagine standing foggy on a mountain top. You feel the slope beneath your feet and step downhill in the direction of steepest decline until reaching the lowest valley floor.\n\n*Check for understanding:* What happens if the learning rate $\\alpha$ is set too large?`;
    }

    if (topicLower.includes("evaluation metrics")) {
      if (mode === "Quiz me") {
        return `Here is a check question on **Evaluation Metrics** (${level} level)${citationNote}:\n\n*Question:* In cancer screening, is it more dangerous to have a low Precision or a low Recall?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for **Evaluation Metrics** (${level} level)${citationNote}:\n\n💡 *Hint:* Precision ($TP / (TP + FP)$) measures exactness to minimize false alarms, while Recall ($TP / (TP + FN)$) measures completeness to avoid missing positive cases.`;
      }
      return `Here is your guide to **Evaluation Metrics** (${level} level)${citationNote}:\n\n- **Accuracy:** Can fail completely on imbalanced data (e.g., predicting 99% majority class).\n- **Precision:** $\\frac{TP}{TP + FP}$ — Focuses on **avoiding False Positives** (crucial for spam detection).\n- **Recall (Sensitivity):** $\\frac{TP}{TP + FN}$ — Focuses on **avoiding False Negatives** (crucial for medical diagnostics).\n- **F1-Score:** Harmonic mean $2 \\cdot \\frac{\\text{Precision} \\cdot \\text{Recall}}{\\text{Precision} + \\text{Recall}}$ balancing both.\n\n*Check for understanding:* In cancer screening, is it more dangerous to have a low Precision or a low Recall?`;
    }

    if (topicLower.includes("regularization")) {
      if (mode === "Quiz me") {
        return `Here is a check question on **Regularization** (${level} level)${citationNote}:\n\n*Question:* If you have 10,000 features and suspect 9,900 are useless noise, would you choose L1 (Lasso) or L2 (Ridge) regularization?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for **Regularization** (${level} level)${citationNote}:\n\n💡 *Hint:* L1 penalty ($\\lambda \\sum |w_i|$) can shrink unhelpful weights to absolute zero (feature selection), while L2 penalty ($\\lambda \\sum w_i^2$) shrinks weights smoothly toward zero.`;
      }
      return `Here is how **Regularization (L1 & L2)** prevents overfitting (${level} level)${citationNote}:\n\n- **L1 Regularization (Lasso):** Adds absolute penalty $\\lambda \\sum |w_i|$. Shrinks unhelpful weights **exactly to zero**, performing automatic **feature selection**.\n- **L2 Regularization (Ridge):** Adds squared penalty $\\lambda \\sum w_i^2$. Shrinks weights **close to zero**, reducing feature impact smoothly without dropping them.\n\n*Check for understanding:* If you have 10,000 features and suspect 9,900 are useless noise, would you choose L1 or L2 regularization?`;
    }

    if (topicLower.includes("ensemble methods")) {
      if (mode === "Quiz me") {
        return `Here is a check question on **Ensemble Methods** (${level} level)${citationNote}:\n\n*Question:* Which ensemble method (Random Forest or XGBoost) focuses on sequential error correction?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for **Ensemble Methods** (${level} level)${citationNote}:\n\n💡 *Hint:* Bagging (Random Forest) trains decision trees independently in parallel to reduce variance, while Boosting (XGBoost) trains trees sequentially to fix residual errors and lower bias.`;
      }
      return `Here is the difference between **Ensemble Methods** (${level} level)${citationNote}:\n\n- **Random Forest (Bagging):** Builds multiple decision trees **in parallel** independently on bootstrap sub-samples and averages their votes to **lower variance**.\n- **XGBoost (Boosting):** Builds trees **sequentially**, where each new tree is trained to fix the residual errors of prior trees to **lower bias**.\n\n*Check for understanding:* Which ensemble method focuses on sequential error correction?`;
    }

    if (topicLower.includes("feature engineering")) {
      if (mode === "Quiz me") {
        return `Here is a check question on **Feature Engineering** (${level} level)${citationNote}:\n\n*Question:* Why shouldn't we encode 'Red', 'Green', 'Blue' as 1, 2, 3 in linear models?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for **Feature Engineering** (${level} level)${citationNote}:\n\n💡 *Hint:* Sequential numeric values imply an ordinal magnitude relationship ($3 > 2 > 1$). Use One-Hot Encoding for nominal categorical data instead.`;
      }
      return `Here is the breakdown of **Feature Engineering** (${level} level)${citationNote}:\n\n- **Concept:** Modifying raw data so machine learning algorithms can interpret it effectively.\n- **Feature Scaling:** Equalizes numeric ranges (e.g., MinMax $[0,1]$ or Standard Z-Score) so large numbers like salary ($100k) don't dominate small numbers like age (25).\n- **One-Hot Encoding:** Converts categorical text (e.g. 'Red', 'Blue') into binary columns of 1s and 0s.\n\n*Check for understanding:* Why shouldn't we encode 'Red', 'Green', 'Blue' as 1, 2, 3 in linear models?`;
    }

    if (topicLower.includes("dimensionality reduction") || topicLower.includes("pca")) {
      if (mode === "Quiz me") {
        return `Here is a check question on **Dimensionality Reduction (PCA)** (${level} level)${citationNote}:\n\n*Question:* Does PCA select existing columns or create brand new projection axes?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for **Dimensionality Reduction (PCA)** (${level} level)${citationNote}:\n\n💡 *Hint:* PCA identifies new orthogonal axes (Principal Components) along directions of highest variance to compress feature space.`;
      }
      return `Here is **Dimensionality Reduction (PCA)** explained (${level} level)${citationNote}:\n\n- **Concept:** Compresses high-dimensional datasets with too many features by projecting them onto new orthogonal axes (Principal Components).\n- **Key Benefit:** Maximizes retention of dataset variance while removing noise and redundant correlations.\n\n*Check for understanding:* Does PCA select existing columns or create brand new projection axes?`;
    }

    if (topicLower.includes("clustering")) {
      if (mode === "Quiz me") {
        return `Here is a check question on **Clustering** (${level} level)${citationNote}:\n\n*Question:* Which algorithm (K-Means or DBSCAN) is better when your dataset has arbitrary ring shapes and heavy background noise?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for **Clustering** (${level} level)${citationNote}:\n\n💡 *Hint:* K-Means assumes spherical clusters around distance centroids, while DBSCAN groups dense regions and marks low-density points as noise.`;
      }
      return `Here is how **Clustering** algorithms work (${level} level)${citationNote}:\n\n- **Unsupervised Grouping:** Finds natural patterns without labeled Y targets.\n- **K-Means:** Separates data into $K$ fixed distance-based spherical clusters around centroids.\n- **DBSCAN:** Groups data based on **spatial density** and automatically isolates noise/outliers.\n\n*Check for understanding:* Which algorithm is better when your dataset has arbitrary ring shapes and heavy background noise?`;
    }

    if (topicLower.includes("transformers") || topicLower.includes("deep learning")) {
      if (mode === "Quiz me") {
        return `Here is a check question on **Transformers & Deep Learning** (${level} level)${citationNote}:\n\n*Question:* What key architectural component allows Transformers to process sequences in parallel instead of sequentially?\n\nTake your best shot and reply below!`;
      }
      if (mode === "Give Hint") {
        return `Here is a hint for **Transformers & Deep Learning** (${level} level)${citationNote}:\n\n💡 *Hint:* Self-Attention calculates pairwise token contextual weights simultaneously rather than stepping sequentially through recurrent states.`;
      }
      return `Here is **Transformers & Deep Learning** explained (${level} level)${citationNote}:\n\n- **Deep Neural Networks:** Learn hierarchical representations through stacked layers of artificial neurons.\n- **Transformers:** Use **Self-Attention mechanisms** to process entire text sequences in parallel, computing contextual weights between all tokens simultaneously.\n- **Impact:** Powers modern Large Language Models (LLMs) like Gemini, ChatGPT, and Claude.\n\n*Check for understanding:* What key architectural component allows Transformers to process sequences in parallel instead of sequentially?`;
    }

    if (mode === "Quiz me") {
      return `Here is a check question on **${topic}** (${level} level)${citationNote}:\n\n*Question:* Can you state the key condition or formula required for ${topic} to function properly?\n\nTake your best shot and reply below!`;
    }

    if (mode === "Give Hint") {
      return `Here is a hint for **${topic}** (${level} level)${citationNote}:\n\n💡 *Hint:* Consider the core concept and main operational steps of ${topic}. What key constraint or trade-off applies?`;
    }

    if (mode === "Real-Life Analogy") {
      return `Think of **${topic}** like searching for a word in a printed dictionary. Instead of reading every page from start to finish, you open to the middle, check if your word is earlier or later, and eliminate half the book immediately! That is the power of adaptive efficiency. Does that analogy make sense?`;
    }

    if (mode === "Give an example") {
      return `Let's work through a concrete example of **${topic}**:\n\n1. **Input:** We have a target problem instance.\n2. **Step 1:** Apply fundamental rules to evaluate the current state.\n3. **Step 2:** Refine state using iteration/transformation.\n4. **Result:** Optimal output achieved with verified accuracy.\n\nWould you like me to walk through another variation?`;
    }

    return `Here is a clear breakdown of **${topic}** for a ${level} level${citationNote}:\n\n- **Core Concept:** ${topic} establishes foundational logic used across academic and practical problem solving.\n- **Key Takeaway:** By understanding its underlying structure, you can solve complex problems systematically.\n\n*Check for understanding:* Have you encountered a practical scenario involving ${topic} before?`;
  }

  private static generateSuggestedFollowUp(topic: string, level: Level, mode: Mode): string {
    if (mode === "Quiz me") return "Test me with a harder question!";
    if (mode === "Explain") return "Can you give me a real-life analogy?";
    return `Can you quiz me on ${topic}?`;
  }
}
