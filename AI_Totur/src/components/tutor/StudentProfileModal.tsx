import { useState } from "react";
import { User, GraduationCap, Target, Award, BookOpen, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Level, StudentProfile } from "@/lib/tutor.types";
import { updateStudentProfileServerFn } from "@/lib/tutor.functions";

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: StudentProfile;
  onProfileUpdated: (updated: StudentProfile) => void;
}

export function StudentProfileModal({
  isOpen,
  onClose,
  profile,
  onProfileUpdated,
}: StudentProfileModalProps) {
  const [name, setName] = useState(profile.name);
  const [classOrSemester, setClassOrSemester] = useState(profile.classOrSemester);
  const [course, setCourse] = useState(profile.course);
  const [goals, setGoals] = useState(profile.goals);
  const [level, setLevel] = useState<Level>(profile.level);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSuccess(false);

    try {
      const updated = await updateStudentProfileServerFn({
        data: { name, classOrSemester, course, goals, level },
      });
      onProfileUpdated(updated as StudentProfile);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1200);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
      <div className="relative w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl space-y-5 text-left">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <User size={22} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">Student Learner Profile</h3>
              <p className="text-xs text-muted-foreground">
                Customizes SAGE AI Tutor's explanations and level adaptation
              </p>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Class / Semester
              </label>
              <input
                type="text"
                value={classOrSemester}
                onChange={(e) => setClassOrSemester(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Course / Major
              </label>
              <input
                type="text"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Academic Goals
            </label>
            <textarea
              rows={2}
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              className="w-full rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
              Target Learning Level
            </label>
            <div className="segmented flex gap-1 bg-muted p-1 rounded-md">
              {(["Beginner", "Intermediate", "Advanced"] as const).map((lvl) => (
                <Button
                  key={lvl}
                  type="button"
                  variant="ghost"
                  className={`flex-1 text-xs py-1.5 ${level === lvl ? "segment active bg-background font-semibold" : ""}`}
                  onClick={() => setLevel(lvl)}
                >
                  {lvl}
                </Button>
              ))}
            </div>
          </div>

          <div className="pt-2 border-t border-border flex items-center justify-between">
            {success ? (
              <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                <CheckCircle2 size={16} /> Profile Saved!
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                Level auto-evaluates from quiz scores
              </span>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save Profile"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
