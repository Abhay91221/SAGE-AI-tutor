import React from "react";
import { Check, X } from "lucide-react";

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const hasMinLength = password.length >= 8;
  const hasLetter = /[A-Za-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const criteriaMet = [hasMinLength, hasLetter, hasNumber, hasSpecial].filter(Boolean).length;

  let strengthLabel = "Weak";
  let strengthColor = "bg-destructive";
  let barWidth = "25%";

  if (criteriaMet === 1) {
    strengthLabel = "Very Weak";
    strengthColor = "bg-destructive";
    barWidth = "25%";
  } else if (criteriaMet === 2) {
    strengthLabel = "Fair";
    strengthColor = "bg-amber-500";
    barWidth = "50%";
  } else if (criteriaMet === 3) {
    strengthLabel = "Good";
    strengthColor = "bg-blue-500";
    barWidth = "75%";
  } else if (criteriaMet === 4) {
    strengthLabel = "Strong";
    strengthColor = "bg-emerald-500";
    barWidth = "100%";
  }

  if (!password) {
    return null;
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-mono">Password strength</span>
        <span className="font-medium text-foreground">{strengthLabel}</span>
      </div>

      {/* Progress Track */}
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${strengthColor} transition-all duration-300 rounded-full`}
          style={{ width: barWidth }}
        />
      </div>

      {/* Checklist */}
      <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px]">
        <div className={`flex items-center gap-1 ${hasMinLength ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
          {hasMinLength ? <Check size={12} /> : <X size={12} />}
          <span>8+ characters</span>
        </div>
        <div className={`flex items-center gap-1 ${hasLetter ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
          {hasLetter ? <Check size={12} /> : <X size={12} />}
          <span>Contains letters</span>
        </div>
        <div className={`flex items-center gap-1 ${hasNumber ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
          {hasNumber ? <Check size={12} /> : <X size={12} />}
          <span>Contains numbers</span>
        </div>
        <div className={`flex items-center gap-1 ${hasSpecial ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
          {hasSpecial ? <Check size={12} /> : <X size={12} />}
          <span>Special character</span>
        </div>
      </div>
    </div>
  );
}
