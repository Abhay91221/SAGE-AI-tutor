import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  topic: z.string().max(120),
  level: z.enum(["Beginner", "Intermediate", "Advanced"]),
  mode: z.enum(["Explain", "Quiz me", "Give an example"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) })).max(20),
});

export const askTutor = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) throw new Error("The tutor is unavailable right now. Please try again shortly.");
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: `You are a warm, rigorous interactive academic tutor called Mimo. The learner's current topic is ${data.topic}. Their level is ${data.level}. Current learning mode: ${data.mode}. Adapt vocabulary, depth and examples to that level. In Explain mode: give a clear answer, a concrete analogy or example, then one short check-for-understanding question. In Quiz me mode: ask ONE focused question at a time; do not reveal the answer until the learner responds, then give useful feedback. In Give an example mode: use a vivid, specific worked example. Answer any academic question even if it differs from the current topic. Be accurate, concise (around 100-180 words), conversational, and use plain text with light markdown only. Never pretend a learner's answer is correct when it isn't.` },
          ...data.messages,
        ],
      }),
    });
    if (!response.ok) {
      if (response.status === 402) throw new Error("The tutor has reached its usage limit. Please check your workspace credits.");
      throw new Error("The tutor couldn't respond just now. Please try again.");
    }
    const result = await response.json() as { choices?: { message?: { content?: string } }[] };
    return result.choices?.[0]?.message?.content?.trim() || "I couldn't put that into words. Could you ask again?";
  });
