import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Mail, ArrowRight, AlertCircle, CheckCircle2, ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [devResetToken, setDevResetToken] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setEmailError("");
    setErrorMessage("");

    const trimmed = email.trim();
    if (!trimmed) {
      setEmailError("Please enter your academic email address.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    const result = await forgotPassword(trimmed);
    setIsSubmitting(false);

    if (result.success) {
      setSuccessMessage(
        result.message || "A secure password reset link has been dispatched to your email address.",
      );
      if (result.devResetToken) {
        setDevResetToken(result.devResetToken);
      }
      toast.success("Reset Request Dispatched", {
        description: "Please check your inbox or use the instant test link below.",
      });
    } else {
      setErrorMessage(result.error || "Unable to process password reset request.");
    }
  };

  return (
    <AuthLayout
      title="Reset Password"
      subtitle="Enter your verified academic email to receive instructions for updating your credentials."
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-primary font-medium hover:underline"
        >
          <ArrowLeft size={14} />
          Back to Sign In
        </Link>
      }
    >
      {/* Success Notification */}
      {successMessage ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-foreground space-y-2">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-medium">
              <CheckCircle2 size={16} />
              Reset Link Sent
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {successMessage}
            </p>
          </div>

          {/* Dev Mode Instant Reset Link Helper */}
          {devResetToken && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-medium text-foreground">
                <KeyRound size={14} className="text-primary" />
                <span>Local Development Quick-Access</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                In local development mode, you can immediately access the tokenized reset page:
              </p>
              <Link
                to="/reset-password"
                search={{ token: devResetToken }}
                className="inline-flex items-center justify-center w-full py-2 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                Proceed to Reset Password Page &rarr;
              </Link>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="w-full text-xs"
            onClick={() => {
              setSuccessMessage("");
              setDevResetToken(null);
            }}
          >
            Try Another Email
          </Button>
        </div>
      ) : (
        <>
          {errorMessage && (
            <div
              role="alert"
              className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5 animate-in fade-in"
            >
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs font-medium text-foreground">
                Academic Email
              </Label>
              <div className="relative">
                <Mail
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="student@university.edu"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError("");
                  }}
                  className={`pl-9 text-sm h-10 ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={isSubmitting}
                />
              </div>
              {emailError && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle size={12} />
                  {emailError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-sm font-medium mt-2 shadow-sm transition-all"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Requesting Token...
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  Send Reset Link
                  <ArrowRight size={15} />
                </span>
              )}
            </Button>
          </form>
        </>
      )}
    </AuthLayout>
  );
}
