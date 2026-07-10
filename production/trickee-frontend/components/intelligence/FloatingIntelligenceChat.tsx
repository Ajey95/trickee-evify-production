"use client";

import React from "react";
import { Bot, Mic, MicOff, Minimize2, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/Button";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  text: string;
};

const seedMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    text: "I am watching SOC, route load, charger windows, and driver pattern shifts. Ask me what needs attention.",
  },
];

function buildMockReply(prompt: string) {
  const lower = prompt.toLowerCase();
  if (lower.includes("charge") || lower.includes("battery") || lower.includes("soc")) {
    return "TRK-204 is the priority. SOC is at 22%, the next stop is 18 km away, and the safest action is a 14 minute top-up at Adajan before accepting another long route.";
  }
  if (lower.includes("route") || lower.includes("traffic")) {
    return "Route B is the cleaner choice right now: 6 minutes slower than the fastest route, but it preserves 8% more SOC and avoids the high current-draw corridor.";
  }
  if (lower.includes("driver")) {
    return "Rohith is trending smoother than the fleet baseline today. Keep the current coaching tone positive and only nudge if current draw crosses 42 A for more than 8 minutes.";
  }
  return "Fleet pulse looks steady. One vehicle needs charging attention, two routes should avoid stop-and-go pockets, and no driver coaching alert is severe enough to interrupt the shift.";
}

export function FloatingIntelligenceChat() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>(seedMessages);
  const [isListening, setIsListening] = React.useState(false);
  const [voiceSupported, setVoiceSupported] = React.useState(true);

  function sendMessage(nextInput = input) {
    const trimmed = nextInput.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = { id: Date.now(), role: "user", text: trimmed };
    const assistantMessage: ChatMessage = {
      id: Date.now() + 1,
      role: "assistant",
      text: buildMockReply(trimmed),
    };
    setMessages((current) => [...current, userMessage, assistantMessage]);
    setInput("");
  }

  function startListening() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setInput(transcript);
      sendMessage(transcript);
    };
    recognition.start();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-accent-teal/35 bg-[#071218]/95 text-accent-teal shadow-2xl shadow-accent-teal/15 backdrop-blur-xl transition hover:scale-[1.03] hover:border-accent-teal md:bottom-6 md:right-6"
        aria-label="Open Trickee AI intelligence chat"
      >
        <Bot className="h-6 w-6" />
      </button>
    );
  }

  return (
    <section className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-3 z-40 w-[calc(100vw-1.5rem)] max-w-[390px] overflow-hidden rounded-xl border border-bg-border/90 bg-[#080d13]/95 shadow-2xl shadow-black/40 backdrop-blur-xl md:bottom-6 md:right-6">
      <div className="flex items-center justify-between border-b border-bg-border/80 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-teal text-bg-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary">Trickee Intelligence</h2>
            <p className="text-[11px] text-text-dim">Mock Coice/voice assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setIsOpen(false)} className="rounded-md p-2 text-text-dim hover:bg-white/[0.06] hover:text-text-primary" aria-label="Minimize chat">
            <Minimize2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setMessages(seedMessages)} className="rounded-md p-2 text-text-dim hover:bg-white/[0.06] hover:text-text-primary" aria-label="Clear chat">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="max-h-[360px] space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[86%] rounded-xl px-3 py-2 text-sm leading-5 ${
                message.role === "user"
                  ? "bg-accent-teal text-bg-primary"
                  : "border border-bg-border bg-bg-primary/70 text-text-primary"
              }`}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      {!voiceSupported && (
        <p className="mx-4 mb-3 rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber">
          Browser voice input is not available here. Typed chat still works.
        </p>
      )}

      <div className="border-t border-bg-border/80 p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask about SOC, route, driver, charger..."
            className="min-h-11 flex-1 resize-none rounded-lg border border-bg-border bg-bg-primary/70 px-3 py-2 text-sm text-text-primary outline-none placeholder:text-text-dim focus:border-accent-teal"
          />
          <Button type="button" variant={isListening ? "danger" : "secondary"} className="h-11 w-11 shrink-0 p-0" onClick={startListening} aria-label="Use voice input">
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="button" className="h-11 w-11 shrink-0 p-0" onClick={() => sendMessage()} aria-label="Send message">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
