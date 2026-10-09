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

    if (mode === "Quiz me") {
      return `Here is a check question on **${topic}** (${level} level)${citationNote}:\n\n*Question:* Can you state the key condition or formula required for ${topic} to function properly?\n\nTake your best shot and reply below!`;
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
