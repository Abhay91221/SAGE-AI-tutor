import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Atom,
  BookOpen,
  ChevronDown,
  CircleHelp,
  Compass,
  GraduationCap,
  Lightbulb,
  Menu,
  MessageCircle,
  Plus,
  Send,
  Sparkles,
  X,
  FileText,
  HelpCircle,
  TrendingUp,
  MapPin,
  User,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtomScene } from "@/components/tutor/AtomScene";
import { StudyMaterialsView } from "@/components/tutor/StudyMaterialsView";
import { AdaptiveQuizView } from "@/components/tutor/AdaptiveQuizView";
import { ProgressDashboardView } from "@/components/tutor/ProgressDashboardView";
import { StudyPlannerView } from "@/components/tutor/StudyPlannerView";
import { StudentProfileModal } from "@/components/tutor/StudentProfileModal";
import type { AgentResponse } from "@/lib/agent.orchestrator";
import {
  Level,
  Mode,
  StudentProfile,
  StudyMaterial,
  TopicMastery,
  Misconception,
  StudyPlan,
} from "@/lib/tutor.types";
import {
  askTutor,
  getStudentProfileServerFn,
  getStudyMaterialsServerFn,
  getRecommendationsServerFn,
  getStudyPlanServerFn,
} from "@/lib/tutor.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "SAGE AI Tutor — Smart Adaptive Guidance & Education" },
      {
        name: "description",
        content:
          "Personalized AI tutor that teaches academic concepts, answers questions with RAG, and adapts to your learning level.",
      },
      { property: "og:title", content: "SAGE AI Tutor — Smart Adaptive Guidance & Education" },
      {
        property: "og:description",
        content:
          "Learn interactively with level-aware explanations, adaptive quizzes, RAG study materials, and misconception detection.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TutorPage,
});

type Message = {
  role: "user" | "assistant";
  content: string;
  toolCalls?: { toolName: string; output: string }[];
};

type ViewMode = "chat" | "materials" | "quiz" | "progress" | "plan";

const topics = [
  "Linear & Logistic Regression",
  "Bias-Variance Tradeoff",
  "Gradient Descent",
  "Evaluation Metrics",
  "Regularization (L1 & L2)",
  "Ensemble Methods",
  "Feature Engineering",
  "Dimensionality Reduction (PCA)",
  "Clustering",
  "Transformers & Deep Learning",
  "The structure of an atom",
];

const starters = [
  {
    icon: Lightbulb,
    title: "Linear & Logistic Regression",
    question: "Explain the difference between Linear and Logistic Regression, including the sigmoid function.",
  },
  {
    icon: BookOpen,
    title: "Bias-Variance Tradeoff",
    question: "What is the Bias-Variance Tradeoff, and how do underfitting and overfitting differ?",
  },
  {
    icon: Atom,
    title: "Transformers & LLMs",
    question: "How do Transformers use self-attention mechanisms to process sequences and power modern LLMs?",
  },
];

const actionChips: { label: string; mode: Mode; text: string }[] = [
  { label: "💡 Explain Simply", mode: "Explain", text: "Explain this concept in simple terms." },
  {
    label: "🔢 Step-by-Step",
    mode: "Step-by-Step",
    text: "Break this down into numbered step-by-step points.",
  },
  { label: "📝 Give Example", mode: "Give an example", text: "Give me a concrete worked example." },
  {
    label: "🏛️ Real-Life Analogy",
    mode: "Real-Life Analogy",
    text: "Use a vivid real-life analogy to explain this.",
  },
  {
    label: "📐 Show Formula",
    mode: "Show Formula",
    text: "Show the mathematical formula and key equations.",
  },
  {
    label: "🔑 Give Hint",
    mode: "Give Hint",
    text: "Give me a subtle hint to solve this problem.",
  },
  { label: "🎯 Test Me", mode: "Quiz me", text: "Quiz me on this concept with a question." },
];

