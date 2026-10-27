import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MoreVertical, Smile, Mic, Send, Check, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MascotPortrait } from "@/components/MascotPortrait";
import { NimaMascot } from "@/components/NimaMascot";
import { checkCrisis } from "@/lib/crisisCheck";
import {
  clearNimaHistory,
  ensureDailyPulse,
  loadNimaHistory,
  saveCrisisMessage,
  sendNimaMessage,
  type ChatTurn,
  type ToolCallReceipt,
  type NavigationEvent,
} from "@/lib/nima-chat.functions";
import { extractInsights } from "@/lib/insights.functions";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_app/nima")({
  head: () => ({ meta: [{ title: "Talk to Nima" }] }),
  component: NimaChatScreen,
});

interface ChatMessage {
  id: string;
  role: "user" | "nima";
  content: string;
  createdAt: Date;
  receipts?: ToolCallReceipt[];
}

const QUICK_ACTIONS = [
  { label: "BREATHING HELP", prompt: "Can you walk me through a short breathing exercise?" },
  { label: "TELL ME A STORY", prompt: "Could you tell me a calming story to help me unwind?" },
];

// Receipt chip mapping — quiet, secondary, ink-soft.
const RECEIPT_LABELS: Record<string, string> = {
  log_symptom: "symptom noted",
  update_checkin_mood: "mood updated",
  add_insight: "remembered",
  update_progress_milestone: "milestone marked",
};

const RECEIPT_TOOLS = new Set(Object.keys(RECEIPT_LABELS));

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function ReceiptChip({ receipt }: { receipt: ToolCallReceipt }) {
  const label = RECEIPT_LABELS[receipt.tool] ?? receipt.label;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#E9DAD7] bg-white/60 px-2 py-0.5 text-[10px] font-medium text-[#8A6E6B]">
      <Check className="h-2.5 w-2.5 text-[#B59A97]" strokeWidth={3} />
      {label}
    </span>
  );
}

