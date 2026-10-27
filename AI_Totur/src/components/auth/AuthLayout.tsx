import React from "react";
import { Link } from "@tanstack/react-router";
import { Sparkles, ShieldCheck, GraduationCap } from "lucide-react";

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex flex-col justify-between bg-background text-foreground selection:bg-primary/20 selection:text-primary relative overflow-x-hidden">
      {/* Subtle Ambient Glows */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-primary/8 rounded-full blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[300px] bg-accent/10 rounded-full blur-3xl"
        aria-hidden="true"
      />

      {/* Top Header */}
      <header className="w-full max-w-6xl mx-auto px-6 py-6 flex items-center justify-between z-10">
        <Link to="/" className="flex items-center gap-2.5 group transition-opacity hover:opacity-90">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center font-serif font-bold shadow-sm transition-transform group-hover:scale-105">
            S
          </div>
          <div>
            <div className="font-serif text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
              SAGE <span className="text-primary font-mono text-xs px-1.5 py-0.5 rounded bg-primary/10">TUTOR</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-none font-sans">
              Smart Adaptive Guidance & Education
            </p>
          </div>
        </Link>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck size={15} className="text-primary" />
          <span className="hidden sm:inline font-mono">256-bit Secure Session</span>
        </div>
      </header>

      {/* Main Card Container */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 z-10">
        <div className="w-full max-w-[440px]">
          <div className="relative rounded-2xl border border-border/80 bg-card/90 backdrop-blur-md p-6 sm:p-8 shadow-xl shadow-foreground/5 transition-all">
            {/* Academic Eyebrow */}
            <div className="mb-6 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-3">
                <Sparkles size={13} />
                <span>Academic Portal</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {title}
                <span className="text-primary">.</span>
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {subtitle}
              </p>
            </div>

            {/* Form Slot */}
            {children}

            {/* Footer slot (links) */}
            {footer && <div className="mt-6 pt-5 border-t border-border/60 text-center text-xs text-muted-foreground">{footer}</div>}
          </div>
        </div>
      </main>

      {/* Bottom Footer */}
      <footer className="w-full max-w-6xl mx-auto px-6 py-6 text-center text-xs text-muted-foreground z-10 flex flex-col sm:flex-row items-center justify-between gap-2 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          <GraduationCap size={15} className="text-primary" />
          <span>SAGE AI Adaptive Learning System &bull; Production Security Stack</span>
        </div>
        <div className="flex gap-4">
          <Link to="/" className="hover:text-foreground transition-colors">
            Tutor Home
          </Link>
          <span className="text-border">&bull;</span>
          <span className="hover:text-foreground transition-colors cursor-pointer">
            Academic Integrity
          </span>
        </div>
      </footer>
    </div>
  );
}
