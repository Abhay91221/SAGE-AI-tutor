import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail, User, ArrowRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { PasswordStrengthMeter } from "@/components/auth/PasswordStrengthMeter";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  ssr: false,
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };
  const redirectPath = search.redirect || "/";

  const { register, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: redirectPath });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [nameError, setNameError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const validateForm = () => {
    let valid = true;
    setNameError("");
    setEmailError("");
    setPasswordError("");
    setConfirmPasswordError("");
    setErrorMessage("");

    if (!name.trim() || name.trim().length < 2) {
      setNameError("Full name must be at least 2 characters.");
      valid = false;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Please enter a valid academic email address.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
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

    setErrorMessage("");
    const result = await register(name.trim(), email.trim(), password);

    if (result.success) {
      toast.success("Account Created!", {
        description: `Welcome to SAGE, ${result.user?.name || name}!`,
      });
      navigate({ to: redirectPath });
    } else {
      setErrorMessage(result.error || "Failed to create account. Please try again.");
      toast.error("Registration Failed", {
        description: result.error,
      });
    }
  };

  return (
    <AuthLayout
      title="Create Student Account"
      subtitle="Join SAGE AI Tutor for personalized academic mentoring and adaptive quizzes."
      footer={
        <p>
          Already have an account?{" "}
          <Link
            to="/login"
            search={search.redirect ? { redirect: search.redirect } : undefined}
            className="text-primary font-medium hover:underline"
          >
            Sign in here
          </Link>
        </p>
      }
    >
      {/* Global Error Banner */}
      {errorMessage && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive flex items-start gap-2.5 animate-in fade-in"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div className="flex-1 font-medium">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Full Name */}
        <div className="space-y-1.5">
          <Label htmlFor="register-name" className="text-xs font-medium text-foreground">
            Full Name
          </Label>
          <div className="relative">
            <User
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              id="register-name"
              type="text"
              name="name"
              autoComplete="name"
              placeholder="e.g. Alex Morgan"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (nameError) setNameError("");
              }}
              className={`pl-9 text-sm h-10 ${nameError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              disabled={isLoading}
            />
          </div>
          {nameError && (
            <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
              <AlertCircle size={12} />
              {nameError}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <Label htmlFor="register-email" className="text-xs font-medium text-foreground">
            Academic Email
          </Label>
          <div className="relative">
            <Mail
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              id="register-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="alex.m@university.edu"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (emailError) setEmailError("");
              }}
              className={`pl-9 text-sm h-10 ${emailError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              disabled={isLoading}
            />
          </div>
          {emailError && (
            <p className="text-[11px] text-destructive flex items-center gap-1 mt-1">
              <AlertCircle size={12} />
              {emailError}
            </p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <Label htmlFor="register-password" className="text-xs font-medium text-foreground">
            Create Password
          </Label>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              id="register-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="new-password"
              placeholder="At least 8 characters..."
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (passwordError) setPasswordError("");
              }}
              className={`pl-9 pr-10 text-sm h-10 ${passwordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              disabled={isLoading}
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

          {/* Interactive Password Strength Meter */}
          <PasswordStrengthMeter password={password} />
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5 pt-1">
          <Label htmlFor="register-confirm" className="text-xs font-medium text-foreground">
            Confirm Password
          </Label>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              id="register-confirm"
              type={showConfirmPassword ? "text" : "password"}
              name="confirmPassword"
              autoComplete="new-password"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (confirmPasswordError) setConfirmPasswordError("");
              }}
              className={`pl-9 pr-10 text-sm h-10 ${confirmPasswordError ? "border-destructive focus-visible:ring-destructive" : ""}`}
              disabled={isLoading}
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

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-10 text-sm font-medium mt-4 shadow-sm transition-all"
          disabled={isLoading}
          id="register-submit-button"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Creating SAGE Account...
            </span>
          ) : (
            <span className="flex items-center gap-2 justify-center">
              Complete Registration
              <ArrowRight size={15} />
            </span>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
