import { DocumentChunk, Level, Mode } from "./tutor.types";
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
    const { contextPrompt, citations, relevantChunks } = RAGService.buildAugmentedContext(
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
      if (relevantChunks && relevantChunks.length > 0) {
        answer = AgentOrchestrator.synthesizeRAGAnswer(
          lastUserMessage,
          req.topic,
          req.level,
          req.mode,
          relevantChunks,
          citations,
        );
      } else {
        answer = AgentOrchestrator.generateLocalFallback(
          req.topic,
          req.level,
          req.mode,
          lastUserMessage,
          citations,
        );
      }
    }

    // Append citation footer if RAG was used and answer doesn't include it
    if (citations.length > 0 && !answer.includes("[Source:")) {
      answer += `\n\nReference Sources: ${citations.join(", ")}`;
    }

    answer = cleanNaturalText(answer);

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
          "Use simple, everyday conversational language, clear intuition, minimal jargon without explanation, and supportive encouragement.";
        break;
      case "Intermediate":
        strategyGuidance =
          "Use accurate terminology, include practical code or math examples, explain trade-offs clearly, and check for conceptual understanding.";
        break;
      case "Advanced":
        strategyGuidance =
          "Dive into algorithmic complexity, mathematical formulation, edge cases, implementation caveats, and theoretical foundations.";
        break;
    }

    let modeGuidance = "";
    switch (mode) {
      case "Explain":
        modeGuidance =
          "Explain the concept with clear intuition and real-world clarity, avoiding robotic bullet headers, then close with a single conversational thought-provoking question.";
        break;
      case "Quiz me":
        modeGuidance =
          "Ask exactly ONE targeted conceptual question testing understanding. Do not reveal the answer until the student replies.";
        break;
      case "Give an example":
        modeGuidance =
          "Provide a clear, realistic worked example with concrete inputs, step-by-step logic, and final outcome.";
        break;
      case "Step-by-Step":
        modeGuidance = "Break down the concept into 3-4 numbered sequential steps.";
        break;
      case "Real-Life Analogy":
        modeGuidance =
          "Use a vivid, relatable real-life metaphor to make the abstract concept instantly click.";
        break;
      case "Show Formula":
        modeGuidance =
          "Present the core mathematical equations or algorithmic pseudocode with clear, plain-English variable definitions.";
        break;
      case "Give Hint":
        modeGuidance =
          "Give a gentle, insightful hint that guides the student to the answer without giving away the solution.";
        break;
    }

    return `You are SAGE, a friendly, insightful human academic tutor and pair-learning mentor tutoring ${studentName}.
Topic: ${topic}
Learner Level: ${level} (${strategyGuidance})
Current Mode: ${mode} (${modeGuidance})

${misconceptionAlert ? `Note: The student holds this misconception: "${misconceptionAlert}". Address this gently with a clear counter-example as part of your explanation.` : ""}

${contextPrompt}

WRITING & TONE GUIDELINES (STRICTLY REQUIRED):
1. SOUND LIKE A REAL HUMAN TEACHER: Write in a natural, conversational voice—like a passionate instructor at a whiteboard. Do NOT sound like an AI assistant. Never use boilerplate robotic intros ("Certainly!", "Here is a breakdown of...", "Great question!", "In conclusion...", "Let's dive in!"). Never start with "Here is [Topic] explained". Jump straight into the explanation naturally.
2. ZERO UNWANTED ASTERISKS: Do NOT use markdown bold asterisks (**) anywhere in your response. Output plain, clean text. Emphasize ideas naturally through sentence flow, word choice, and structure, never with double asterisks.
3. NO FORMULAIC AI TEMPLATES: Do not structure your explanation with rigid, robotic category headers like "- Concept:", "- Key Benefit:", "- Impact:", or "- Check for understanding:". Let your explanation flow naturally in readable paragraphs or organic comparisons.
4. NATURAL ENGAGEMENT: Close by naturally weaving in a thought-provoking scenario or question for the student, as a teacher would at the end of an explanation.
5. ACCURACY & CONCISENESS: Keep explanations clear, grounded, and concise (~120-180 words). If study material context is provided above, cite facts cleanly using [Source: Filename, Page X].`;
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

  /**
   * Synthesizes an intelligent pedagogical answer grounded directly in uploaded RAG chunks.
   * Ensures accurate answers even without external LLM API keys.
   */
  public static synthesizeRAGAnswer(
    userQuery: string,
    topic: string,
    level: Level,
    mode: Mode,
    chunks: DocumentChunk[],
    citations: string[],
  ): string {
    const docName = chunks[0]?.documentName || "your study material";
    const primaryCitation = citations[0] || `[Source: ${docName}]`;
    const combinedChunkText = chunks.map((c) => c.text).join("\n\n");

    // Split into logical blocks, grouping lines ending in colons with their values/equations
    const rawLines = combinedChunkText
      .split(/\r?\n+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 5 && !/^Page\s+\d+$/i.test(l));

    const groupedUnits: string[] = [];
    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i]!;
      if (line.endsWith(":") && i + 1 < rawLines.length) {
        groupedUnits.push(`${line} ${rawLines[i + 1]}`);
        i++;
      } else {
        groupedUnits.push(line);
      }
    }

    const queryWords = (userQuery || topic)
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const isFormulaQuery =
      /formula|equation|math|chemical|calculate|symbol/i.test(userQuery) || mode === "Show Formula";

    // Score units by relevance
    const scoredUnits = groupedUnits.map((unit) => {
      let score = 0;
      const uLower = unit.toLowerCase();
      for (const w of queryWords) {
        if (uLower.includes(w)) score += 4;
      }
      if (topic && uLower.includes(topic.toLowerCase())) score += 5;
      if (isFormulaQuery && (/[=<>+\-*/^]|->|\bsigma\b|\bfrac\b/i.test(unit) || uLower.includes("equation"))) {
        score += 8;
      }
      return { unit, score };
    });

    scoredUnits.sort((a, b) => b.score - a.score);
    const topUnits = scoredUnits
      .filter((u) => u.score > 0)
      .slice(0, 5)
      .map((u) => u.unit);

    const coreExcerpts = topUnits.length > 0 ? topUnits : groupedUnits.slice(0, 4);
    const mainIdea = coreExcerpts.join("\n\n");

    // Mode-specific pedagogical synthesis
    if (mode === "Quiz me") {
      const targetFact = coreExcerpts[0] || combinedChunkText.slice(0, 100);
      return `Based on your notes in ${docName}:\n\nHere is a check on your understanding:\n\nReviewing the core material: "${targetFact}"\n\nHow would you summarize the main mechanism or principle here in your own words, and why is it important?\n\nTake your best shot!`;
    }

    if (mode === "Give Hint") {
      const hintFact = coreExcerpts[0] || "Review the key relationships in your uploaded notes.";
      return `Here is a helpful hint grounded in ${docName}:\n\nHint: ${hintFact}\n\nNotice how this foundational rule dictates the behavior you are trying to understand.`;
    }

    if (mode === "Show Formula") {
      const formulaLines = groupedUnits.filter((s) =>
        /[=<>+\-*/^]|->|\bsigma\b|\bfrac\b|\bmin\b|\bmax\b|\bsum\b|\bprob\b/i.test(s),
      );

      if (formulaLines.length > 0) {
        return `Here are the key formulas and formal definitions from ${docName}:\n\n${formulaLines.map((fl) => `- ${fl}`).join("\n")}\n\nThese equations define the exact mathematical and algorithmic mechanics outlined in your material.`;
      }
      return `Here are the foundational principles and formal rules from ${docName}:\n\n${coreExcerpts.map((ce, i) => `${i + 1}. ${ce}`).join("\n")}\n\nWhich of these definitions or equations would you like to unpack further?`;
    }

    if (mode === "Step-by-Step") {
      return `Here is the step-by-step breakdown directly from ${docName}:\n\n${coreExcerpts
        .slice(0, 4)
        .map((step, idx) => `${idx + 1}. ${step}`)
        .join("\n\n")}\n\nEach step builds on the previous one. Does this sequential flow make sense?`;
    }

    if (mode === "Give an example") {
      return `Here is a practical perspective grounded in ${docName}:\n\n${mainIdea}\n\nWhen applying this in practice, you take the inputs and preconditions described in your material and trace how they produce the target outcome.\n\nWould you like to walk through a concrete scenario or calculation for this?`;
    }

    if (mode === "Real-Life Analogy") {
      return `To make the concepts in ${docName} intuitive:\n\n${mainIdea}\n\nThink of this like a precision blueprint or recipe: each parameter and condition must be set deliberately, otherwise the final result will deviate from what is intended.\n\nDoes that mental picture help clarify the concept?`;
    }

    // Default: "Explain"
    let levelLead = "";
    if (level === "Beginner") {
      levelLead = `In simple, clear terms from your uploaded notes (${docName}):\n\n${mainIdea}`;
    } else if (level === "Advanced") {
      levelLead = `Examining the technical mechanics outlined in ${docName}:\n\n${mainIdea}\n\nNotice how the underlying logic addresses edge cases and operational constraints.`;
    } else {
      levelLead = `Here is the explanation grounded directly in your notes (${docName}):\n\n${mainIdea}`;
    }

    return `${levelLead}\n\nQuick check to test your understanding: based on this concept from your notes, what is the most important factor or trade-off to keep in mind?`;
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

    // 1. Linear & Logistic Regression
    if (topicLower.includes("linear & logistic") || topicLower.includes("logistic regression")) {
      if (mode === "Quiz me") {
        return `Let's test your intuition on Linear & Logistic Regression${citationNote}:\n\nIf you were building a model to predict whether a borrower will default on a mortgage (where 0 means no and 1 means yes), why would using standard linear regression cause serious mathematical issues with your predictions?\n\nHow would you approach this?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful way to think about it${citationNote}:\n\nHint: Think about extreme feature values. A linear equation can produce numbers like -0.3 or +1.5, which do not make sense as probabilities between 0% and 100%.`;
      }
      if (mode === "Real-Life Analogy") {
        return `Think of linear regression like a bathroom scale: step on it, and the dial gives you an uncapped number along a continuous scale (like 150 lbs, 185 lbs). Think of logistic regression like a bouncer at a club door: they review your ID and make a binary decision—either you get in (1) or you do not (0), based on their confidence level between 0% and 100%. Does that mental model click?`;
      }
      if (mode === "Show Formula") {
        return `Here are the core formulas for Linear and Logistic Regression:\n\nLinear Regression:\ny = w · x + b\nPredicts continuous real numbers from negative infinity to positive infinity.\n\nLogistic Regression:\np = 1 / (1 + e^(-z)), where z = w · x + b\nThe S-shaped Sigmoid function squeezes any real number z into a valid probability p between 0 and 1.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is how to choose and apply either model step by step:\n\n1. Identify the target variable: If the output is a continuous number (like house prices), choose linear regression. If the output is a yes/no category (like pass/fail), choose logistic regression.\n2. Compute the weighted sum: Both models compute z = w · x + b across your input features.\n3. Apply the activation: Linear regression outputs z directly. Logistic regression feeds z through the Sigmoid function to produce a probability between 0 and 1.\n4. Make the classification decision: For logistic regression, if probability is 0.5 or higher, predict class 1; otherwise, predict class 0.`;
      }
      if (mode === "Give an example") {
        return `Let's compare them with real-world scenarios:\n\n- Linear Regression: Predicting house prices. Features include square footage (2,000) and number of bedrooms (3). The model computes an estimate: $425,000. It is predicting a continuous dollar amount.\n- Logistic Regression: Deciding if an email is spam. Features include count of suspicious links and sender reputation. The model outputs a probability of 0.91 (91% chance of spam). Because 0.91 is above 0.50, the email is moved to your spam folder.`;
      }
      return `The fundamental difference comes down to what you are trying to predict${citationNote}.\n\nLinear regression is designed for continuous quantities along a sliding scale—things like house prices, commute times, or outside temperature. It fits a straight line through your data points, so its predictions can stretch as high or low as needed.\n\nLogistic regression, despite having "regression" in its name, is actually used for classification. It answers yes-or-no questions, like whether an email is spam or whether a transaction is fraudulent. Because a probability has to stay strictly between 0 and 1 (or 0% and 100%), it routes the linear calculation through an S-shaped curve called the Sigmoid function. This gently squeezes extreme numbers into valid probability bounds.\n\nQuick scenario to test your intuition: if you were designing an algorithm to predict a student's final exam percentage score (0 to 100), would you use linear or logistic regression?`;
    }

    // 2. Structure of an atom
    if (topicLower.includes("atom")) {
      if (mode === "Quiz me") {
        return `Let's test your understanding of atomic structure${citationNote}:\n\nIf an electrically neutral atom has 6 protons, 6 neutrons, and 6 electrons, and it suddenly loses 2 electrons, what is its overall electrical charge and what kind of ion does it become?\n\nTake your best shot!`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful way to think about atomic charges${citationNote}:\n\nHint: Protons carry a +1 charge and electrons carry a -1 charge. Calculate (+6) plus (-4). Does the atom end up positive or negative?`;
      }
      if (mode === "Real-Life Analogy") {
        return `Imagine a massive sports stadium. If the atomic nucleus were a single marble resting right on the 50-yard line, the electrons would be like tiny gnats buzzing around the highest seats in the upper deck. Everything in between is completely empty air! That is the reality of an atom: over 99.9% of its mass is compressed into that tiny marble in the center, while the electron cloud defines its outer boundary. Does that picture help?`;
      }
      if (mode === "Show Formula") {
        return `Here are the foundational relationships in atomic structure:\n\n- Mass Number (A) = Protons (Z) + Neutrons (N)\n- Net Charge = Protons minus Electrons\n- Chemical Identity: Determined strictly by the atomic number Z (the number of protons in the nucleus).\n\nIn an electrically neutral atom, the number of positive protons exactly equals the number of negative electrons.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is the structural architecture of an atom in 4 key steps:\n\n1. The Dense Nucleus: At the very center, positively charged protons and neutral neutrons are locked tightly together by the strong nuclear force.\n2. The Electron Cloud: Extremely lightweight, negatively charged electrons occupy distinct energy shells orbiting the nucleus.\n3. Electrical Attraction: Opposite charges attract. The positive nucleus keeps the negative electrons bound in orbit.\n4. Chemical Identity: The proton count determines what element the atom is. Six protons will always make Carbon, regardless of how many neutrons or electrons it has.`;
      }
      if (mode === "Give an example") {
        return `Let's look at a concrete atom—Carbon-12:\n\n- Nucleus: Contains 6 protons (+6) and 6 neutrons (neutral).\n- Outer Shells: 6 electrons (-6) orbit the nucleus: 2 in the inner shell and 4 in the valence shell.\n- Net Charge: +6 and -6 balance out to exactly 0.\n- Real-world impact: Those 4 outer valence electrons are what allow Carbon to form strong bonds with other elements, creating DNA, proteins, and living matter.`;
      }
      return `Think of an atom as the fundamental building block of all matter, structured much like a miniature solar system, but held together by electrical charges instead of gravity${citationNote}.\n\nRight at the center is the nucleus, which contains positively charged protons and uncharged neutrons. Even though the nucleus takes up almost none of the atom's total physical volume, it holds more than 99.9% of its weight. Orbiting this nucleus in vast empty space are lightweight, negatively charged electrons. In a stable, neutral atom, the positive charge of the protons perfectly balances the negative charge of the electrons.\n\nQuick scenario to test your intuition: if you were to change the number of protons in an atom's nucleus, would you end up with a different isotope or an entirely different chemical element?`;
    }

    // 3. Bias-Variance Tradeoff
    if (topicLower.includes("bias-variance")) {
      if (mode === "Quiz me") {
        return `Let's test your intuition on the Bias-Variance Tradeoff${citationNote}:\n\nIf your model gets 99% accuracy on your training data but plummets to 55% accuracy on new test data, is it suffering from high bias or high variance?\n\nHow would you diagnose this?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful way to think about it${citationNote}:\n\nHint: High bias stems from an oversimplified model that fails to learn the pattern (underfitting), whereas high variance stems from an overcomplicated model memorizing training noise (overfitting).`;
      }
      if (mode === "Real-Life Analogy") {
        return `Think of preparing for an exam. High bias is like a student who only skimmed a single summary page and guesses 'C' for every question—too simple to pass anything (underfitting). High variance is like a student who memorized the practice test word for word, including typos and page numbers—they score 100% on the practice paper, but fail the real exam because new questions use different phrasing (overfitting). We want the sweet spot in the middle!`;
      }
      if (mode === "Show Formula") {
        return `Here is the mathematical decomposition of expected prediction error:\n\nTotal Error = Bias^2 + Variance + Irreducible Error\n\n- Bias^2: Error from overly simplistic model assumptions.\n- Variance: Error from excessive sensitivity to fluctuations in the training set.\n- Irreducible Error: Noise inherent in the problem that no algorithm can eliminate.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is how to diagnose and balance bias and variance:\n\n1. Compare training versus validation error: If both errors are high, you have High Bias (underfitting). If training error is low but validation error is high, you have High Variance (overfitting).\n2. Fixing High Bias: Increase model capacity, add more polynomial features, or reduce regularization.\n3. Fixing High Variance: Collect more training data, add L1/L2 regularization, or prune tree depth.\n4. Find the minimum: Stop tuning when validation error reaches its lowest point.`;
      }
      if (mode === "Give an example") {
        return `Imagine fitting data points that follow a gentle curve:\n\n- High Bias: Drawing a straight ruler through the curved points. It misses the bend because a straight line cannot curve.\n- High Variance: Connecting every single dot with a wild 20th-degree polynomial. It touches every training point, but whips wildly up and down between points.\n- Balanced Model: A quadratic curve that captures the general bend without chasing individual noise points.`;
      }
      return `Every machine learning model balances two competing sources of error: bias and variance${citationNote}.\n\nBias occurs when a model makes oversimplified assumptions about reality. For example, if you try to fit a straight line across data that clearly curves, the line simply lacks the capacity to capture the shape. That is underfitting: high bias leads to poor performance on both training and test data.\n\nVariance happens at the opposite extreme. If your model is overly flexible—like a deep, unconstrained decision tree—it will twist and turn to pass through every single stray noise point in your training set. It gets top marks in training, but completely fails on unseen data because it memorized the training noise instead of the real signal. That is overfitting.\n\nThe goal is always to find the balance where total error—the sum of bias squared, variance, and random noise—is as low as possible.\n\nWhat is one practical technique you would reach for to rein in a model that is suffering from high variance?`;
    }

    // 4. Gradient Descent
    if (topicLower.includes("gradient descent")) {
      if (mode === "Quiz me") {
        return `Let's test your intuition on Gradient Descent${citationNote}:\n\nWhat happens to the parameter optimization process if your learning rate alpha is set too large?\n\nWhat would you observe in the training loss curve?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful way to think about step size${citationNote}:\n\nHint: The gradient vector points in the direction of steepest loss increase, so we update weights by stepping downhill. If your step is larger than the valley itself, you risk bouncing out completely.`;
      }
      if (mode === "Real-Life Analogy") {
        return `Imagine you are blindfolded on a foggy mountain ridge and your goal is to find the lowest valley floor. You cannot see the landscape, but you can feel the tilt of the ground beneath your boots. You take a step in whichever direction slopes downward. Repeat that step by step, and as long as your steps are not wildly huge, you will steadily work your way down to the bottom.`;
      }
      if (mode === "Show Formula") {
        return `Here is the parameter update equation for Gradient Descent:\n\nw := w - alpha · grad(J(w))\n\n- w: Model weight parameters\n- alpha: Learning rate (step size)\n- J(w): Cost/Loss function (such as Mean Squared Error)\n- grad(J(w)): Vector of partial derivatives showing the direction of steepest increase.\n\nWe subtract the gradient because we want to minimize loss, not maximize it.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is how Gradient Descent iterates step by step:\n\n1. Initialize parameters: Start with random or zero-initialized weights.\n2. Forward pass: Compute predictions and calculate the current loss.\n3. Compute gradients: Calculate the partial derivative of loss with respect to each weight.\n4. Update weights: Step downhill by subtracting the learning rate multiplied by the gradient.\n5. Check convergence: Repeat until changes in loss fall below a small threshold.`;
      }
      if (mode === "Give an example") {
        return `Let's optimize a single weight w to minimize loss J(w) = (w - 4)^2:\n\n- Initial state: Let w = 10. The gradient is 2 * (10 - 4) = +12.\n- Update with learning rate alpha = 0.1: w := 10 - (0.1 * 12) = 8.8.\n- Notice w moved closer to the ideal value of 4!\n- Next step: Gradient is 2 * (8.8 - 4) = +9.6, giving w := 8.8 - 0.96 = 7.84.\n- Repeating this smoothly converges w to 4, where the gradient becomes zero.`;
      }
      return `Gradient descent is the optimization engine that powers almost all modern machine learning, from linear regression all the way to deep neural networks${citationNote}.\n\nWhen a model makes predictions, a loss function measures how far off those predictions are from reality. Our objective is to adjust the model's internal weights until that loss is minimized.\n\nThe gradient is a mathematical vector pointing in the direction of steepest loss increase. Because we want to minimize loss rather than maximize it, we take steps in the opposite direction—downhill. The learning rate dictates how large each step is: take steps that are too tiny, and training crawls along forever; take steps that are too large, and you will overshoot the valley entirely and destabilize your model.\n\nWhy do you think most real-world models use Mini-Batch Gradient Descent rather than computing gradients over the entire dataset at once?`;
    }

    // 5. Evaluation Metrics
    if (topicLower.includes("evaluation metrics")) {
      if (mode === "Quiz me") {
        return `Let's test your intuition on Evaluation Metrics${citationNote}:\n\nIn medical screening for a life-threatening disease where early detection is critical to save lives, is it more dangerous for a model to have low Precision or low Recall?\n\nWhat is your reasoning?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful way to think about the trade-off${citationNote}:\n\nHint: Precision focuses on avoiding false alarms (False Positives), while Recall focuses on avoiding missed cases (False Negatives).`;
      }
      if (mode === "Real-Life Analogy") {
        return `Think of fishing with a net. Precision is about whether everything you hauled into your boat is an edible fish rather than seaweed and old boots. Recall is about whether you caught all the fish that were in the pond, or if half of them slipped through the net.`;
      }
      if (mode === "Show Formula") {
        return `Here are the essential classification metrics:\n\n- Accuracy = (TP + TN) / (TP + TN + FP + FN)\n- Precision = TP / (TP + FP)  (measures exactness; minimizes false alarms)\n- Recall = TP / (TP + FN)     (measures completeness; avoids missed cases)\n- F1-Score = 2 · (Precision · Recall) / (Precision + Recall) (harmonic mean)\n\nTP = True Positive, TN = True Negative, FP = False Positive, FN = False Negative.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is how to evaluate a classification model step by step:\n\n1. Build the Confusion Matrix: Tally your TP, FP, TN, and FN counts.\n2. Check class balance: If one class makes up 99% of your data, disregard raw Accuracy.\n3. Match metric to risk: If false alarms are costly (like spam detection), optimize Precision. If missed positives are catastrophic (like cancer screening), optimize Recall.\n4. Harmonize with F1: Use the F1-Score when you need a single balanced number.`;
      }
      if (mode === "Give an example") {
        return `Consider testing 10,000 patients where only 10 actually have a rare disease:\n\n- A dummy model that labels everyone "Healthy" gets 99.9% Accuracy, but it caught 0 patients (Recall = 0%). It is totally useless.\n- A sensitive diagnostic model flags 50 people: it catches all 10 sick patients (Recall = 100%), but 40 are false alarms (Precision = 20%). In healthcare, this model is vastly better because follow-up testing can clear the false alarms, while all sick patients receive care.`;
      }
      return `Relying solely on Accuracy to judge a machine learning model is one of the most common pitfalls in data science, especially when dealing with imbalanced datasets${citationNote}.\n\nConsider fraud detection: if only 0.1% of transactions are fraudulent, a model that labels every single swipe as legitimate will achieve 99.9% accuracy. On paper it looks incredible, but in practice it is completely useless because it failed to stop a single dollar of fraud.\n\nThat is why we look deeper into Precision and Recall. Precision measures how many of the items you flagged as positive were actually positive—high precision means very few false alarms. Recall measures how many of the true positives in the real world your model succeeded in capturing—high recall means very few missed cases. The F1-score blends both into a single harmonic mean.\n\nCan you think of a scenario outside medicine where you would care much more about Precision than Recall?`;
    }

    // 6. Regularization (L1 & L2)
    if (topicLower.includes("regularization")) {
      if (mode === "Quiz me") {
        return `Let's test your intuition on Regularization${citationNote}:\n\nIf you have a dataset with 10,000 features and you suspect that only 25 of them actually contribute to the outcome, would you choose L1 (Lasso) or L2 (Ridge) regularization, and why?\n\nHow would you decide?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful hint${citationNote}:\n\nHint: L1 penalty uses absolute weights and can shrink unhelpful weights completely to zero (feature selection), while L2 penalty uses squared weights and shrinks them smoothly toward zero without dropping features.`;
      }
      if (mode === "Real-Life Analogy") {
        return `Think of packing a backpack for a mountain hike. L2 regularization is like telling yourself to pack lighter versions of everything—smaller tent, smaller stove, smaller water bottle. L1 regularization is like an aggressive minimalist: it dumps non-essential items out of your pack completely until only the absolute essentials remain.`;
      }
      if (mode === "Show Formula") {
        return `Here are the regularized loss formulas:\n\n- L1 Regularization (Lasso): Loss = Base Loss + lambda · sum(|w_i|)\n- L2 Regularization (Ridge): Loss = Base Loss + lambda · sum(w_i^2)\n\nlambda is the hyperparameter controlling regularization strength: higher lambda forces smaller weights to curb overfitting.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is how regularization controls model complexity step by step:\n\n1. Recognize overfitting: Training score is high, but validation score is low due to large, unstable weights.\n2. Select penalty type: Choose L1 (Lasso) if you want sparse weights and automatic feature selection. Choose L2 (Ridge) if you have correlated features you want to keep.\n3. Add the penalty term: Attach the lambda term to your loss function.\n4. Tune lambda: Use cross-validation to find the penalty value that yields the lowest test error.`;
      }
      if (mode === "Give an example") {
        return `Suppose you predict house prices using 100 features, including square feet, bedrooms, and 90 irrelevant noise features like paint color and previous owner's birth month:\n\n- With L2 (Ridge): The 90 noise features receive tiny weights (like 0.001), but stay in the model.\n- With L1 (Lasso): The optimization drives those 90 noise weights exactly to 0.0, leaving you with an interpretable model containing only the features that matter.`;
      }
      return `When models have access to many features, they often assign large weights to random coincidences in training data, which leads directly to overfitting${citationNote}. Regularization acts like a leash that penalizes models for relying on oversized weights.\n\nThe two most common forms are L1 (Lasso) and L2 (Ridge).\n\nL1 regularization adds a penalty equal to the absolute value of the weights. Because of its geometric shape, it drives less important feature weights all the way down to zero. This makes L1 great for automated feature selection when you suspect most of your variables are noise.\n\nL2 regularization adds a penalty proportional to the square of the weights. Instead of dropping features to zero, it shrinks them smoothly and evenly. This keeps all features in play while ensuring that no single feature dominates the model's decisions.\n\nWhat do you think happens to your model if you set the regularization penalty parameter lambda way too high?`;
    }

    // 7. Ensemble Methods
    if (topicLower.includes("ensemble methods")) {
      if (mode === "Quiz me") {
        return `Let's test your intuition on Ensemble Methods${citationNote}:\n\nWhich ensemble technique—Random Forest or XGBoost—focuses on sequential error correction where each new tree is trained specifically on the mistakes of earlier trees?\n\nHow does this impact model bias versus variance?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful hint${citationNote}:\n\nHint: Bagging (Random Forest) trains decision trees independently in parallel to lower variance, while Boosting (XGBoost) trains trees sequentially to lower bias.`;
      }
      if (mode === "Real-Life Analogy") {
        return `Bagging is like asking 50 doctors independently for their diagnosis and taking the majority vote—it smooths out individual biases. Boosting is like a master doctor reviewing an apprentice's initial diagnosis, correcting the specific mistakes, and passing those updated notes to a specialist who refines it even further.`;
      }
      if (mode === "Show Formula") {
        return `Here is how ensemble models aggregate predictions:\n\n- Bagging (Random Forest): Final Prediction = (1 / M) · sum(Tree_m(x))\n- Boosting (Gradient Boosting): Final Prediction = sum(alpha_m · Tree_m(x))\n\nIn boosting, each tree m is trained to predict the negative gradient (residual errors) of the ensemble up to tree m-1.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is how ensemble techniques operate step by step:\n\n1. Decide your objective: Use Bagging to reduce variance in high-capacity models. Use Boosting to reduce bias in simple learners.\n2. Bagging (Bootstrap Aggregating): Draw M bootstrap subsets with replacement, fit an independent tree on each, and average predictions.\n3. Boosting: Train a base tree, calculate residual errors on training instances, fit a new tree to predict those residuals, and repeat.\n4. Combine: Bagging uses equal averaging or majority vote; Boosting uses weighted summation.`;
      }
      if (mode === "Give an example") {
        return `Consider credit risk assessment:\n\n- Random Forest: Fits 100 trees on different random subsets of applicants and features. If 85 trees vote "Approve" and 15 vote "Deny", the ensemble confidently approves the applicant. The variance is substantially lower than any single tree.\n- XGBoost: Tree 1 makes a baseline prediction. Tree 2 focuses exclusively on the edge-case applicants Tree 1 got wrong. Tree 3 resolves the remaining tricky cases. Together, they create a sharp decision boundary.`;
      }
      return `Ensemble methods work on a simple intuition: the collective wisdom of a diverse group of models is almost always more reliable than the decision of any single model alone${citationNote}.\n\nThere are two primary ways to ensemble decision trees: Bagging and Boosting.\n\nIn Bagging, best known through Random Forest, we train dozens or hundreds of trees completely in parallel and independently. Each tree gets trained on a slightly different random slice of the data and a random subset of features. Because their individual mistakes are uncorrelated, averaging their predictions cancels out noise and dramatically lowers variance.\n\nIn Boosting, used by algorithms like XGBoost and LightGBM, trees are trained sequentially like a relay team. Each new tree is trained specifically to fix the residual mistakes made by the previous trees. This directly attacks model bias, turning a collection of modest learners into a high-performance system.\n\nBetween Random Forest and XGBoost, which one do you think is generally less prone to overfitting if you forget to tune your hyperparameters?`;
    }

    // 8. Feature Engineering
    if (topicLower.includes("feature engineering")) {
      if (mode === "Quiz me") {
        return `Let's test your intuition on Feature Engineering${citationNote}:\n\nWhy shouldn't we encode nominal categorical values like 'Red', 'Green', and 'Blue' as 1, 2, and 3 when training a linear model?\n\nWhat unintended assumption does that introduce?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful hint${citationNote}:\n\nHint: Sequential numeric values imply an ordinal rank (3 > 2 > 1). Use One-Hot Encoding for nominal categorical data instead.`;
      }
      if (mode === "Real-Life Analogy") {
        return `Imagine giving a chef a recipe where ingredients are described with vague poetry instead of grams and milliliters. The recipe will fail. Feature engineering is like translating raw observations into precise numerical measurements and clear indicators so the machine can process them cleanly.`;
      }
      if (mode === "Show Formula") {
        return `Here are common feature transformations:\n\n- Min-Max Scaling: x_scaled = (x - min) / (max - min) (bounds values between 0 and 1)\n- Standard Normalization (Z-score): z = (x - mean) / std_dev (centers at 0 with unit variance)\n- One-Hot Encoding: Category C becomes a binary column [0, 1, 0].`;
      }
      if (mode === "Step-by-Step") {
        return `Here is the feature engineering process step by step:\n\n1. Inspect raw distributions: Spot missing data, skewed distributions, and categorical strings.\n2. Handle missingness: Impute with median/mode or add a missingness indicator flag.\n3. Encode categories: Apply One-Hot Encoding for nominal features without order, and Ordinal Encoding when there is a true hierarchy.\n4. Scale numeric columns: Normalize or standardize continuous features so scale differences do not distort distance calculations.`;
      }
      if (mode === "Give an example") {
        return `Suppose you predict car prices with two features: mileage (10,000 to 200,000) and number of doors (2 to 5):\n\n- Without scaling: A difference of 5,000 miles completely dwarfs having 2 doors versus 5 doors in distance calculations, simply because 5,000 is a much bigger number.\n- With standardization: Both features are centered around zero with standard deviation 1, allowing the model to learn the true influence of both variables.`;
      }
      return `Machine learning algorithms do not understand raw real-world data on their own; they only understand geometry, numbers, and matrices${citationNote}. Feature engineering is the practice of transforming messy raw observations into clean representations that make patterns obvious to an algorithm.\n\nA classic example is handling text categories. If you encode 'Cat', 'Dog', and 'Bird' as 1, 2, and 3 in a regression model, the math unintentionally assumes that Bird is greater than Dog, and Dog is greater than Cat. To prevent that false ranking, we use One-Hot Encoding, which gives each animal its own dedicated yes-or-no column.\n\nAnother critical step is feature scaling. If one feature is Annual Income ($80,000) and another is Age (28), distance-based algorithms will let income completely overpower age simply because the numbers are bigger. Scaling both features onto a comparable range puts them on equal footing.\n\nWhy is it vital that you fit your scaler only on the training set and not on the whole dataset before splitting?`;
    }

    // 9. Dimensionality Reduction (PCA)
    if (topicLower.includes("dimensionality reduction") || topicLower.includes("pca")) {
      if (mode === "Quiz me") {
        return `Let's test your understanding of PCA${citationNote}:\n\nWhen Principal Component Analysis reduces a 100-feature dataset down to 10 dimensions, does it pick 10 existing columns or does it create brand new axes?\n\nWhat is your reasoning?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful hint${citationNote}:\n\nHint: PCA identifies new orthogonal axes (Principal Components) along directions of highest variance to compress feature space without simply throwing away columns.`;
      }
      if (mode === "Real-Life Analogy") {
        return `Imagine holding a 3D teapot in front of a flashlight and looking at its 2D shadow on the wall. If you orient the teapot poorly, the shadow is just an unrecognizable blob. But if you rotate the teapot until the shadow clearly shows the handle, body, and spout, you have captured almost all the essential 3D information in just two flat dimensions. That is what PCA does: it rotates your dataset until the projection preserves maximum variance.`;
      }
      if (mode === "Show Formula") {
        return `Here are the foundational steps in PCA:\n\n1. Center the data matrix: X_centered = X - mean(X)\n2. Covariance Matrix: Sigma = (1 / n) · X_centered^T · X_centered\n3. Eigen-decomposition: Sigma · v = lambda · v\n\n- v: Eigenvectors defining the new orthogonal principal axes.\n- lambda: Eigenvalues measuring the variance retained along each axis.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is how PCA reduces dimensions step by step:\n\n1. Standardize the data: Scale all features to mean 0 and variance 1.\n2. Compute the covariance matrix: Quantify how each pair of features correlates.\n3. Calculate eigenvectors and eigenvalues: Determine the directions of maximum spread and their importance.\n4. Select principal components: Retain the top k eigenvectors that account for 90-95% of total variance.\n5. Project onto new axes: Multiply the original data matrix by the chosen eigenvectors.`;
      }
      if (mode === "Give an example") {
        return `Imagine a health dataset with height measured in inches and height measured in centimeters:\n\n- These two features are 100% correlated and completely redundant.\n- PCA immediately spots this relationship. It merges both columns into a single principal component that preserves the variation in height and drops the second redundant axis with zero information loss.`;
      }
      return `When datasets contain dozens or hundreds of variables—like gene expressions or pixel values in computer vision—visualizing patterns becomes impossible, and models face the curse of dimensionality${citationNote}.\n\nPrincipal Component Analysis, or PCA, tackles this not by tossing out random columns, but by constructing brand new projection axes called Principal Components.\n\nEach new principal component is an orthogonal (perpendicular) linear combination of your original features. The very first component is aligned to capture the widest spread—or variance—in your data. The second component captures the next largest spread while remaining perpendicular to the first, and so on.\n\nBy retaining just the top few components that capture 90% or 95% of total variance, you can compress high-dimensional datasets down to a fraction of their original size while filtering out noise.\n\nCan you think of a situation where running PCA before training a model might actually make the model harder to interpret?`;
    }

    // 10. Clustering
    if (topicLower.includes("clustering")) {
      if (mode === "Quiz me") {
        return `Let's test your intuition on Clustering${citationNote}:\n\nIf your dataset contains data points shaped like two interlocking concentric rings with random noise dots scattered across the background, would K-Means or DBSCAN be the better choice?\n\nWhy does that algorithm succeed where the other fails?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful hint${citationNote}:\n\nHint: K-Means assumes spherical clusters around distance centroids, while DBSCAN groups dense regions and marks low-density points as noise.`;
      }
      if (mode === "Real-Life Analogy") {
        return `Think of organizing books in an uncataloged library. K-Means is like dividing your shelf space into exactly five equal sections and piling books into whichever section is closest to each pile's center. DBSCAN is like walking along the tables, noticing where books are clustered tightly in piles, and grouping each dense pile while ignoring the occasional stray flyer left on a chair.`;
      }
      if (mode === "Show Formula") {
        return `Here are the foundational formulas for clustering:\n\n- K-Means Objective (Inertia): Minimize sum across all clusters k of: sum ||x_i - mu_k||^2\n(where mu_k is the mean centroid of cluster k)\n\n- DBSCAN Core Criteria: A point is a core point if at least minPts neighbors exist within distance eps.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is how to apply clustering step by step:\n\n1. Select algorithm type: Choose K-Means if clusters are roughly spherical and you know K. Choose DBSCAN if you expect arbitrary shapes and noise.\n2. K-Means execution: Initialize K centroids randomly, assign points to nearest centroid, recompute centroids, and repeat until stable.\n3. DBSCAN execution: Identify core points with dense neighborhoods, expand clusters across reachable points, and flag isolated points as noise.\n4. Validation: Use the silhouette score or elbow method to evaluate cluster separation.`;
      }
      if (mode === "Give an example") {
        return `Consider customer segmentation in e-commerce:\n\n- Inputs: Customer annual spend and frequency of website visits.\n- Applying K-Means with K = 3 naturally identifies three groups: Frequent Budget Shoppers (high visits, low spend), Occasional Luxury Buyers (low visits, high spend), and Regular Loyalists (moderate visits, moderate spend).\n- The marketing team can now deliver tailored campaigns to each distinct group.`;
      }
      return `Clustering is unsupervised learning: we hand an algorithm a collection of data points without any labels or answer keys, and ask it to discover natural groupings on its own${citationNote}.\n\nThe most widely used method is K-Means. You choose the number of clusters K upfront, and the algorithm places K centroid markers in the data, iteratively moving them toward the center of nearby points until they settle. K-Means is fast and effective whenever clusters are roughly spherical and similar in size.\n\nHowever, if your data forms non-spherical shapes—like elongated curves or concentric circles—K-Means struggles because it cuts rigid boundaries. That is where density-based algorithms like DBSCAN excel: DBSCAN groups points that are packed densely together and treats sparse, isolated points as noise.\n\nWhat practical method would you use to decide the best value of K if you were using K-Means on an unfamiliar dataset?`;
    }

    // 11. Transformers & Deep Learning
    if (topicLower.includes("transformers") || topicLower.includes("deep learning")) {
      if (mode === "Quiz me") {
        return `Let's test your understanding of Transformers${citationNote}:\n\nWhat key architectural component allows Transformers to process entire text sequences in parallel rather than stepping sequentially through words like older recurrent networks?\n\nHow does this change GPU training efficiency?`;
      }
      if (mode === "Give Hint") {
        return `Here is a helpful hint${citationNote}:\n\nHint: Self-Attention calculates pairwise token contextual weights simultaneously rather than stepping sequentially through recurrent hidden states.`;
      }
      if (mode === "Real-Life Analogy") {
        return `Reading with an older RNN is like listening to an audio recording at 1x speed: you must hear word one, then word two, then word three in strict order, and by sentence ten you might forget how sentence one began. A Transformer is like looking at a printed page all at once with your eyes: you take in every word simultaneously and instantly notice how words on opposite sides of the paragraph relate to each other.`;
      }
      if (mode === "Show Formula") {
        return `Here is the Scaled Dot-Product Attention equation:\n\nAttention(Q, K, V) = softmax((Q · K^T) / sqrt(d_k)) · V\n\n- Q: Queries (what each token is searching for)\n- K: Keys (what each token offers)\n- V: Values (the actual token content)\n- d_k: Dimension of the keys, used as a scaling factor to prevent vanishing gradients.`;
      }
      if (mode === "Step-by-Step") {
        return `Here is how the Transformer processes text step by step:\n\n1. Tokenization and Embedding: Split text into tokens and add positional encodings so the model knows word order.\n2. Query, Key, and Value Projections: Transform token embeddings into Q, K, and V vectors.\n3. Compute Attention Scores: Multiply Q by K^T, scale by sqrt(d_k), and apply Softmax to get attention weights.\n4. Weighted Aggregation: Multiply attention weights by V to yield contextualized embeddings.\n5. Feed-Forward Layers: Pass through dense layers with residual connections and layer normalization.`;
      }
      if (mode === "Give an example") {
        return `Look at the word "bank" in two different sentences:\n\n- Sentence 1: "She sat by the river bank to watch the water."\n- Sentence 2: "He deposited money into the bank account."\n\nIn older static embeddings, "bank" has the exact same representation in both cases. In a Transformer, self-attention lets "bank" attend directly to "river" in Sentence 1 to know it means a shoreline, and to "money" in Sentence 2 to know it means a financial institution.`;
      }
      return `Traditional language models, such as RNNs and LSTMs, read sentences sequentially from left to right${citationNote}. This created two serious bottlenecks: they struggled to remember information across long passages, and training was inherently slow because word five could not be computed until word four was finished.\n\nThe Transformer architecture solved both challenges with the Self-Attention mechanism.\n\nInstead of stepping through tokens one by one, a Transformer ingests an entire sequence simultaneously in parallel. Through self-attention, every token compares itself with every other token in the sentence at the same time, computing contextual relationship weights.\n\nThis parallel architecture means Transformers can be trained at massive scale on modern GPUs, which is what made modern foundation models and LLMs possible.\n\nWhy do Transformers need positional encodings added to their input embeddings in the first place?`;
    }

    // Generic Fallback for Any Other Topic
    if (mode === "Quiz me") {
      return `Let's test your intuition on ${topic}${citationNote}:\n\nCan you explain the main goal of ${topic} and describe one scenario where you would choose to apply it?\n\nShare your thoughts and we will build from there!`;
    }

    if (mode === "Give Hint") {
      return `Here is a helpful way to think about ${topic}${citationNote}:\n\nHint: Start by considering what input it receives and what outcome or decision it produces. What is the fundamental trade-off involved?`;
    }

    if (mode === "Real-Life Analogy") {
      return `Think of ${topic} like looking up a word in an encyclopedia: instead of reading every page from beginning to end, you use the indexing structure to hone in directly on the exact information you need, saving time and effort. Does that comparison help?`;
    }

    if (mode === "Show Formula") {
      return `Here are the foundational mathematical or algorithmic principles for ${topic}:\n\n- Identify the governing equations or pseudocode rules for ${topic}.\n- Key variables: verify your input features, constraints, and objective function.\n\nWhich specific aspect or equation of ${topic} would you like to unpack further?`;
    }

    if (mode === "Step-by-Step") {
      return `Here is how to break down ${topic} step by step:\n\n1. Understand the core purpose of ${topic} and the problem it was created to solve.\n2. Identify the required inputs, data assumptions, and preconditions.\n3. Trace the intermediate transformations step by step.\n4. Evaluate the resulting output against your criteria.`;
    }

    if (mode === "Give an example") {
      return `Let's walk through a concrete scenario involving ${topic}:\n\n1. Initial state: We begin with our target problem instance.\n2. Transformation: We apply the core rules and operations of ${topic}.\n3. Outcome: The final result is produced with verifiable accuracy.\n\nWould you like to explore a specific variation or edge case of this?`;
    }

    return `When learning ${topic}, the most intuitive way to build lasting understanding is to look at the practical problem it was invented to solve, how its core components interact, and where its trade-offs lie${citationNote}.\n\nTo help me tailor this specifically for you: what particular aspect or application of ${topic} are you most curious about right now?`;
  }

  private static generateSuggestedFollowUp(topic: string, level: Level, mode: Mode): string {
    if (mode === "Quiz me") return "Test me with a harder question!";
    if (mode === "Explain") return "Can you give me a real-life analogy?";
    return `Can you quiz me on ${topic}?`;
  }
}

/**
 * Sanitizes tutor responses to remove artificial AI markdown asterisks and robotic labels,
 * ensuring the text reads naturally like a human teacher without unwanted **.
 */
export function cleanNaturalText(text: string): string {
  if (!text) return "";
  return text
    // Strip all markdown bold double asterisks (e.g. **word** -> word, or lone **)
    .replace(/\*\*/g, "")
    // Clean robotic label artifacts that sound like AI templates
    .replace(/\*Check for understanding:\*/gi, "Quick check:")
    .replace(/\*Check:\*/gi, "Quick check:")
    .replace(/\*Question:\*/gi, "Question:")
    .replace(/💡\s*\*Hint:\*/gi, "Hint:")
    .replace(/\*Hint:\*/gi, "Hint:")
    .replace(/\*Reference Sources:\*/gi, "Reference Sources:")
    // Strip single asterisks used as artificial markdown wrappers: *word* -> word
    .replace(/(^|\s)\*([^*\n]+)\*(\s|$)/g, "$1$2$3")
    .trim();
}
