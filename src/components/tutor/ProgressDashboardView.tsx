import { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import {
  TrendingUp,
  AlertOctagon,
  CheckCircle2,
  Award,
  Target,
  ArrowRight,
  ShieldAlert,
  Sparkles,
  Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Misconception, StudentProfile, TopicMastery, Recommendation } from "@/lib/tutor.types";
import { getRecommendationsServerFn } from "@/lib/tutor.functions";

interface ProgressDashboardViewProps {
  profile: StudentProfile;
  masteryList: TopicMastery[];
  weakTopics: TopicMastery[];
  strongTopics: TopicMastery[];
  misconceptions: Misconception[];
  onSelectTopicForPractice: (topic: string) => void;
}

export function ProgressDashboardView({
  profile,
  masteryList,
  weakTopics,
  strongTopics,
  misconceptions,
  onSelectTopicForPractice,
}: ProgressDashboardViewProps) {
  const [activeTab, setActiveTab] = useState<
    "mastery" | "weak" | "misconceptions" | "recommendations"
  >("mastery");
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);

  useEffect(() => {
    void fetchRecommendations();
  }, []);

  async function fetchRecommendations() {
    setLoadingRecs(true);
    try {
      const recs = await getRecommendationsServerFn();
      setRecommendations(recs);
    } catch (err) {
      console.error("Failed to fetch recommendations:", err);
    } finally {
      setLoadingRecs(false);
    }
  }

  const totalQuizzes = profile.quizHistory.length;
  const avgScore =
    totalQuizzes > 0
      ? Math.round(profile.quizHistory.reduce((s, q) => s + q.scorePercentage, 0) / totalQuizzes)
      : 78;

  const chartData = masteryList.map((m) => ({
    name: m.topic.length > 12 ? m.topic.substring(0, 12) + "..." : m.topic,
    fullName: m.topic,
    score: m.masteryPercentage,
  }));

  return (
    <div className="space-y-6">
      <div className="welcome">
        <div className="eyebrow">
          <span className="eyebrow-line" /> LEARNING ANALYTICS
        </div>
        <h1>
          Progress & Topic Mastery<span className="heading-period">.</span>
        </h1>
        <p>
          Monitor your academic growth, track weak topics, and review conceptual misconceptions.
        </p>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="starter-card p-4 space-y-1" style={{ textAlign: "left" }}>
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
            <Award size={14} className="text-primary" /> Overall Score
          </span>
          <strong className="text-2xl font-bold text-foreground">{avgScore}%</strong>
          <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium block">
            Top 15% learner band
          </span>
        </div>

        <div className="starter-card p-4 space-y-1" style={{ textAlign: "left" }}>
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
            <Target size={14} className="text-primary" /> Quizzes Taken
          </span>
          <strong className="text-2xl font-bold text-foreground">{totalQuizzes}</strong>
          <span className="text-xs text-muted-foreground block">Evaluated semantically</span>
        </div>

        <div className="starter-card p-4 space-y-1" style={{ textAlign: "left" }}>
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
            <CheckCircle2 size={14} className="text-emerald-500" /> Mastered Topics
          </span>
          <strong className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {strongTopics.length}
          </strong>
          <span className="text-xs text-muted-foreground block">≥ 80% mastery threshold</span>
        </div>

        <div className="starter-card p-4 space-y-1" style={{ textAlign: "left" }}>
          <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider flex items-center gap-1">
            <AlertOctagon size={14} className="text-destructive" /> Weak Topics
          </span>
          <strong className="text-2xl font-bold text-destructive">{weakTopics.length}</strong>
          <span className="text-xs text-destructive/80 font-medium block">
            Requires targeted practice
          </span>
        </div>
      </div>

      {/* Weak Topic Warning Banner */}
      {weakTopics[0] && (
        <section className="p-4 rounded-xl border border-destructive/30 bg-destructive/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-destructive/10 text-destructive shrink-0">
              <ShieldAlert size={22} />
            </div>
            <div>
              <strong className="block text-sm font-semibold text-foreground">
                Weak Area Identified: {weakTopics[0].topic} ({weakTopics[0].masteryPercentage}%
                score)
              </strong>
              <span className="text-xs text-muted-foreground">
                Automated detection flagged this topic due to repeated quiz errors. Practice with
                SAGE AI Tutor to improve.
              </span>
            </div>
          </div>

          <Button
            size="sm"
            className="shrink-0 gap-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => weakTopics[0] && onSelectTopicForPractice(weakTopics[0].topic)}
          >
            Practice {weakTopics[0].topic} <ArrowRight size={15} />
          </Button>
        </section>
      )}

      {/* Tabs */}
      <div className="segmented flex gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === "mastery" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("mastery")}
        >
          <TrendingUp size={15} className="mr-1.5" /> Topic Mastery Chart
        </Button>
        <Button
          variant={activeTab === "weak" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("weak")}
        >
          <AlertOctagon size={15} className="mr-1.5" /> Weak Topics ({weakTopics.length})
        </Button>
        <Button
          variant={activeTab === "misconceptions" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("misconceptions")}
        >
          <ShieldAlert size={15} className="mr-1.5" /> Detected Misconceptions (
          {misconceptions.length})
        </Button>
        <Button
          variant={activeTab === "recommendations" ? "default" : "ghost"}
          size="sm"
          onClick={() => setActiveTab("recommendations")}
        >
          <Sparkles size={15} className="mr-1.5" /> AI Recommendations ({recommendations.length})
        </Button>
      </div>

      {/* Tab 1: Mastery Chart */}
      {activeTab === "mastery" && (
        <div className="feature-panel p-6" style={{ gridTemplateColumns: "1fr" }}>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">Topic Mastery Breakdown</h3>
              <span className="text-xs text-muted-foreground">Target Threshold: 80%</span>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                  />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length && payload[0]?.payload) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border p-2.5 rounded-md shadow-md text-xs">
                            <p className="font-bold text-popover-foreground">{data.fullName}</p>
                            <p className="text-primary font-semibold">Mastery: {data.score}%</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="score" fill="oklch(0.208 0.042 265.755)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Weak Topics List */}
      {activeTab === "weak" && (
        <div className="space-y-3">
          {weakTopics.length === 0 ? (
            <div className="empty-chat" style={{ padding: "2rem" }}>
              <CheckCircle2 size={24} className="text-emerald-500" />
              <strong>No weak topics detected!</strong>
              <span>You are performing well across all evaluated subjects.</span>
            </div>
          ) : (
            weakTopics.map((item) => (
              <div
                key={item.topic}
                className="starter-card p-4 flex items-center justify-between"
                style={{ textAlign: "left" }}
              >
                <div>
                  <strong className="block text-sm font-semibold text-foreground">
                    {item.topic}
                  </strong>
                  <span className="text-xs text-muted-foreground">
                    Subject: {item.subject} • Attempts: {item.attemptsCount} • Last:{" "}
                    {item.lastPracticed}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="block text-sm font-bold text-destructive">
                      {item.masteryPercentage}%
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                      Score
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onSelectTopicForPractice(item.topic)}
                  >
                    Practice Topic
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Misconceptions Log */}
      {activeTab === "misconceptions" && (
        <div className="space-y-4">
          {misconceptions.length === 0 ? (
            <div className="empty-chat" style={{ padding: "2rem" }}>
              <ShieldAlert size={24} className="text-muted-foreground" />
              <strong>No un-resolved misconceptions logged.</strong>
              <span>Take adaptive quizzes to test your understanding!</span>
            </div>
          ) : (
            misconceptions.map((m) => (
              <div key={m.id} className="starter-card p-5 space-y-3" style={{ textAlign: "left" }}>
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-xs font-semibold text-destructive uppercase tracking-wider">
                      {m.topic}
                    </span>
                    <h4 className="text-sm font-bold text-foreground">{m.whyWrong}</h4>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-destructive/10 text-destructive">
                    Misconception Logged
                  </span>
                </div>

                <div className="bg-muted/40 p-3 rounded-md text-xs space-y-1">
                  <p>
                    <strong>Your Input:</strong> "{m.studentAnswer}"
                  </p>
                  <p>
                    <strong>Correct Logic:</strong> {m.explanation}
                  </p>
                  <p>
                    <strong>Counter-Example:</strong> {m.counterExample}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 4: AI Recommendations */}
      {activeTab === "recommendations" && (
        <div className="space-y-4">
          {loadingRecs ? (
            <div className="empty-chat" style={{ padding: "2rem" }}>
              <Sparkles size={24} className="animate-spin text-primary" />
              <strong>Generating personalized AI recommendations...</strong>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="empty-chat" style={{ padding: "2rem" }}>
              <Lightbulb size={24} className="text-muted-foreground" />
              <strong>No active recommendations right now.</strong>
              <span>Keep exploring topics and taking quizzes!</span>
            </div>
          ) : (
            recommendations.map((rec) => (
              <div
                key={rec.id}
                className="starter-card p-5 space-y-3"
                style={{ textAlign: "left" }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                      <Sparkles size={20} />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-foreground">{rec.title}</h4>
                      <span className="text-xs text-muted-foreground">Reason: {rec.reason}</span>
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                      rec.priority === "high"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-primary/10 text-primary"
                    }`}
                  >
                    {rec.priority} Priority
                  </span>
                </div>

                <p className="text-xs text-muted-foreground pl-11">{rec.description}</p>

                <div className="pl-11 pt-1 flex items-center justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs gap-1"
                    onClick={() => onSelectTopicForPractice(rec.topic)}
                  >
                    Start {rec.topic} <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
