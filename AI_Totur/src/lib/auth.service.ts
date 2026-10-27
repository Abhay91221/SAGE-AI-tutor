import bcrypt from "bcryptjs";
import * as jose from "jose";
import fs from "node:fs";
import path from "node:path";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredUser extends User {
  passwordHash: string;
  resetToken?: string;
  resetTokenExpiry?: number;
}

export interface RateLimitEntry {
  attempts: number;
  firstAttemptTime: number;
  blockedUntil?: number;
}

// In-memory sliding window rate limiter
const rateLimits = new Map<string, RateLimitEntry>();

// Rate limit helper
function checkRateLimit(
  key: string,
  maxAttempts: number = 5,
  windowMs: number = 15 * 60 * 1000,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const entry = rateLimits.get(key);

  if (!entry) {
    rateLimits.set(key, { attempts: 1, firstAttemptTime: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // If already temporarily blocked
  if (entry.blockedUntil && entry.blockedUntil > now) {
    const retryAfterSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  // Check if window has expired
  if (now - entry.firstAttemptTime > windowMs) {
    rateLimits.set(key, { attempts: 1, firstAttemptTime: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  // Within window
  entry.attempts += 1;
  if (entry.attempts > maxAttempts) {
    entry.blockedUntil = now + windowMs;
    const retryAfterSeconds = Math.ceil(windowMs / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

function resetRateLimit(key: string) {
  rateLimits.delete(key);
}

// Data Directory & Storage Path
const DATA_DIR = path.resolve(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

// Ensure data storage directory exists and seed initial demo user
function initStorage(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(USERS_FILE)) {
      const salt = bcrypt.genSaltSync(10);
      const demoHash = bcrypt.hashSync("SageLearner2026!", salt);
      const demoUser: StoredUser = {
        id: "usr_demo_sage",
        name: "Alex Morgan",
        email: "demo@sage.edu",
        role: "student",
        passwordHash: demoHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(USERS_FILE, JSON.stringify([demoUser], null, 2), "utf-8");
    }
  } catch (err) {
    console.warn("[AuthService] Warning initializing file storage, using in-memory fallback:", err);
  }
}

// In-memory fallback if disk access is restricted
let inMemoryUsers: StoredUser[] = [];

function loadUsers(): StoredUser[] {
  initStorage();
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      const parsed = JSON.parse(data) as StoredUser[];
      inMemoryUsers = parsed;
      return parsed;
    }
  } catch (err) {
    console.error("[AuthService] Error reading users file:", err);
  }
  return inMemoryUsers;
}

function saveUsers(users: StoredUser[]): void {
  inMemoryUsers = users;
  try {
    initStorage();
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (err) {
    console.error("[AuthService] Error saving users file:", err);
  }
}

// Input Sanitization & Validation
export function sanitizeString(val: unknown): string {
  if (typeof val !== "string") return "";
  return val
    .trim()
    .replace(/[<>]/g, ""); // Basic strip dangerous characters
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/;
  return emailRegex.test(email.toLowerCase()) && email.length <= 254;
}

export function validatePassword(password: string): { valid: boolean; reason?: string } {
  if (!password || password.length < 8) {
    return { valid: false, reason: "Password must be at least 8 characters long." };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one letter." };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, reason: "Password must contain at least one number." };
  }
  return { valid: true };
}

// JWT Helpers
function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET || "sage_production_super_secret_jwt_key_2026_antigravity";
  return new TextEncoder().encode(secret);
}

export async function createAuthToken(user: User): Promise<string> {
  return await new jose.SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getJwtSecret());
}

export async function verifyAuthToken(
  token: string,
): Promise<{ valid: boolean; payload?: jose.JWTPayload; error?: string }> {
  try {
    const { payload } = await jose.jwtVerify(token, getJwtSecret());
    return { valid: true, payload };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid token";
    return { valid: false, error: message };
  }
}

// Cookie Parsing & Serialization
export function parseCookies(cookieHeader: string | null): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((pair) => {
    const [key, ...rest] = pair.trim().split("=");
    if (key) {
      cookies[key.trim()] = decodeURIComponent(rest.join("="));
    }
  });
  return cookies;
}

export function createAuthCookie(token: string, maxAgeSeconds: number = 7 * 24 * 60 * 60): string {
  const isProd = process.env.NODE_ENV === "production";
  return `sage_auth_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${
    isProd ? "; Secure" : ""
  }`;
}

export function createClearAuthCookie(): string {
  return "sage_auth_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0";
}

// Strip passwordHash and reset token before sending to client
export function sanitizeUser(user: StoredUser): User {
  const { passwordHash: _, resetToken: __, resetTokenExpiry: ___, ...sanitized } = user;
  return sanitized;
}

// Main AuthService Class
export class AuthService {
  static getClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return request.headers.get("x-real-ip") || "127.0.0.1";
  }

  static async extractUserFromRequest(request: Request): Promise<User | null> {
    const cookieHeader = request.headers.get("cookie");
    const cookies = parseCookies(cookieHeader);
    let token = cookies["sage_auth_token"];

    if (!token) {
      const authHeader = request.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) return null;

    const verification = await verifyAuthToken(token);
    if (!verification.valid || !verification.payload?.sub) return null;

    const users = loadUsers();
    const user = users.find((u) => u.id === verification.payload?.sub);
    return user ? sanitizeUser(user) : null;
  }

  static async handleRequest(request: Request): Promise<Response | null> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    if (!pathname.startsWith("/api/auth")) {
      return null;
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    const clientIp = this.getClientIp(request);

    // 1. POST /api/auth/register
    if (pathname === "/api/auth/register" && request.method === "POST") {
      const limit = checkRateLimit(`reg_${clientIp}`, 10, 15 * 60 * 1000);
      if (!limit.allowed) {
        return new Response(
          JSON.stringify({
            error: `Too many registration attempts. Please wait ${limit.retryAfterSeconds} seconds.`,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": limit.retryAfterSeconds.toString(),
            },
          },
        );
      }

      const body = (await request.json().catch(() => ({}))) as {
        name?: string;
        email?: string;
        password?: string;
      };

      const name = sanitizeString(body.name);
      const email = sanitizeString(body.email).toLowerCase();
      const password = body.password || "";

      if (!name || name.length < 2) {
        return new Response(
          JSON.stringify({ error: "Please enter your name (at least 2 characters)." }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      if (!validateEmail(email)) {
        return new Response(
          JSON.stringify({ error: "Please enter a valid academic or personal email address." }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return new Response(JSON.stringify({ error: passwordCheck.reason }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const users = loadUsers();
      if (users.some((u) => u.email === email)) {
        return new Response(
          JSON.stringify({ error: "An account with this email address already exists." }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const newUser: StoredUser = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name,
        email,
        role: "student",
        passwordHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      users.push(newUser);
      saveUsers(users);

      const sanitized = sanitizeUser(newUser);
      const token = await createAuthToken(sanitized);
      const cookie = createAuthCookie(token);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Registration successful! Welcome to SAGE AI Tutor.",
          user: sanitized,
          token,
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        },
      );
    }

    // 2. POST /api/auth/login
    if (pathname === "/api/auth/login" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        email?: string;
        password?: string;
      };

      const email = sanitizeString(body.email).toLowerCase();
      const password = body.password || "";
      const rateLimitKey = `login_${clientIp}_${email}`;

      const limit = checkRateLimit(rateLimitKey, 5, 15 * 60 * 1000);
      if (!limit.allowed) {
        return new Response(
          JSON.stringify({
            error: `Too many failed attempts. Account temporarily locked for security. Please retry in ${Math.ceil(
              limit.retryAfterSeconds / 60,
            )} minutes.`,
          }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "Retry-After": limit.retryAfterSeconds.toString(),
            },
          },
        );
      }

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password are required to log in." }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const users = loadUsers();
      const user = users.find((u) => u.email === email);

      if (!user) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials. Please verify your email and password." }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials. Please verify your email and password." }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      // Login success -> reset rate limit
      resetRateLimit(rateLimitKey);

      const sanitized = sanitizeUser(user);
      const token = await createAuthToken(sanitized);
      const cookie = createAuthCookie(token);

      return new Response(
        JSON.stringify({
          success: true,
          message: `Welcome back, ${user.name}!`,
          user: sanitized,
          token,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        },
      );
    }

    // 3. POST /api/auth/logout
    if (pathname === "/api/auth/logout" && request.method === "POST") {
      const clearCookie = createClearAuthCookie();
      return new Response(
        JSON.stringify({ success: true, message: "Logged out successfully." }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": clearCookie,
          },
        },
      );
    }

    // 4. GET /api/auth/me
    if (pathname === "/api/auth/me" && request.method === "GET") {
      const user = await this.extractUserFromRequest(request);
      if (!user) {
        return new Response(
          JSON.stringify({ authenticated: false, error: "Not authenticated" }),
          { status: 401, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(JSON.stringify({ authenticated: true, user }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 5. POST /api/auth/forgot-password
    if (pathname === "/api/auth/forgot-password" && request.method === "POST") {
      const limit = checkRateLimit(`pwd_reset_${clientIp}`, 3, 15 * 60 * 1000);
      if (!limit.allowed) {
        return new Response(
          JSON.stringify({
            error: `Too many password reset requests. Please wait ${limit.retryAfterSeconds} seconds.`,
          }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        );
      }

      const body = (await request.json().catch(() => ({}))) as { email?: string };
      const email = sanitizeString(body.email).toLowerCase();

      if (!email || !validateEmail(email)) {
        return new Response(JSON.stringify({ error: "Please enter a valid email address." }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const users = loadUsers();
      const user = users.find((u) => u.email === email);

      // Secure handling: always respond with success to prevent user enumeration
      let resetToken = "";
      if (user) {
        // Generate cryptographic random hex token
        const array = new Uint8Array(24);
        crypto.getRandomValues(array);
        resetToken = Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
        user.resetToken = resetToken;
        user.resetTokenExpiry = Date.now() + 60 * 60 * 1000; // 1 hour expiry
        saveUsers(users);
      }

      return new Response(
        JSON.stringify({
          success: true,
          message:
            "If an account exists with that email, a password reset link has been dispatched.",
          // In development mode, provide token for streamlined verification
          devResetToken: process.env.NODE_ENV !== "production" ? resetToken : undefined,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // 6. POST /api/auth/reset-password
    if (pathname === "/api/auth/reset-password" && request.method === "POST") {
      const body = (await request.json().catch(() => ({}))) as {
        token?: string;
        password?: string;
      };

      const token = sanitizeString(body.token);
      const password = body.password || "";

      if (!token) {
        return new Response(
          JSON.stringify({ error: "Reset token is missing or has expired." }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const passwordCheck = validatePassword(password);
      if (!passwordCheck.valid) {
        return new Response(JSON.stringify({ error: passwordCheck.reason }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const users = loadUsers();
      const user = users.find(
        (u) =>
          u.resetToken === token && u.resetTokenExpiry && u.resetTokenExpiry > Date.now(),
      );

      if (!user) {
        return new Response(
          JSON.stringify({
            error: "Password reset link is invalid or has expired. Please request a new one.",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } },
        );
      }

      const salt = await bcrypt.genSalt(10);
      user.passwordHash = await bcrypt.hash(password, salt);
      user.resetToken = undefined;
      user.resetTokenExpiry = undefined;
      user.updatedAt = new Date().toISOString();
      saveUsers(users);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Password has been successfully updated! You can now log in with your new password.",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "Auth endpoint not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
}
