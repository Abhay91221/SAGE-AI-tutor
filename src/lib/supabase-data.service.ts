import { supabase } from "@/integrations/supabase/client";
import { TutorFeedback } from "./tutor.types";

/**
 * Service for managing Supabase data persistence:
 * - Answer ratings & feedback (feedback loop for pedagogical improvements)
 * - Study notes querying for RAG
 * Includes fail-safe fallbacks so the app operates smoothly offline or if
 * remote tables haven't been provisioned yet.
 */

// In-memory feedback store as fallback and local cache
const localFeedbackCache: TutorFeedback[] = [
  {
    id: "fb_init_1",
    topic: "Linear & Logistic Regression",
    question: "Explain the difference between Linear and Logistic Regression",
    answerSnippet: "Linear Regression fits a straight line to predict continuous numbers...",
    rating: "helpful",
    comment: "Clear analogy with house prices vs credit approval",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
  },
];

export class SupabaseDataService {
  /**
   * Save a user's rating / feedback on a tutor explanation to Supabase
   */
  public static async recordFeedback(feedback: {
    topic: string;
    question?: string;
    answerSnippet: string;
    rating: "helpful" | "unhelpful" | number;
    comment?: string;
  }): Promise<{ success: boolean; id: string; source: "supabase" | "local" }> {
    const id = "fb_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
    const record: TutorFeedback = {
      id,
      topic: feedback.topic,
      question: feedback.question,
      answerSnippet: feedback.answerSnippet.slice(0, 300),
      rating: feedback.rating,
      comment: feedback.comment,
      timestamp: new Date().toISOString(),
    };

    localFeedbackCache.unshift(record);

    try {
      // Attempt to save to Supabase 'tutor_feedback' table
      const { data, error } = await (supabase as any)
        .from("tutor_feedback")
        .insert([
          {
            id: record.id,
            topic: record.topic,
            question: record.question,
            answer_snippet: record.answerSnippet,
            rating: typeof record.rating === "number" ? record.rating.toString() : record.rating,
            comment: record.comment,
            created_at: record.timestamp,
          },
        ])
        .select();

      if (!error && data) {
        return { success: true, id, source: "supabase" };
      }
    } catch {
      // Supabase network unreachable or table not yet created
    }

    return { success: true, id, source: "local" };
  }

  /**
   * Fetch recent feedback entries
   */
  public static async getRecentFeedback(): Promise<TutorFeedback[]> {
    try {
      const { data, error } = await (supabase as any)
        .from("tutor_feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (!error && data && Array.isArray(data) && data.length > 0) {
        return data.map((d: Record<string, unknown>) => ({
          id: String(d["id"] || ""),
          topic: String(d["topic"] || ""),
          question: d["question"] ? String(d["question"]) : undefined,
          answerSnippet: String(d["answer_snippet"] || ""),
          rating: (d["rating"] as "helpful" | "unhelpful") || "helpful",
          comment: d["comment"] ? String(d["comment"]) : undefined,
          timestamp: String(d["created_at"] || new Date().toISOString()),
        }));
      }
    } catch {
      // Fallback to local cache
    }

    return localFeedbackCache;
  }

  /**
   * Fetch supplementary notes from Supabase for RAG augmentation
   */
  public static async fetchSupabaseNotes(topic?: string): Promise<string[]> {
    try {
      let query = (supabase as any).from("study_notes").select("content, topic");
      if (topic) {
        query = query.ilike("topic", `%${topic}%`);
      }
      const { data, error } = await query.limit(5);

      if (!error && data && Array.isArray(data) && data.length > 0) {
        return data.map(
          (item: Record<string, unknown>) =>
            `[Supabase Note: ${String(item["topic"] || "Study Material")}] ${String(item["content"] || "")}`,
        );
      }
    } catch {
      // Supabase table not present or offline
    }

    return [];
  }
}
