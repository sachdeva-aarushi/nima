import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, MoreVertical, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { MascotPortrait } from "@/components/MascotPortrait";
import { NimaMascot } from "@/components/NimaMascot";
import {
  clearPartnerNimaHistory,
  loadPartnerNimaHistory,
  sendPartnerNimaMessage,
  type PartnerChatTurn,
} from "@/lib/partner.functions";
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

export const Route = createFileRoute("/_app/partner/nima")({
  head: () => ({ meta: [{ title: "Talk to Nima — Partner" }] }),
  component: PartnerNimaChat,
});

interface ChatMessage {
  id: string;
  role: "partner" | "nima";
  content: string;
  createdAt: Date;
}

const QUICK_ACTIONS = [
  {
    label: "HOW CAN I HELP TONIGHT?",
    prompt: "What's one concrete thing I could do tonight to help her?",
  },
  {
    label: "HOW DO I CHECK IN?",
    prompt: "How do I check in on how she's doing without being invasive?",
  },
];

function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function PartnerNimaChat() {
  const navigate = useNavigate();
  const send = useServerFn(sendPartnerNimaMessage);
  const load = useServerFn(loadPartnerNimaHistory);
  const clearHistory = useServerFn(clearPartnerNimaHistory);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    load()
      .then((rows) => {
        setMessages(
          (rows as { id: string; role: string; content: string; created_at: string }[]).map(
            (r) => ({
              id: r.id,
              role: r.role as "partner" | "nima",
              content: r.content,
              createdAt: new Date(r.created_at),
            })
          )
        );
      })
      .catch(() => {});
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setInput("");
    setSending(true);
    const now = new Date();
    setMessages((m) => [
      ...m,
      { id: `u-${now.getTime()}`, role: "partner", content: trimmed, createdAt: now },
    ]);
    try {
      const history: PartnerChatTurn[] = messages.map((m) => ({ role: m.role, content: m.content }));
      const { reply } = await send({ data: { message: trimmed, history } });
      setMessages((m) => [
        ...m,
        { id: `n-${Date.now()}`, role: "nima", content: reply, createdAt: new Date() },
      ]);
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

  return (
    <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-[#FFF8F7]">
      <header className="flex items-center justify-between px-4 pb-3 pt-5">
        <button
          onClick={() => navigate({ to: "/partner/dashboard" })}
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 pb-2">
        {isEmpty && (
          <div className="mt-6 flex flex-col items-center text-center">
            <MascotPortrait state="listening" size="md" />
            <h2
              className="mt-4 text-2xl text-[#F38B82]"
              style={{ fontFamily: "ui-serif, Georgia, serif" }}
            >
              I'm here.
            </h2>
            <p className="mt-2 max-w-xs text-sm leading-relaxed text-[#8A6E6B]">
              Ask me anything about supporting her — practical things, what to
              say, what to watch for. I'll be direct.
            </p>
          </div>
        )}

        <ul className="space-y-3 pt-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "flex items-end gap-2",
                m.role === "partner" ? "justify-end" : "justify-start"
              )}
            >
              {m.role === "nima" && (
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#FFEEEB]">
                  <NimaMascot state="listening" size="sm" className="h-full w-full" />
                </span>
              )}
              <div
                className={cn(
                  "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm",
                  m.role === "partner"
                    ? "rounded-br-md bg-[#F38B82] text-white"
                    : "rounded-bl-md bg-white text-[#3D2A28]"
                )}
              >
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    m.role === "partner" ? "text-white/70" : "text-[#B59A97]"
                  )}
                >
                  {fmtTime(m.createdAt)}
                </p>
              </div>
            </li>
          ))}
          {sending && (
            <li className="flex items-end gap-2">
              <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-[#FFEEEB]">
                <NimaMascot state="thinking" size="sm" className="h-full w-full" />
              </span>
              <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-sm">
                <span className="flex gap-1">
                  {[0, 150, 300].map((d) => (
                    <span
                      key={d}
                      className="block h-1.5 w-1.5 animate-pulse rounded-full bg-[#E9B6B1]"
                      style={{ animationDelay: `${d}ms` }}
                    />
                  ))}
                </span>
              </div>
            </li>
          )}
        </ul>
      </div>

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

      <form
        onSubmit={onSubmit}
        className="flex items-center gap-2 border-t border-[#F1D9D5] bg-[#FFF8F7] px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <div className="flex flex-1 items-center gap-2 rounded-full bg-white px-4 py-2 shadow-sm">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Nima…"
            disabled={sending}
            className="flex-1 bg-transparent text-sm text-[#3D2A28] placeholder:text-[#B59A97] focus:outline-none"
          />
        </div>
        <button
          type="submit"
          aria-label="Send"
          disabled={sending || !input.trim()}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F38B82] text-white shadow-md disabled:opacity-50"
        >
          <Send className="h-5 w-5" />
        </button>
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
