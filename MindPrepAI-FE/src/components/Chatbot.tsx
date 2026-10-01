import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  errorMessage,
  getChatbotInfo,
  sendChatMessage,
  type ChatReply,
  type ChatSuggestion,
} from "../services/analyticsApi";

type Message =
  | { role: "user"; content: string; timestamp: number }
  | { role: "assistant"; reply: ChatReply; timestamp: number }
  | { role: "error"; content: string; timestamp: number };

const DEFAULT_SUGGESTIONS: ChatSuggestion[] = [
  { label: "My weak areas", prompt: "What are my weak areas?" },
  { label: "How am I doing?", prompt: "How am I doing overall?" },
  { label: "What should I study next?", prompt: "What should I study next?" },
  { label: "Deadlock", prompt: "What is deadlock and how to prevent it?" },
];

const accuracyColor = (pct: number) => (pct < 60 ? "text-red-600 dark:text-red-300" : pct < 75 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300");

export function Chatbot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [starters, setStarters] = useState<ChatSuggestion[]>(DEFAULT_SUGGESTIONS);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Starter prompts are a nicety; the built-in defaults are a complete substitute.
  useEffect(() => {
    getChatbotInfo()
      .then((info) => {
        if (info.suggestions?.length) setStarters(info.suggestions.slice(0, 6));
      })
      .catch((err) => console.warn("Chatbot info unavailable, using default prompts:", err));
  }, []);

  // Scroll only the message pane; scrollIntoView would also drag the whole page.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: message, timestamp: Date.now() }]);
    setInput("");
    setLoading(true);
    try {
      const reply = await sendChatMessage(message);
      setMessages((prev) => [...prev, { role: "assistant", reply, timestamp: Date.now() }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "error", content: errorMessage(err, "The assistant couldn't answer that. Please try again."), timestamp: Date.now() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const time = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <section className="mt-2 rounded-2xl border-2 border-white bg-surface p-6 text-fg shadow-lg">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm text-muted">Study Assistant</p>
          <h2 className="text-2xl font-bold">Ask Your Study Questions</h2>
          <p className="mt-1 text-sm text-muted">
            Answers come from MindPrep's own placement knowledge base and your results — no external AI service.
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="rounded-lg border border-line px-3 py-1 text-xs text-muted transition hover:bg-surface-2"
          >
            Clear chat
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex h-96 flex-col gap-3 overflow-y-auto rounded-xl bg-surface p-4">
        {messages.length === 0 && !loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center text-muted">
            <div>
              <p className="mb-1 text-lg font-semibold">👋 Hi, I'm your prep assistant</p>
              <p className="text-sm">Ask about aptitude formulas, CS concepts, interview answers — or how you're doing.</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {starters.map((s) => (
                <button
                  key={s.label}
                  onClick={() => send(s.prompt)}
                  className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-700 dark:text-indigo-200 transition hover:bg-indigo-500/25"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, idx) => {
            if (m.role === "user") {
              return (
                <div key={idx} className="flex justify-end">
                  <div className="max-w-[85%] rounded-lg bg-indigo-600 px-4 py-2 text-white">
                    <p className="whitespace-pre-line text-sm">{m.content}</p>
                    <p className="mt-1 text-xs opacity-50">{time(m.timestamp)}</p>
                  </div>
                </div>
              );
            }
            if (m.role === "error") {
              return (
                <div key={idx} className="flex justify-start">
                  <div className="max-w-[85%] rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-red-700 dark:text-red-200">
                    <p className="text-sm">{m.content}</p>
                  </div>
                </div>
              );
            }
            const r = m.reply;
            return (
              <div key={idx} className="flex justify-start">
                <div className="max-w-[92%] rounded-lg bg-surface-2 px-4 py-3 text-fg-2">
                  {r.topic && (
                    <span className="mb-2 inline-block rounded-full bg-indigo-500/20 px-2 py-0.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-200">
                      {r.topic}
                    </span>
                  )}
                  <p className="whitespace-pre-line text-sm leading-relaxed">{r.answer}</p>

                  {r.kind === "knowledge" && !r.confident && (
                    <p className="mt-2 text-xs text-amber-300/80">Not fully sure this is what you meant — tell me if it isn't.</p>
                  )}

                  {r.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.sources.map((s) => (
                        <span key={`${s.group}-${s.name}`} className="rounded bg-surface px-2 py-1 text-xs text-muted">
                          {s.name}{" "}
                          <span className={`font-semibold ${accuracyColor(s.accuracy)}`}>{s.accuracy}%</span>{" "}
                          <span className="text-subtle">
                            ({s.correct}/{s.total})
                          </span>
                        </span>
                      ))}
                    </div>
                  )}

                  {r.resources.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {r.resources.map((res) => (
                        <a
                          key={res.url}
                          href={res.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block rounded bg-blue-500/10 px-2 py-1.5 transition hover:bg-blue-500/20"
                        >
                          <p className="text-xs font-semibold text-blue-700 dark:text-blue-200">{res.name}</p>
                          <p className="text-xs text-blue-300/70">{res.description}</p>
                        </a>
                      ))}
                    </div>
                  )}

                  {r.action && (
                    <button
                      onClick={() => navigate(r.action!.path)}
                      className="mt-3 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700"
                    >
                      {r.action.label} →
                    </button>
                  )}

                  {r.suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {r.suggestions.map((s) => (
                        <button
                          key={s.label}
                          onClick={() => send(s.prompt)}
                          disabled={loading}
                          className="rounded-full border border-indigo-400/40 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-700 dark:text-indigo-200 transition hover:bg-indigo-500/25 disabled:opacity-50"
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="mt-2 text-xs opacity-40">{time(m.timestamp)}</p>
                </div>
              </div>
            );
          })
        )}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-4 py-3" aria-label="Assistant is typing">
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:120ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400 [animation-delay:240ms]" />
            </div>
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="mt-4 flex gap-2"
      >
        <input
          type="text"
          value={input}
          maxLength={500}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a topic, an interview answer, or your progress..."
          className="flex-1 rounded-lg border border-line bg-surface-2 px-4 py-2 text-fg placeholder-white/50 transition-all focus:border-indigo-500 focus:bg-line focus:outline-none"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-lg bg-indigo-600 px-6 py-2 font-medium text-white transition-all hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </form>
    </section>
  );
}
