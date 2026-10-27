import "./lib/error-capture";
import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { AgentOrchestrator, type AgentRequest } from "./lib/agent.orchestrator";
import { SupabaseDataService } from "./lib/supabase-data.service";
import { AuthService } from "./lib/auth.service";
import type { Level, Mode } from "./lib/tutor.types";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      // Handle Authentication Endpoints (/api/auth/*)
      const authResponse = await AuthService.handleRequest(request);
      if (authResponse) {
        return authResponse;
      }

      // Handle REST API Endpoint: /api/tutor (as specified in Project Overview)
      if (url.pathname === "/api/tutor") {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          });
        }

        if (request.method === "GET") {
          const topic = url.searchParams.get("topic") || "Linear & Logistic Regression";
          const level = (url.searchParams.get("level") || "Beginner") as Level;
          const mode = (url.searchParams.get("mode") || "Explain") as Mode;
          const query = url.searchParams.get("query") || url.searchParams.get("message") || "";

          const userMessages = query
            ? [{ role: "user" as const, content: query }]
            : [{ role: "user" as const, content: `Teach me about ${topic}.` }];

          const result = await AgentOrchestrator.processRequest({
            topic,
            level,
            mode,
            messages: userMessages,
          });

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        if (request.method === "POST") {
          const body = (await request.json().catch(() => ({}))) as Partial<AgentRequest>;
          const topic = body.topic || "Linear & Logistic Regression";
          const level = (body.level || "Beginner") as Level;
          const mode = (body.mode || "Explain") as Mode;
          const messages = body.messages || [
            { role: "user" as const, content: `Explain ${topic}` },
          ];

          const result = await AgentOrchestrator.processRequest({
            topic,
            level,
            mode,
            messages,
            documentId: body.documentId,
          });

          return new Response(JSON.stringify(result), {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }

      // Handle Feedback Endpoint: /api/feedback and /api/tutor/feedback
      if (url.pathname === "/api/feedback" || url.pathname === "/api/tutor/feedback") {
        if (request.method === "OPTIONS") {
          return new Response(null, {
            status: 204,
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type, Authorization",
            },
          });
        }

        if (request.method === "POST") {
          const body = (await request.json().catch(() => ({}))) as {
            topic: string;
            question?: string;
            answerSnippet: string;
            rating: "helpful" | "unhelpful" | number;
            comment?: string;
          };
          const res = await SupabaseDataService.recordFeedback(body);
          return new Response(JSON.stringify(res), {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }

        if (request.method === "GET") {
          const feedbackList = await SupabaseDataService.getRecentFeedback();
          return new Response(JSON.stringify(feedbackList), {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          });
        }
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
