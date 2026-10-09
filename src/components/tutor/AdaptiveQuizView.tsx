import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Award,
  Sparkles,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Level, Quiz, QuizAttemptResult, StudentAnswer } from "@/lib/tutor.types";
import { generateQuizServerFn, submitQuizServerFn } from "@/lib/tutor.functions";

interface AdaptiveQuizViewProps {
  currentTopic: string;
  currentLevel: Level;
  onQuizCompleted: (result: QuizAttemptResult) => void;
}

export function AdaptiveQuizView({
  currentTopic,
  currentLevel,
  onQuizCompleted,
}: AdaptiveQuizViewProps) {
  const [topic, setTopic] = useState(currentTopic);
  const [level, setLevel] = useState<Level>(currentLevel);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);
  const [error, setError] = useState("");

  async function handleStartQuiz() {
    setLoading(true);
    setError("");
    setResult(null);
    setAnswers({});

    try {
      const generated = await generateQuizServerFn({
        data: { topic, level },
      });
      setQuiz(generated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate quiz.");
    } finally {
      setLoading(false);
    }
  }

  function handleAnswerChange(questionId: string, val: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: val }));
  }

  async function handleSubmitQuiz(e: React.FormEvent) {
    e.preventDefault();
    if (!quiz || submitting) return;

    setSubmitting(true);
    setError("");

    try {
      const studentAnsList: StudentAnswer[] = quiz.questions.map((q) => ({
        questionId: q.id,
        answer: answers[q.id] || "",
      }));

      const res = await submitQuizServerFn({
        data: {
          quizId: quiz.id,
          topic: quiz.topic,
          difficulty: quiz.difficulty,
          questions: quiz.questions,
          answers: studentAnsList,
        },
      });

      setResult(res);
      onQuizCompleted(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit quiz.");
    } finally {
      setSubmitting(false);
    }
  }

  function resetQuiz() {
    setQuiz(null);
    setResult(null);
    setAnswers({});
  }

  return (
    <div className="space-y-6">
      <div className="welcome">
        <div className="eyebrow">
          <span className="eyebrow-line" /> ADAPTIVE ASSESSMENT
        </div>
        <h1>
          Test Your Understanding<span className="heading-period">.</span>
        </h1>
        <p>
          Take interactive quizzes that dynamically adjust difficulty and pinpoint specific
          misconceptions.
        </p>
      </div>

      {!quiz && !result && (
        <section className="feature-panel" style={{ gridTemplateColumns: "1fr" }}>
          <div className="space-y-4">
            <div className="feature-tag">
              <span className="feature-tag-dot" /> QUIZ GENERATOR CONFIGURATION
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Topic to Test
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Difficulty Level
                </label>
                <div className="segmented flex gap-1 bg-muted p-1 rounded-md">
                  {(["Beginner", "Intermediate", "Advanced"] as const).map((lvl) => (
                    <Button
                      key={lvl}
                      type="button"
                      variant="ghost"
                      className={`flex-1 text-xs py-1 ${level === lvl ? "segment active bg-background font-semibold" : ""}`}
                      onClick={() => setLevel(lvl)}
                    >
                      {lvl}
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <Button
              onClick={handleStartQuiz}
              disabled={loading || !topic.trim()}
              className="feature-cta"
            >
              {loading ? "Generating Quiz Questions..." : "Generate Adaptive Quiz"}{" "}
              <ArrowRight size={17} />
            </Button>
          </div>
        </section>
      )}

      {/* Active Quiz Player */}
      {quiz && !result && (
        <form onSubmit={handleSubmitQuiz} className="space-y-6">
          <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border">
            <div>
              <span className="text-xs font-semibold text-primary uppercase tracking-wider">
                ACTIVE QUIZ
              </span>
              <h3 className="text-lg font-bold text-foreground">{quiz.topic}</h3>
            </div>
            <span className="px-3 py-1 bg-primary/10 text-primary text-xs font-semibold rounded-full">
              {quiz.difficulty} • {quiz.questions.length} Questions
            </span>
          </div>

          <div className="space-y-6">
            {quiz.questions.map((q, idx) => (
              <div key={q.id} className="starter-card p-5 space-y-4" style={{ textAlign: "left" }}>
                <div className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">
                    0{idx + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{q.question}</h4>
                    <span className="text-xs text-muted-foreground capitalize">
                      Type: {q.questionType.replace("_", " ")}
                    </span>
                  </div>
                </div>

                {/* Question Options */}
                {q.questionType === "mcq" && q.options && (
                  <div className="space-y-2 pl-10">
                    {q.options.map((opt) => (
                      <label
                        key={opt}
                        className={`flex items-center gap-3 p-3 rounded-md border text-sm cursor-pointer transition-colors ${
                          answers[q.id] === opt
                            ? "border-primary bg-primary/5 font-medium"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name={`q_${q.id}`}
                          value={opt}
                          checked={answers[q.id] === opt}
                          onChange={() => handleAnswerChange(q.id, opt)}
                          className="accent-primary"
                        />
                        <span>{opt}</span>
                      </label>
                    ))}
                  </div>
                )}

                {q.questionType === "true_false" && (
                  <div className="flex gap-4 pl-10">
                    {["True", "False"].map((opt) => (
                      <Button
                        key={opt}
                        type="button"
                        variant={answers[q.id] === opt ? "default" : "outline"}
                        className="flex-1 text-sm"
                        onClick={() => handleAnswerChange(q.id, opt)}
                      >
                        {opt}
                      </Button>
                    ))}
                  </div>
                )}

                {q.questionType === "short_answer" && (
                  <div className="pl-10">
                    <textarea
                      placeholder="Type your explanation or answer..."
                      rows={3}
                      value={answers[q.id] || ""}
                      onChange={(e) => handleAnswerChange(q.id, e.target.value)}
                      className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={resetQuiz}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Evaluating Answers..." : "Submit Quiz for Evaluation"}
            </Button>
          </div>
        </form>
      )}

      {/* Quiz Results & Misconception Evaluation Card */}
      {result && (
        <div className="space-y-6">
          <div className="feature-panel p-6" style={{ gridTemplateColumns: "1fr" }}>
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2">
                <span className="feature-tag">
                  <span className="feature-tag-dot" /> EVALUATION COMPLETE
                </span>
                <h2 className="text-2xl font-bold text-foreground">
                  Quiz Scorecard: {result.topic}
                </h2>
                <p className="text-sm text-muted-foreground">{result.recommendedRevision}</p>
              </div>

              <div className="flex items-center gap-4 bg-background p-4 rounded-xl border border-border shrink-0">
                <Award size={40} className="text-primary" />
                <div>
                  <span className="block text-3xl font-extrabold text-foreground">
                    {result.scorePercentage}%
                  </span>
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Overall Mastery Score
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Evaluated Questions List */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">Detailed Question Breakdown</h3>

            {result.evaluatedAnswers.map((item, i) => (
              <div
                key={i}
                className={`starter-card p-5 border-l-4 ${
                  item.isCorrect ? "border-l-emerald-500" : "border-l-destructive"
                }`}
                style={{ textAlign: "left" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {item.isCorrect ? (
                        <CheckCircle2 className="text-emerald-500 shrink-0" size={18} />
                      ) : (
                        <XCircle className="text-destructive shrink-0" size={18} />
                      )}
                      <span className="text-sm font-semibold text-foreground">
                        Question {i + 1}: {item.questionText}
                      </span>
                    </div>

                    <div className="text-xs space-y-1 pl-6">
                      <p>
                        <strong className="text-muted-foreground">Your Answer:</strong>{" "}
                        <span
                          className={
                            item.isCorrect
                              ? "text-emerald-600 font-medium"
                              : "text-destructive font-medium"
                          }
                        >
                          {item.studentAnswer}
                        </span>
                      </p>
                      {!item.isCorrect && (
                        <p>
                          <strong className="text-muted-foreground">Correct Answer:</strong>{" "}
                          <span className="text-foreground font-medium">{item.correctAnswer}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <span
                    className={`px-2.5 py-1 text-xs font-bold rounded-full ${
                      item.isCorrect
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {item.scorePercentage}%
                  </span>
                </div>

                {/* Misconception Alert Card */}
                {item.misconceptionDetected && (
                  <div className="mt-4 p-4 rounded-md bg-destructive/5 border border-destructive/20 space-y-2">
                    <div className="flex items-center gap-2 text-destructive font-semibold text-xs uppercase tracking-wider">
                      <AlertTriangle size={15} /> Misconception Detected
                    </div>
                    <p className="text-xs text-foreground font-medium">
                      {item.misconceptionDetected}
                    </p>
                    {item.remedialHint && (
                      <p className="text-xs text-muted-foreground">
                        💡 <strong>Remedial Hint:</strong> {item.remedialHint}
                      </p>
                    )}
                  </div>
                )}

                <p className="mt-3 text-xs text-muted-foreground pl-6 border-t border-border/50 pt-2">
                  ℹ️ <strong>Explanation:</strong> {item.explanation}
                </p>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <Button onClick={resetQuiz} variant="outline" className="gap-2">
              <RotateCcw size={16} /> Take Another Quiz
            </Button>
            <Button onClick={handleStartQuiz} className="gap-2">
              <Sparkles size={16} /> Retry This Topic
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
