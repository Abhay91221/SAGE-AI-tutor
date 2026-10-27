import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };

  const { resetPassword } = useAuth();

  const [token, setToken] = useState(search.token || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateForm = () => {
    let valid = true;
    setTokenError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setErrorMessage("");

    if (!token.trim()) {
      setTokenError("Security reset token is required.");
      valid = false;
    }

    if (!password) {
      setPasswordError("New password is required.");
      valid = false;
    } else if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters long.");
      valid = false;
    } else if (!/[A-Za-z]/.test(password)) {
      setPasswordError("Password must include at least one letter.");
      valid = false;
    } else if (!/[0-9]/.test(password)) {
      setPasswordError("Password must include at least one number.");
      valid = false;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    const result = await resetPassword(token.trim(), password);
    setIsSubmitting(false);

    if (result.success) {
      setIsSuccess(true);
      toast.success("Password Updated!", {
        description: "Your credentials have been securely updated.",
      });
    } else {
      setErrorMessage(result.error || "Unable to reset password. Please check your reset token.");
    }
  };

  return (
    <AuthLayout
      title="Create New Password"
      subtitle="Set a strong, unique password for your SAGE academic account."
      footer={
        <Link to="/login" className="text-primary font-medium hover:underline">
          Return to Sign In
        </Link>
      }
    >
      {isSuccess ? (
        <div className="space-y-5 text-center">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 space-y-2">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 mx-auto flex items-center justify-center">
              <CheckCircle2 size={22} />
            </div>
            <h3 className="font-serif text-lg font-bold text-foreground">Password Reset Complete</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Your account password has been safely updated. You may now sign in using your new credentials.
            </p>
          </div>

          <Button
            type="button"
            className="w-full h-10 text-sm font-medium"
            onClick={() => navigate({ to: "/login" })}
          >
            Sign In with New Password &rarr;
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
            {/* Reset Token */}
            <div className="space-y-1.5">
              <Label htmlFor="reset-token" className="text-xs font-medium text-foreground">
                Security Token
              </Label>
              <div className="relative">
                <KeyRound
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  id="reset-token"
                  type="text"
                  placeholder="Paste reset token here..."
                  value={token}
                  onChange={(e) => {
                    setToken(e.target.value);
                    if (tokenError) setTokenError("");
                  }}
                  className={`pl-9 text-xs font-mono h-10 ${tokenError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={isSubmitting}
                />
              </div>
              {tokenError && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle size={12} />
                  {tokenError}
                </p>
              )}
            </div>

            {/* New Password */}
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-medium text-foreground">
                New Password
              </Label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="New password (8+ chars)"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (passwordError) setPasswordError("");
                  }}
                  className={`pl-9 pr-10 text-sm h-10 ${passwordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordError && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle size={12} />
                  {passwordError}
                </p>
              )}

              <PasswordStrengthMeter password={password} />
            </div>

            {/* Confirm New Password */}
            <div className="space-y-1.5 pt-1">
              <Label htmlFor="confirm-new-password" className="text-xs font-medium text-foreground">
                Confirm New Password
              </Label>
              <div className="relative">
                <Lock
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <Input
                  id="confirm-new-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (confirmPasswordError) setConfirmPasswordError("");
                  }}
                  className={`pl-9 pr-10 text-sm h-10 ${confirmPasswordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPasswordError && (
                <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
                  <AlertCircle size={12} />
                  {confirmPasswordError}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-10 text-sm font-medium mt-4 shadow-sm transition-all"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  Updating Password...
                </span>
              ) : (
                <span className="flex items-center gap-2 justify-center">
                  Save New Password
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
