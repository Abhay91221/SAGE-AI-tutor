import { CheckCircle2, Circle, Clock, Lock, Sparkles, ArrowRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudyPlan } from "@/lib/tutor.types";

interface StudyPlannerViewProps {
  studyPlan: StudyPlan;
  onSelectTopicForTutor: (topic: string) => void;
}

export function StudyPlannerView({ studyPlan, onSelectTopicForTutor }: StudyPlannerViewProps) {
  const completedCount = studyPlan.nodes.filter((n) => n.status === "completed").length;
  const progressPct = Math.round((completedCount / studyPlan.nodes.length) * 100);

  return (
    <div className="space-y-6">
      <div className="welcome">
        <div className="eyebrow">
          <span className="eyebrow-line" /> PERSONALIZED ROADMAP
        </div>
        <h1>
          Personalized Study Planner<span className="heading-period">.</span>
        </h1>
        <p>
          A step-by-step academic roadmap structured around your learning goals and topic
          dependencies.
        </p>
      </div>

      {/* Plan Header Card */}
      <section className="feature-panel p-6" style={{ gridTemplateColumns: "1fr" }}>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="feature-tag">
              <span className="feature-tag-dot" /> ACTIVE LEARNING PATH
            </div>
            <h2 className="text-xl font-bold text-foreground">{studyPlan.subject}</h2>
            <p className="text-sm text-muted-foreground">{studyPlan.goal}</p>
          </div>

          <div className="w-full md:w-64 space-y-2 bg-background p-4 rounded-xl border border-border">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-muted-foreground">Path Completion</span>
              <span className="text-primary font-bold">{progressPct}%</span>
            </div>

            <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
              <div
                className="bg-primary h-full transition-all duration-500 rounded-full"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <span className="text-[11px] text-muted-foreground block text-right">
              {completedCount} of {studyPlan.nodes.length} topics completed
            </span>
          </div>
        </div>
      </section>

      {/* Sequential Roadmap Nodes List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-foreground">Sequential Topic Sequence</h3>
          <span className="text-xs text-muted-foreground">
            Adapts automatically based on quiz performance
          </span>
        </div>

        <div className="relative pl-6 space-y-4 border-l-2 border-border ml-3">
          {studyPlan.nodes.map((node, i) => {
            let statusBadge = null;
            let isClickable = false;

            if (node.status === "completed") {
              statusBadge = (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={13} /> Completed
                </span>
              );
              isClickable = true;
            } else if (node.status === "in_progress") {
              statusBadge = (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-primary/10 text-primary flex items-center gap-1">
                  <Sparkles size={13} /> Current Focus
                </span>
              );
              isClickable = true;
            } else if (node.status === "recommended") {
              statusBadge = (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-600 flex items-center gap-1">
                  <MapPin size={13} /> Next Recommended
                </span>
              );
              isClickable = true;
            } else {
              statusBadge = (
                <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-muted text-muted-foreground flex items-center gap-1">
                  <Lock size={13} /> Locked
                </span>
              );
            }

            return (
              <div key={node.id} className="relative group">
                {/* Node Icon on Timeline */}
                <div className="absolute -left-[31px] top-4 w-6 h-6 rounded-full bg-background border-2 border-primary flex items-center justify-center text-[10px] font-bold text-primary">
                  {i + 1}
                </div>

                <div
                  className={`starter-card p-5 space-y-3 transition-all ${
                    node.status === "in_progress" ? "border-primary ring-1 ring-primary/30" : ""
                  }`}
                  style={{ textAlign: "left" }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-base font-bold text-foreground">{node.topic}</h4>
                      <span className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Clock size={13} /> {node.estimatedMinutes} mins
                        </span>
                        <span>•</span>
                        <span>{node.subject}</span>
                      </span>
                    </div>

                    {statusBadge}
                  </div>

                  <p className="text-xs text-muted-foreground">{node.description}</p>

                  <div className="pt-2 flex items-center justify-between border-t border-border/50">
                    <span className="text-[11px] text-muted-foreground">
                      {node.prerequisites.length > 0
                        ? `Prerequisites: ${node.prerequisites.join(", ")}`
                        : "No prerequisites required"}
                    </span>

                    {isClickable && (
                      <Button
                        size="sm"
                        variant={node.status === "in_progress" ? "default" : "outline"}
                        className="text-xs gap-1"
                        onClick={() => onSelectTopicForTutor(node.topic)}
                      >
                        Explore Topic <ArrowRight size={14} />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
