import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Atom, BookOpen, Check, ChevronDown, CircleHelp, Compass, GraduationCap, Lightbulb, Menu, MessageCircle, Plus, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AtomScene } from "@/components/tutor/AtomScene";
import { askTutor } from "@/lib/tutor.functions";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Mimo — Your curious mind has a companion" },
    { name: "description", content: "Explore academic concepts with an interactive AI tutor that adapts to your level." },
    { property: "og:title", content: "Mimo — Interactive AI Tutor" },
    { property: "og:description", content: "Learn at your pace with level-aware explanations, examples and questions." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: TutorPage,
});

type Message = { role: "user" | "assistant"; content: string };
type Level = "Beginner" | "Intermediate" | "Advanced";
type Mode = "Explain" | "Quiz me" | "Give an example";
const topics = ["The structure of an atom", "How photosynthesis works", "Why gravity matters", "The basics of calculus"];
const starters = [
  { icon: Atom, title: "Atoms & matter", question: "What is an atom, and what are its parts?" },
  { icon: Lightbulb, title: "Everyday science", question: "Why is the sky blue?" },
  { icon: BookOpen, title: "Math made simple", question: "Can you explain derivatives with a real-life example?" },
];

function TutorPage() {
  const [topic, setTopic] = useState(topics[0]);
  const [level, setLevel] = useState<Level>("Beginner");
  const [mode, setMode] = useState<Mode>("Explain");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, loading]);

  async function send(question?: string) {
    const text = (question ?? input).trim();
    if (!text || loading) return;
    const next: Message[] = [...messages, { role: "user", content: text }];
    setMessages(next); setInput(""); setError(""); setLoading(true);
    try {
      const answer = await askTutor({ data: { topic, level, mode, messages: next.slice(-20) } });
      setMessages([...next, { role: "assistant", content: answer }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
      setInput(text);
    } finally { setLoading(false); }
  }
  function reset() { setMessages([]); setInput(""); setError(""); setSidebarOpen(false); }
  function selectTopic(value: string) { setTopic(value); reset(); }
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void send(); }

  return <div className="app-shell">
    <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
      <div className="brand"><span className="brand-mark"><Sparkles size={20} strokeWidth={2.4} /></span><span>mimo<span className="brand-dot">.</span></span><Button variant="ghost" size="icon" className="mobile-close" aria-label="Close menu" onClick={() => setSidebarOpen(false)}><X size={18}/></Button></div>
      <div className="sidebar-body">
        <Button variant="outline" className="new-session" onClick={reset}><Plus size={16}/> New conversation <span className="new-plus">↗</span></Button>
        <div className="sidebar-label">YOUR SPACE</div>
        <div className="side-link active"><Compass size={18}/> Explore <span className="active-indicator"/></div>
        <div className="sidebar-label topics-label">POPULAR TOPICS</div>
        <div className="topic-list">{topics.map((item, i) => <Button key={item} variant="ghost" className={`topic-item ${topic === item ? "selected" : ""}`} onClick={() => selectTopic(item)}><span className="topic-number">0{i + 1}</span><span>{item}</span></Button>)}</div>
      </div>
      <div className="sidebar-footer"><div className="footer-icon"><GraduationCap size={21}/></div><div><strong>Keep your curiosity.</strong><span>One question at a time.</span></div></div>
    </aside>
    {sidebarOpen && <div className="mobile-scrim" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="topbar-left"><Button variant="ghost" size="icon" className="mobile-menu" aria-label="Open menu" onClick={() => setSidebarOpen(true)}><Menu size={20}/></Button><span className="breadcrumb">Your workspace</span><span className="crumb-sep">/</span><span className="breadcrumb-current">Explore</span></div><div className="topbar-right"><span className="status-dot"/> Ready to learn <span className="header-divider"/> <span className="avatar">M</span></div></header>
      <div className="content-scroll"><div className="content-wrap">
        <div className="welcome"><div className="eyebrow"><span className="eyebrow-line"/> YOUR LEARNING SPACE</div><h1>Curiosity looks good on you<span className="heading-period">.</span></h1><p>Pick a thought, ask a question, and let's figure it out together.</p></div>
        <section className="feature-panel" aria-label="Current learning topic">
          <div className="feature-copy"><div className="feature-tag"><span className="feature-tag-dot"/> CURRENTLY EXPLORING</div><h2>{topic}</h2><p>Big ideas start small. Take a closer look, ask anything, and make it make sense.</p><Button className="feature-cta" onClick={() => void send(`Teach me about ${topic.toLowerCase()}.`)}>Explore this topic <ArrowRight size={17}/></Button></div>
          <div className="feature-visual"><div className="visual-grid"/><AtomScene/><span className="visual-caption">THE WORLD, UP CLOSE <span>✦</span></span></div>
        </section>
        <div className="section-heading"><div><span className="section-kicker">START SOMEWHERE</span><h3>What sparks your interest?</h3></div><span className="section-aside">A little curiosity goes a long way <ArrowRight size={15}/></span></div>
        <div className="starter-grid">{starters.map(({ icon: Icon, title, question }, i) => <Button key={title} variant="outline" className="starter-card" onClick={() => void send(question)}><span className={`starter-icon starter-${i}`}><Icon size={21} strokeWidth={1.8}/></span><span className="starter-text"><strong>{title}</strong><small>{question}</small></span><ArrowRight className="starter-arrow" size={17}/></Button>)}</div>
        <section className="conversation" aria-label="Tutor conversation"><div className="conversation-heading"><div className="conversation-heading-icon"><MessageCircle size={19}/></div><div><h3>Your conversation</h3><p>A space to think out loud.</p></div><span className="conversation-count">{messages.length ? `${messages.length} messages` : "NEW SESSION"}</span></div>
          {messages.length === 0 ? <div className="empty-chat"><div className="empty-icon"><Sparkles size={21}/></div><strong>Every question is a good question.</strong><span>Ask away — I'm here to help you connect the dots.</span></div> : <div className="messages" aria-live="polite">{messages.map((message, i) => <div className={`message-row ${message.role}`} key={i}><div className="message-avatar">{message.role === "assistant" ? <Sparkles size={17}/> : "Y"}</div><div className="message-body"><span>{message.role === "assistant" ? "Mimo" : "You"}</span><div className="message-text">{message.content}</div></div></div>)}{loading && <div className="message-row assistant"><div className="message-avatar"><Sparkles size={17}/></div><div className="message-body"><span>Mimo</span><div className="typing"><i/><i/><i/></div></div></div>}<div ref={endRef}/></div>}
        </section>
        <div className="composer-block"><div className="composer-options"><div className="option-group"><span className="option-label"><GraduationCap size={15}/> MY LEVEL</span><div className="segmented">{(["Beginner", "Intermediate", "Advanced"] as const).map(value => <Button key={value} variant="ghost" className={level === value ? "segment active" : "segment"} onClick={() => setLevel(value)}>{value}</Button>)}</div></div><div className="option-group"><span className="option-label"><CircleHelp size={15}/> LEARNING MODE</span><div className="mode-wrap"><select aria-label="Learning mode" value={mode} onChange={e => setMode(e.target.value as Mode)}><option>Explain</option><option>Quiz me</option><option>Give an example</option></select><ChevronDown size={15}/></div></div></div>
          <form className="composer" onSubmit={submit}><textarea aria-label="Ask your tutor" placeholder="Ask me anything you're curious about..." value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} rows={2}/><div className="composer-bottom"><span><Sparkles size={14}/> Learning happens one question at a time</span><Button type="submit" className="send-button" disabled={!input.trim() || loading} aria-label="Send message"><Send size={17}/></Button></div></form>
          {error && <p className="error-message" role="alert">{error} <Button variant="link" onClick={() => void send(input)}>Try again</Button></p>}
        </div>
        <footer className="page-footer"><span>Made for curious minds <span className="footer-star">✳</span></span><span>Learning is a journey, not a race.</span></footer>
      </div></div>
    </main>
  </div>;
}