function NimaChatScreen() {
  const navigate = useNavigate();
  const send = useServerFn(sendNimaMessage);
  const load = useServerFn(loadNimaHistory);
  const flagCrisis = useServerFn(saveCrisisMessage);
  const extract = useServerFn(extractInsights);
  const ensurePulse = useServerFn(ensureDailyPulse);
  const clearHistory = useServerFn(clearNimaHistory);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionReceipts, setSessionReceipts] = useState<ToolCallReceipt[]>([]);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Tracks whether we navigated away via a tool event (suppress the unmount toast in that case).
  const navigatedByToolRef = useRef(false);

  useEffect(() => {
    (async () => {
      // Ensure today's pulse question exists as Nima's first message of the day.
      try {
        await ensurePulse();
      } catch {
        /* non-blocking */
      }
      try {
        const rows = await load();
        setMessages(
          rows.map((r) => ({
            id: r.id,
            role: r.role as "user" | "nima",
            content: r.content,
            createdAt: new Date(r.created_at),
          })),
        );
      } catch {
        /* ignore */
      }
    })();
  }, [load, ensurePulse]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Session summary on leave: when user navigates away with managed tool calls, toast a summary.
  useEffect(() => {
    return () => {
      if (navigatedByToolRef.current) return;
      const managed = sessionReceipts.filter(
        (r) => r.status === "ok" && RECEIPT_TOOLS.has(r.tool),
      );
      if (managed.length === 0) return;
      const lines = managed.map((r) => `• ${RECEIPT_LABELS[r.tool] ?? r.label}`).join("\n");
      toast("Here's what Nima managed for you", {
        description: lines,
        duration: 6000,
      });
    };
  }, [sessionReceipts]);

  function runNavigation(event: NavigationEvent) {
    if (!event) return;
    navigatedByToolRef.current = true;
    if (event.type === "crisis") {
      navigate({ to: "/crisis" });
    } else if (event.type === "quiz") {
      navigate({
        to: "/quiz",
        search: {
          symptom: event.params.category,
          issue: event.params.issueText,
          from: "nima",
        },
      });
    }
  }

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    // Crisis check BEFORE sending to AI.
    const crisis = checkCrisis(trimmed);
    if (crisis.isCrisis) {
      const now = new Date();
      setMessages((m) => [
        ...m,
        { id: `u-${now.getTime()}`, role: "user", content: trimmed, createdAt: now },
        {
          id: `n-${now.getTime() + 1}`,
          role: "nima",
          content:
            "I hear you, and I'm so glad you said that out loud. You don't have to carry this alone — I'm taking you to people trained for exactly this moment.",
          createdAt: new Date(now.getTime() + 1),
        },
      ]);
      setInput("");
      try {
        await flagCrisis({ data: { message: trimmed } });
      } catch {
        /* persist best-effort */
      }
      setTimeout(() => {
        navigatedByToolRef.current = true;
        navigate({ to: "/crisis" });
      }, 900);
      return;
    }

    setInput("");
    setSending(true);
    const now = new Date();
    const userMsg: ChatMessage = {
      id: `u-${now.getTime()}`,
      role: "user",
      content: trimmed,
      createdAt: now,
    };
    setMessages((m) => [...m, userMsg]);

    try {
      const history: ChatTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
      const result = await send({ data: { message: trimmed, history } });
      const receipts = result.tool_calls_executed ?? [];
      setMessages((m) => [
        ...m,
        {
          id: `n-${Date.now()}`,
          role: "nima",
          content: result.text ?? result.reply,
          createdAt: new Date(),
          receipts,
        },
      ]);
      if (receipts.length) {
        setSessionReceipts((prev) => [...prev, ...receipts]);
      }

      // Navigation: wait ~800ms after the message renders so she can read it.
      if (result.navigation_event) {
        setTimeout(() => runNavigation(result.navigation_event), 800);
      }

      // Fire-and-forget extraction over the latest exchange.
      const excerpt = `Mother: ${trimmed}\nNima: ${result.text ?? result.reply}`;
      void extract({ data: { source: "chat", excerpt } }).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    submit(input);
  }

  const isEmpty = messages.length === 0;
  const managedSummary = sessionReceipts.filter(
    (r) => r.status === "ok" && RECEIPT_TOOLS.has(r.tool),
  );

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-[#FFF8F7]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 pb-3 pt-5">
        <button
          onClick={() => navigate({ to: "/dashboard" })}
          aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1
          className="text-xl italic text-[#F38B82]"
          style={{ fontFamily: "ui-serif, Georgia, serif" }}
        >
          talk to nima
        </h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              aria-label="Menu"
              className="flex h-9 w-9 items-center justify-center rounded-full text-[#3D2A28]"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setConfirmClear(true);
              }}
              className="text-[#C24A44] focus:text-[#C24A44]"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              delete chat & start fresh
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-2">
        {isEmpty && (
          <div className="mt-6 flex flex-col items-center text-center">
            <MascotPortrait state="happy" size="md" />
            <h2
              className="mt-4 text-2xl italic text-[#F38B82]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              i'm here
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#8A6E6B]">
              whatever's on your mind — a worry, a question, or just needing
              someone to sit with. i'm listening.
            </p>
          </div>
        )}

        {!isEmpty && (
          <div className="my-4 text-center text-[11px] uppercase tracking-wider text-[#C7A39F]">
            Today
          </div>
        )}

        <ul className="space-y-3">
          {messages.map((m) => {
            const chips = (m.receipts ?? []).filter(
              (r) => r.status === "ok" && RECEIPT_TOOLS.has(r.tool),
            );
            return (
              <li
                key={m.id}
                className={cn(
                  "flex items-end gap-2",
                  m.role === "user" ? "justify-end" : "justify-start",
                )}
              >
                {m.role === "nima" && (
                  <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#FFEEEB]">
                    <NimaMascot state="listening" size="sm" className="h-full w-full" />
                  </span>
                )}
                <div className={cn("flex max-w-[78%] flex-col", m.role === "user" ? "items-end" : "items-start")}>
                  <div
                    className={cn(
                      "rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                      m.role === "user"
                        ? "bg-[#F38B82] text-white rounded-br-md"
                        : "bg-white text-[#3D2A28] rounded-bl-md",
                    )}
                  >
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p
                      className={cn(
                        "mt-1 text-[10px]",
                        m.role === "user" ? "text-white/70" : "text-[#B59A97]",
                      )}
                    >
                      {fmtTime(m.createdAt)}
                    </p>
                  </div>
                  {chips.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {chips.map((r, i) => (
                        <ReceiptChip key={`${m.id}-r-${i}`} receipt={r} />
                      ))}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
          {sending && (
            <li className="flex items-end gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#FFEEEB]">
                <NimaMascot state="thinking" size="sm" className="h-full w-full" />
              </span>
              <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                <span className="flex gap-1">
                  <Dot delay={0} />
                  <Dot delay={150} />
                  <Dot delay={300} />
                </span>
              </div>
            </li>
          )}
        </ul>

        {/* Session summary: in-conversation card, shown only when there's something to show. */}
        {managedSummary.length > 0 && (
          <div className="mx-1 mb-3 mt-4 rounded-2xl border border-[#EFE0DC] bg-white/70 px-3 py-2.5 text-[11px] text-[#6F5552] shadow-sm">
            <button
              type="button"
              onClick={() => setSummaryOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="font-semibold uppercase tracking-wider text-[#A8908D]">
                what nima managed this conversation
              </span>
              {summaryOpen ? (
                <ChevronUp className="h-3.5 w-3.5 text-[#A8908D]" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5 text-[#A8908D]" />
              )}
            </button>
            {summaryOpen && (
              <ul className="mt-2 space-y-1">
                {managedSummary.map((r, i) => (
                  <li key={i} className="flex items-center gap-1.5">
                    <Check className="h-2.5 w-2.5 text-[#B59A97]" strokeWidth={3} />
                    <span>{RECEIPT_LABELS[r.tool] ?? r.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2 px-4 pb-2">
        {QUICK_ACTIONS.map((q) => (
          <button
            key={q.label}
            type="button"
            disabled={sending}
            onClick={() => submit(q.prompt)}
            className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold tracking-wider text-[#D4726D] shadow-sm transition hover:bg-[#FFF1EF] disabled:opacity-50"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Composer */}
      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t border-[#F1D9D5] bg-[#FFF8F7] px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Share your thoughts..."
            disabled={sending}
            className="flex-1 bg-transparent text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:outline-none"
          />
          <button
            type="button"
            aria-label="Emoji"
            className="text-[#C7A39F]"
            tabIndex={-1}
          >
            <Smile className="h-5 w-5" />
          </button>
        </div>
        {input.trim() ? (
          <button
            type="submit"
            aria-label="Send"
            disabled={sending}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F38B82] text-white shadow-md transition disabled:opacity-50"
          >
            <Send className="h-5 w-5" />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Voice input — coming soon"
            onClick={() => toast("voice input is coming soon — for now, type away.")}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F38B82]/70 text-white shadow-md transition hover:bg-[#F38B82]"
          >
            <Mic className="h-5 w-5" />
          </button>
        )}
      </form>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>delete chat & start fresh?</AlertDialogTitle>
            <AlertDialogDescription>
              this will permanently delete your conversation with nima. you can't undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearing}>cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearing}
              onClick={async (e) => {
                e.preventDefault();
                setClearing(true);
                try {
                  await clearHistory();
                  setMessages([]);
                  setSessionReceipts([]);
                  navigatedByToolRef.current = true; // suppress leave-toast
                  try {
                    await ensurePulse();
                    const rows = await load();
                    setMessages(
                      rows.map((r) => ({
                        id: r.id,
                        role: r.role as "user" | "nima",
                        content: r.content,
                        createdAt: new Date(r.created_at),
                      })),
                    );
                  } catch {
                    /* non-blocking */
                  }
                  navigatedByToolRef.current = false;
                  toast("chat cleared — fresh start.");
                  setConfirmClear(false);
                  inputRef.current?.focus();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Couldn't clear chat.");
                } finally {
                  setClearing(false);
                }
              }}
              className="bg-[#C24A44] text-white hover:bg-[#A93D38]"
            >
              {clearing ? "clearing…" : "delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="block h-1.5 w-1.5 animate-pulse rounded-full bg-[#E9B6B1]"
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}
