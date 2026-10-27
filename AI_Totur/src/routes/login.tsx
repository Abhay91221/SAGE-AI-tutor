import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Eye, EyeOff, Lock, Mail, ArrowRight, AlertCircle, KeyRound, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  ssr: false,
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { redirect?: string };
  const redirectPath = search.redirect || "/";

  const { login, isLoading, isAuthenticated } = useAuth();

  // If already logged in, redirect immediately to target destination
  useEffect(() => {
    if (isAuthenticated) {
      navigate({ to: redirectPath });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const validateForm = () => {
    let valid = true;
    setEmailError("");
    setPasswordError("");
    setErrorMessage("");

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setEmailError("Email is required.");
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setEmailError("Please enter a valid email address.");
      valid = false;
    }

    if (!password) {
      setPasswordError("Password is required.");
      valid = false;
    }

    return valid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setErrorMessage("");
    const result = await login(email.trim(), password);

    if (result.success) {
      toast.success("Welcome back!", {
        description: `Signed in as ${result.user?.name || email}`,
      });
      navigate({ to: redirectPath });
    } else {
      setErrorMessage(result.error || "Failed to sign in. Please verify your credentials.");
      toast.error("Authentication Failed", {
        description: result.error,
      });
    }
  };

  const handleFillDemo = () => {
    setEmail("demo@sage.edu");
    setPassword("SageLearner2026!");
    setEmailError("");
    setPasswordError("");
    setErrorMessage("");
    toast.info("Demo credentials loaded", {
      description: "Click 'Sign In to SAGE' to authenticate.",
    });
  };

  return (
    <AuthLayout
      title="Welcome Back"
      subtitle="Sign in with your academic credentials to resume your adaptive learning journey."
      footer={
        <div className="space-y-2">
          <p>
            Don't have an academic account?{" "}
            <Link
              to="/register"
              search={search.redirect ? { redirect: search.redirect } : undefined}
              className="text-primary font-medium hover:underline"
              id="register-link"
            >
              Register here
            </Link>
          </p>
          <p>
            <Link
              to="/forgot-password"
              className="text-muted-foreground hover:text-foreground hover:underline"
              id="forgot-password-link"
            >
              Forgot your password?
            </Link>
          </p>
        </div>
      }
    >
      {/* Demo Credentials Quick Fill Banner */}
      <div className="mb-5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-foreground font-sans">
          <KeyRound size={15} className="text-primary shrink-0" />
          <div>
            <div className="font-medium text-foreground">Demo Learner Account</div>
            <div className="text-muted-foreground text-[11px]">demo@sage.edu &bull; SageLearner2026!</div>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 text-xs border-primary/30 hover:bg-primary/10"
          onClick={handleFillDemo}
          id="demo-fill-button"
        >
          Quick Fill
        </Button>
      </div>

      {/* Global Error Alert Banner */}
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
        {/* Email Field */}
        <div className="space-y-1.5">
          <Label htmlFor="login-email" className="text-xs font-medium text-foreground">
            Academic Email
          </Label>
          <div className="relative">
            <Mail
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="student@university.edu"
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

        {/* Password Field */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="login-password" className="text-xs font-medium text-foreground">
              Password
            </Label>
            <Link
              to="/forgot-password"
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
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
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          className="w-full h-10 text-sm font-medium mt-2 shadow-sm transition-all"
          disabled={isLoading}
          id="login-submit-button"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Verifying Credentials...
            </span>
          ) : (
            <span className="flex items-center gap-2 justify-center">
              Sign In to SAGE
              <ArrowRight size={15} />
            </span>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
