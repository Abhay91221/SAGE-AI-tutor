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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
          <h3 className="text-base font-bold text-foreground">Sequential Topic Sequence</h3>
          <span className="text-xs text-muted-foreground">
            Adapts automatically based on quiz performance
          </span>
        </div>

        <div className="roadmap-timeline">
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
              <div key={node.id} className="roadmap-node-step group">
                {/* Node Number Marker on Timeline */}
                <div
                  className={`roadmap-node-marker ${
                    node.status === "completed"
                      ? "completed"
                      : node.status === "in_progress"
                      ? "in-progress"
                      : node.status === "recommended"
                      ? "recommended"
                      : "locked"
                  }`}
                >
                  {i + 1}
                </div>

                <div
                  className={`roadmap-node-card ${
                    node.status === "in_progress"
                      ? "in-progress"
                      : node.status === "completed"
                      ? "completed"
                      : ""
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-bold text-foreground leading-snug">{node.topic}</h4>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                        <span className="inline-flex items-center gap-1 font-medium">
                          <Clock size={12} className="text-muted-foreground" /> {node.estimatedMinutes} mins
                        </span>
                        <span>•</span>
                        <span>{node.subject}</span>
                      </div>
                    </div>

                    <div className="shrink-0">{statusBadge}</div>
                  </div>

                  <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                    {node.description}
                  </p>

                  <div className="pt-3 mt-0.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-border/60">
                    <div className="text-[11px] sm:text-xs text-muted-foreground flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="font-semibold text-foreground/80 shrink-0">Prerequisites:</span>
                      <span className="truncate">
                        {node.prerequisites.length > 0
                          ? node.prerequisites.join(", ")
                          : "None required"}
                      </span>
                    </div>

                    {isClickable && (
                      <Button
                        size="sm"
                        variant={node.status === "in_progress" ? "default" : "outline"}
                        className={`explore-topic-btn shrink-0 text-xs font-semibold px-3.5 py-1.5 h-8 gap-1.5 ${
                          node.status === "in_progress"
                            ? "shadow-sm hover:shadow"
                            : "hover:border-primary hover:text-primary hover:bg-primary/5"
                        }`}
                        onClick={() => onSelectTopicForTutor(node.topic)}
                      >
                        <span>Explore Topic</span>
                        <ArrowRight size={14} className="transition-transform duration-200 group-hover:translate-x-0.5" />
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