function TutorPage() {
  const [activeView, setActiveView] = useState<ViewMode>("chat");
  const [topic, setTopic] = useState<string>("Linear & Logistic Regression");
  const [level, setLevel] = useState<Level>("Beginner");
  const [mode, setMode] = useState<Mode>("Explain");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);

  // State loaded from SAGE services
  const [profile, setProfile] = useState<StudentProfile>({
    id: "student_default",
    name: "Curious Learner",
    classOrSemester: "B.Tech Computer Science - Semester 4",
    course: "Computer Science & Engineering",
    subjects: ["Machine Learning", "Data Structures", "Physics"],
    goals: "Master academic concepts and ace exams",
    level: "Beginner",
    strongTopics: ["Python", "Structure of an atom"],
    weakTopics: ["Decision Trees", "Logistic Regression", "K-Means"],
    quizHistory: [],
    learningHistory: [],
  });
  const [masteryList, setMasteryList] = useState<TopicMastery[]>([]);
  const [weakTopics, setWeakTopics] = useState<TopicMastery[]>([]);
  const [strongTopics, setStrongTopics] = useState<TopicMastery[]>([]);
  const [misconceptions, setMisconceptions] = useState<Misconception[]>([]);
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [studyPlan, setStudyPlan] = useState<StudyPlan>({
    id: "plan_1",
    subject: "Machine Learning Core Roadmap",
    goal: "Build end-to-end understanding from fundamentals to PCA & Clustering",
    currentStepIndex: 3,
    nodes: [],
  });
  const [selectedDocId, setSelectedDocId] = useState<string | undefined>(undefined);
  const [selectedDocName, setSelectedDocName] = useState<string | undefined>(undefined);

  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  // Load initial backend state on mount
  useEffect(() => {
    void refreshBackendState();
  }, []);

  async function refreshBackendState() {
    try {
      const data = await getStudentProfileServerFn();
      setProfile(data.profile);
      setLevel(data.profile.level);
      setMasteryList(data.mastery);
      setWeakTopics(data.weakTopics);
      setStrongTopics(data.strongTopics);
      setMisconceptions(data.misconceptions);

      const mats = await getStudyMaterialsServerFn();
      setMaterials(mats);

      const plan = await getStudyPlanServerFn();
      setStudyPlan(plan);
    } catch (err) {
      console.error("Error loading SAGE initial state:", err);
    }
  }

  async function send(question?: string, overrideMode?: Mode) {
    const text = (question ?? input).trim();
    if (!text || loading) return;

    const currentMode = overrideMode || mode;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setError("");
    setLoading(true);

    try {
      const res = (await askTutor({
        data: {
          topic,
          level,
          mode: currentMode,
          messages: next.slice(-20),
          documentId: selectedDocId,
        },
      })) as AgentResponse;

      setMessages([
        ...next,
        {
          role: "assistant",
          content: res.answer,
          toolCalls: res.toolCallsExecuted,
        },
      ]);

      if (res.updatedLevel && res.updatedLevel !== level) {
        setLevel(res.updatedLevel);
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong. Please try again.",
      );
      setInput(text);
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setMessages([]);
    setInput("");
    setError("");
    setSidebarOpen(false);
    setActiveView("chat");
  }

  function selectTopic(value: string) {
    setTopic(value);
    reset();
  }

  function handleSelectDocForChat(docId: string, docName: string) {
    if (selectedDocId === docId) {
      setSelectedDocId(undefined);
      setSelectedDocName(undefined);
    } else {
      setSelectedDocId(docId);
      setSelectedDocName(docName);
      setActiveView("chat");
    }
  }

  function handleTopicPractice(tName: string) {
    setTopic(tName);
    setActiveView("chat");
    void send(`Teach me about ${tName.toLowerCase()}.`, "Explain");
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <span className="brand-mark">
            <Sparkles size={20} strokeWidth={2.4} />
          </span>
          <span>
            SAGE<span className="brand-dot">.</span>
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="mobile-close"
            aria-label="Close menu"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </Button>
        </div>

        <div className="sidebar-body">
          <Button variant="outline" className="new-session" onClick={reset}>
            <Plus size={16} /> New conversation <span className="new-plus">↗</span>
          </Button>

          <div className="sidebar-label">YOUR SPACE</div>
          <div
            className={`side-link ${activeView === "chat" ? "active" : ""}`}
            onClick={() => {
              setActiveView("chat");
              setSidebarOpen(false);
            }}
          >
            <Compass size={18} /> Tutor Chat{" "}
            {activeView === "chat" && <span className="active-indicator" />}
          </div>

          <div
            className={`side-link ${activeView === "materials" ? "active" : ""}`}
            onClick={() => {
              setActiveView("materials");
              setSidebarOpen(false);
            }}
          >
            <FileText size={18} /> Study Materials (RAG){" "}
            {activeView === "materials" && <span className="active-indicator" />}
          </div>

          <div
            className={`side-link ${activeView === "quiz" ? "active" : ""}`}
            onClick={() => {
              setActiveView("quiz");
              setSidebarOpen(false);
            }}
          >
            <HelpCircle size={18} /> Adaptive Quizzes{" "}
            {activeView === "quiz" && <span className="active-indicator" />}
          </div>

          <div
            className={`side-link ${activeView === "progress" ? "active" : ""}`}
            onClick={() => {
              setActiveView("progress");
              setSidebarOpen(false);
            }}
          >
            <TrendingUp size={18} /> Progress & Mastery{" "}
            {activeView === "progress" && <span className="active-indicator" />}
          </div>

          <div
            className={`side-link ${activeView === "plan" ? "active" : ""}`}
            onClick={() => {
              setActiveView("plan");
              setSidebarOpen(false);
            }}
          >
            <MapPin size={18} /> Study Planner{" "}
            {activeView === "plan" && <span className="active-indicator" />}
          </div>

          <div className="sidebar-label topics-label">POPULAR TOPICS</div>
          <div className="topic-list">
            {topics.map((item, i) => (
              <Button
                key={item}
                variant="ghost"
                className={`topic-item ${topic === item && activeView === "chat" ? "selected" : ""}`}
                onClick={() => selectTopic(item)}
              >
                <span className="topic-number">0{i + 1}</span>
                <span className="truncate">{item}</span>
              </Button>
            ))}
          </div>
        </div>

        <div
          className="sidebar-footer"
          onClick={() => setProfileModalOpen(true)}
          style={{ cursor: "pointer" }}
        >
          <div className="footer-icon">
            <GraduationCap size={21} />
          </div>
          <div>
            <strong>{profile.name}</strong>
            <span className="block text-xs text-muted-foreground">
              {level} • Click to edit profile
            </span>
          </div>
        </div>
      </aside>

      {sidebarOpen && <div className="mobile-scrim" onClick={() => setSidebarOpen(false)} />}

      {/* Main Content Area */}
      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <Button
              variant="ghost"
              size="icon"
              className="mobile-menu"
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </Button>
            <span className="breadcrumb">SAGE AI Tutor</span>
            <span className="crumb-sep">/</span>
            <span className="breadcrumb-current capitalize">{activeView}</span>
          </div>

          <div className="topbar-right">
            {selectedDocName && (
              <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                <FileText size={13} /> RAG Source: {selectedDocName}
              </span>
            )}
            <span className="status-dot" /> SAGE Ready
            <span className="header-divider" />
            <button
              onClick={() => setProfileModalOpen(true)}
              className="avatar hover:ring-2 hover:ring-primary transition-all"
              title="Edit Profile"
            >
              {profile.name.charAt(0)}
            </button>
          </div>
        </header>

        <div className="content-scroll">
          <div className="content-wrap">
            {/* VIEW 1: TUTOR CHAT (DEFAULT WORKSPACE) */}
            {activeView === "chat" && (
              <>
                <div className="welcome">
                  <div className="eyebrow">
                    <span className="eyebrow-line" /> SAGE AI TUTOR
                  </div>
                  <h1>
                    Curiosity looks good on you<span className="heading-period">.</span>
                  </h1>
                  <p>
                    Pick a topic, ask any question, and let SAGE AI Tutor adapt explanations to your
                    level.
                  </p>
                </div>

                <section className="feature-panel" aria-label="Current learning topic">
                  <div className="feature-copy">
                    <div className="feature-tag">
                      <span className="feature-tag-dot" /> CURRENTLY EXPLORING
                    </div>
                    <h2>{topic}</h2>
                    <p>
                      Big ideas start small. Take a closer look, ask anything, and make it make
                      sense.
                    </p>
                    <Button
                      className="feature-cta"
                      onClick={() => void send(`Teach me about ${topic.toLowerCase()}.`)}
                    >
                      Explore this topic <ArrowRight size={17} />
                    </Button>
                  </div>
                  <div className="feature-visual">
                    <div className="visual-grid" />
                    <AtomScene />
                    <span className="visual-caption">
                      THE WORLD, UP CLOSE <span>✦</span>
                    </span>
                  </div>
                </section>

                <div className="section-heading">
                  <div>
                    <span className="section-kicker">START SOMEWHERE</span>
                    <h3>What sparks your interest?</h3>
                  </div>
                  <span className="section-aside">
                    A little curiosity goes a long way <ArrowRight size={15} />
                  </span>
                </div>

                <div className="starter-grid">
                  {starters.map(({ icon: Icon, title, question }, i) => (
                    <Button
                      key={title}
                      variant="outline"
                      className="starter-card"
                      onClick={() => void send(question)}
                    >
                      <span className={`starter-icon starter-${i}`}>
                        <Icon size={21} strokeWidth={1.8} />
                      </span>
                      <span className="starter-text">
                        <strong>{title}</strong>
                        <small>{question}</small>
                      </span>
                      <ArrowRight className="starter-arrow" size={17} />
                    </Button>
                  ))}
                </div>

                {/* Tutor Chat Conversation */}
                <section className="conversation" aria-label="Tutor conversation">
                  <div className="conversation-heading">
                    <div className="conversation-heading-icon">
                      <MessageCircle size={19} />
                    </div>
                    <div>
                      <h3>Your Tutor Conversation</h3>
                      <p>
                        Level: {level} • Mode: {mode}
                      </p>
                    </div>
                    <span className="conversation-count">
                      {messages.length ? `${messages.length} messages` : "NEW SESSION"}
                    </span>
                  </div>

                  {messages.length === 0 ? (
                    <div className="empty-chat">
                      <div className="empty-icon">
                        <Sparkles size={21} />
                      </div>
                      <strong>Every question is a good question.</strong>
                      <span>Ask away — SAGE is here to help you connect the dots.</span>
                    </div>
                  ) : (
                    <div className="messages" aria-live="polite">
                      {messages.map((message, i) => (
                        <div className={`message-row ${message.role}`} key={i}>
                          <div className="message-avatar">
                            {message.role === "assistant" ? <Sparkles size={17} /> : "Y"}
                          </div>
                          <div className="message-body">
                            <span>
                              {message.role === "assistant" ? "SAGE Tutor" : profile.name}
                            </span>

                            {/* Tool Call Badge Output */}
                            {message.toolCalls && message.toolCalls.length > 0 && (
                              <div className="mb-2 flex flex-wrap gap-1.5">
                                {message.toolCalls.map((tc, tIdx) => (
                                  <span
                                    key={tIdx}
                                    className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded bg-primary/10 text-primary font-mono"
                                  >
                                    <Zap size={11} /> {tc.toolName}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="message-text whitespace-pre-wrap">
                              {message.content}
                            </div>
                          </div>
                        </div>
                      ))}

                      {loading && (
                        <div className="message-row assistant">
                          <div className="message-avatar">
                            <Sparkles size={17} />
                          </div>
                          <div className="message-body">
                            <span>SAGE Tutor</span>
                            <div className="typing">
                              <i />
                              <i />
                              <i />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={endRef} />
                    </div>
                  )}
                </section>

                {/* Quick Strategy Action Chips */}
                <div className="flex flex-wrap items-center gap-1.5 py-2">
                  {actionChips.map((chip) => (
                    <Button
                      key={chip.label}
                      variant="outline"
                      size="sm"
                      className="text-xs py-1 px-2.5 h-auto rounded-full bg-background/60 hover:bg-primary/10 hover:border-primary transition-colors"
                      onClick={() => {
                        setMode(chip.mode);
                        void send(chip.text, chip.mode);
                      }}
                    >
                      {chip.label}
                    </Button>
                  ))}
                </div>

                {/* Composer Block */}
                <div className="composer-block">
                  <div className="composer-options">
                    <div className="option-group">
                      <span className="option-label">
                        <GraduationCap size={15} /> MY LEVEL
                      </span>
                      <div className="segmented">
                        {(["Beginner", "Intermediate", "Advanced"] as const).map((value) => (
                          <Button
                            key={value}
                            variant="ghost"
                            className={level === value ? "segment active" : "segment"}
                            onClick={() => setLevel(value)}
                          >
                            {value}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="option-group">
                      <span className="option-label">
                        <CircleHelp size={15} /> TEACHING STRATEGY
                      </span>
                      <div className="mode-wrap">
                        <select
                          aria-label="Learning mode"
                          value={mode}
                          onChange={(e) => setMode(e.target.value as Mode)}
                        >
                          <option value="Explain">Explain</option>
                          <option value="Quiz me">Quiz me</option>
                          <option value="Give an example">Give an example</option>
                          <option value="Step-by-Step">Step-by-Step</option>
                          <option value="Real-Life Analogy">Real-Life Analogy</option>
                          <option value="Show Formula">Show Formula</option>
                          <option value="Give Hint">Give Hint</option>
                        </select>
                        <ChevronDown size={15} />
                      </div>
                    </div>
                  </div>

                  <form className="composer" onSubmit={submit}>
                    <textarea
                      aria-label="Ask your tutor"
                      placeholder="Ask me anything you're curious about..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void send();
                        }
                      }}
                      rows={2}
                    />
                    <div className="composer-bottom">
                      <span>
                        <Sparkles size={14} /> Learning happens one question at a time
                      </span>
                      <Button
                        type="submit"
                        className="send-button"
                        disabled={!input.trim() || loading}
                        aria-label="Send message"
                      >
                        <Send size={17} />
                      </Button>
                    </div>
                  </form>

                  {error && (
                    <p className="error-message" role="alert">
                      {error}{" "}
                      <Button variant="link" onClick={() => void send(input)}>
                        Try again
                      </Button>
                    </p>
                  )}
                </div>
              </>
            )}

            {/* VIEW 2: STUDY MATERIALS (RAG) */}
            {activeView === "materials" && (
              <StudyMaterialsView
                materials={materials}
                onRefreshMaterials={() => {
                  void refreshBackendState();
                }}
                onSelectDocumentForChat={handleSelectDocForChat}
                selectedDocumentId={selectedDocId || undefined}
              />
            )}

            {/* VIEW 3: ADAPTIVE QUIZZES */}
            {activeView === "quiz" && (
              <AdaptiveQuizView
                currentTopic={topic}
                currentLevel={level}
                onQuizCompleted={() => void refreshBackendState()}
              />
            )}

            {/* VIEW 4: PROGRESS & MASTERY */}
            {activeView === "progress" && (
              <ProgressDashboardView
                profile={profile}
                masteryList={masteryList}
                weakTopics={weakTopics}
                strongTopics={strongTopics}
                misconceptions={misconceptions}
                onSelectTopicForPractice={handleTopicPractice}
              />
            )}

            {/* VIEW 5: STUDY PLANNER */}
            {activeView === "plan" && (
              <StudyPlannerView studyPlan={studyPlan} onSelectTopicForTutor={handleTopicPractice} />
            )}

            {/* Footer */}
            <footer className="page-footer">
              <span>
                SAGE AI Tutor — Smart Adaptive Guidance & Education{" "}
                <span className="footer-star">✳</span>
              </span>
              <span>Learning is a journey, not a race.</span>
            </footer>
          </div>
        </div>
      </main>

      {/* Student Profile Modal */}
      <StudentProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        profile={profile}
        onProfileUpdated={(up) => {
          setProfile(up);
          setLevel(up.level);
        }}
      />
    </div>
  );
}
