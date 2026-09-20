"use client";

import React from "react";
import { Bot, Mic, MicOff, Minimize2, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/Button";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { api } from "@/lib/api";
import { chatVehiclesForDriver, selectChatVehicleId } from "@/lib/chat-context.mjs";
import type { Driver, Vehicle } from "@/types";

type ChatMessage = { id: number; role: "assistant" | "user"; text: string };
const seedMessages: ChatMessage[] = [{ id: 1, role: "assistant", text: "Ask about the selected driver and vehicle. Answers come from the authenticated Trickee backend." }];

function answerText(data: any) {
  const value = data?.answer ?? data?.message ?? data?.explanation ?? data?.summary;
  return typeof value === "string" && value.trim() ? value.trim() : "The assistant returned no readable answer. Please try again.";
}

export function FloatingIntelligenceChat() {
  const { user, status } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [messages, setMessages] = React.useState<ChatMessage[]>(seedMessages);
  const [drivers, setDrivers] = React.useState<Driver[]>([]);
  const [vehicles, setVehicles] = React.useState<Vehicle[]>([]);
  const [selectedDriverId, setSelectedDriverId] = React.useState("");
  const [selectedVehicleId, setSelectedVehicleId] = React.useState("");
  const [contextError, setContextError] = React.useState("");
  const [requestError, setRequestError] = React.useState("");
  const [lastFailedPrompt, setLastFailedPrompt] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const requestGeneration = React.useRef(0);
  const requestPending = React.useRef(false);
  const messageId = React.useRef(2);
  const voice = useSpeechRecognition({ onTranscript: setInput });

  React.useEffect(() => {
    const generation = ++requestGeneration.current;
    requestPending.current = false;
    setIsLoading(false); setMessages(seedMessages); setInput(""); setRequestError(""); setLastFailedPrompt("");
    setDrivers([]); setVehicles([]); setSelectedDriverId(""); setSelectedVehicleId(""); setContextError("");
    if (!user || status !== "authenticated") return;
    let active = true;
    void (async () => {
      try {
        const [driverResult, vehicleResult] = user.role === "driver"
          ? await Promise.all([api.drivers.me().then((result) => ({ ...result, data: result.success ? [result.data] : [] })), api.vehicles.mine()])
          : await Promise.all([api.drivers.list(), api.vehicles.list()]);
        if (!active || generation !== requestGeneration.current) return;
        if (!driverResult.success || !vehicleResult.success) {
          setContextError(driverResult.error || vehicleResult.error || "Unable to load your fleet context."); return;
        }
        const initialDriver = driverResult.data.find((driver) => chatVehiclesForDriver(vehicleResult.data, driver.id).length) ?? driverResult.data[0];
        const initialDriverId = initialDriver?.id || "";
        const initialVehicleId = selectChatVehicleId(vehicleResult.data, initialDriverId);
        setDrivers(driverResult.data); setVehicles(vehicleResult.data);
        setSelectedDriverId(initialDriverId); setSelectedVehicleId(initialVehicleId);
        if (!initialDriverId || !initialVehicleId) setContextError("No assigned driver and vehicle context is available for this account.");
      } catch {
        if (active && generation === requestGeneration.current) setContextError("Unable to reach the backend to load fleet context.");
      }
    })();
    return () => { active = false; requestGeneration.current += 1; requestPending.current = false; };
  }, [status, user]);

  React.useEffect(() => () => { requestGeneration.current += 1; requestPending.current = false; }, []);

  const selectedDriver = drivers.find((driver) => driver.id === selectedDriverId);
  const compatibleVehicles = chatVehiclesForDriver(vehicles, selectedDriverId) as Vehicle[];
  const selectedVehicle = compatibleVehicles.find((vehicle) => vehicle.id === selectedVehicleId);
  const contextLabel = selectedDriver && selectedVehicle ? `${selectedDriver.driver_code} · ${selectedDriver.full_name} / ${selectedVehicle.vehicle_code}` : "No fleet context selected";

  async function sendMessage(nextInput = input) {
    const trimmed = nextInput.trim();
    if (!trimmed || requestPending.current) return;
    if (status !== "authenticated" || !user) { setRequestError("Your session is no longer authenticated. Sign in again to use the assistant."); return; }
    if (!selectedDriver || !selectedVehicle) { setRequestError(contextError || "Select an assigned driver and vehicle before sending a message."); return; }
    const generation = requestGeneration.current;
    requestPending.current = true; setIsLoading(true); setRequestError(""); setLastFailedPrompt("");
    setMessages((current) => [...current, { id: messageId.current++, role: "user", text: trimmed }]); setInput("");
    const latest = selectedVehicle.latest ?? selectedVehicle.latest_telemetry;
    const lat = Number(latest?.lat); const lng = Number(latest?.lng);
    try {
      const response = await api.assistant.message({ driver_id: selectedDriver.id, vehicle_id: selectedVehicle.id, channel: "app", message: trimmed, ...(Number.isFinite(lat) && Number.isFinite(lng) ? { location: { lat, lng } } : {}) });
      if (generation !== requestGeneration.current || status !== "authenticated") return;
      if (!response.success) { setRequestError(response.error || "The assistant request failed. Please try again."); setLastFailedPrompt(trimmed); return; }
      setMessages((current) => [...current, { id: messageId.current++, role: "assistant", text: answerText(response.data) }]);
    } catch {
      if (generation === requestGeneration.current) { setRequestError("Unable to reach the assistant backend. Check your connection and try again."); setLastFailedPrompt(trimmed); }
    } finally {
      if (generation === requestGeneration.current) { requestPending.current = false; setIsLoading(false); }
    }
  }

  function clearChat() {
    requestGeneration.current += 1; requestPending.current = false; setIsLoading(false); setMessages(seedMessages); setInput(""); setRequestError(""); setLastFailedPrompt(""); voice.cancel();
  }

  function minimizeChat() {
    voice.cancel(); setIsOpen(false);
  }

  function changeDriverContext(driverId: string) {
    if (driverId === selectedDriverId) return;
    clearChat();
    const vehicleId = selectChatVehicleId(vehicles, driverId, selectedVehicleId);
    setSelectedDriverId(driverId); setSelectedVehicleId(vehicleId);
    setContextError(vehicleId ? "" : "No vehicle is currently mapped to this driver.");
  }

  function changeVehicleContext(vehicleId: string) {
    if (vehicleId === selectedVehicleId) return;
    clearChat(); setSelectedVehicleId(vehicleId); setContextError("");
  }

  if (!isOpen) return <button type="button" onClick={() => setIsOpen(true)} className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-accent-teal/35 bg-[#071218]/95 text-accent-teal shadow-2xl shadow-accent-teal/15 backdrop-blur-xl transition hover:scale-[1.03] hover:border-accent-teal md:bottom-6 md:right-6" aria-label="Open Trickee AI intelligence chat"><Bot className="h-6 w-6" /></button>;

  return <section className="fixed bottom-[calc(88px+env(safe-area-inset-bottom))] right-3 z-40 w-[calc(100vw-1.5rem)] max-w-[390px] overflow-hidden rounded-xl border border-bg-border/90 bg-[#080d13]/95 shadow-2xl shadow-black/40 backdrop-blur-xl md:bottom-6 md:right-6">
    <div className="flex items-center justify-between border-b border-bg-border/80 px-4 py-3">
      <div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent-teal text-bg-primary"><Sparkles className="h-4 w-4" /></div><div><h2 className="text-sm font-semibold text-text-primary">Trickee Intelligence</h2><p className="text-[11px] text-text-dim">Live fleet assistant</p></div></div>
      <div className="flex items-center gap-1"><button type="button" onClick={minimizeChat} className="rounded-md p-2 text-text-dim hover:bg-white/[0.06]" aria-label="Minimize chat"><Minimize2 className="h-4 w-4" /></button><button type="button" onClick={clearChat} className="rounded-md p-2 text-text-dim hover:bg-white/[0.06]" aria-label="Clear chat"><X className="h-4 w-4" /></button></div>
    </div>
    <div className="border-b border-bg-border/60 px-4 py-2 text-[11px] text-text-dim"><p className="truncate" title={contextLabel}>Context: {contextLabel}</p>
      {(drivers.length > 1 || compatibleVehicles.length > 1) && <div className="mt-2 grid grid-cols-2 gap-2"><select aria-label="Chat driver context" value={selectedDriverId} onChange={(event) => changeDriverContext(event.target.value)} disabled={isLoading} className="min-w-0 rounded border border-bg-border bg-bg-primary px-2 py-1 text-text-primary disabled:opacity-60">{drivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.driver_code} · {driver.full_name}</option>)}</select><select aria-label="Chat vehicle context" value={selectedVehicleId} onChange={(event) => changeVehicleContext(event.target.value)} disabled={isLoading || !compatibleVehicles.length} className="min-w-0 rounded border border-bg-border bg-bg-primary px-2 py-1 text-text-primary disabled:opacity-60">{!compatibleVehicles.length && <option value="">No mapped vehicle</option>}{compatibleVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.vehicle_code}</option>)}</select></div>}
    </div>
    <div className="max-h-[320px] space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">{messages.map((message) => <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[86%] rounded-xl px-3 py-2 text-sm leading-5 ${message.role === "user" ? "bg-accent-teal text-bg-primary" : "border border-bg-border bg-bg-primary/70 text-text-primary"}`}>{message.text}</div></div>)}{isLoading && <p className="text-xs text-text-dim">Assistant is checking the selected live context…</p>}</div>
    {(contextError || requestError || voice.error) && <div className="mx-4 mb-3 rounded-lg border border-accent-amber/30 bg-accent-amber/10 px-3 py-2 text-xs text-accent-amber"><p>{requestError || contextError || voice.error}</p>{lastFailedPrompt && <button type="button" onClick={() => void sendMessage(lastFailedPrompt)} className="mt-2 inline-flex items-center gap-1 font-semibold underline" disabled={isLoading}><RotateCcw className="h-3 w-3" /> Retry</button>}</div>}
    <div className="border-t border-bg-border/80 p-3"><div className="flex items-end gap-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} placeholder="Ask about this driver and vehicle..." className="min-h-11 flex-1 resize-none rounded-lg border border-bg-border bg-bg-primary/70 px-3 py-2 text-sm text-text-primary outline-none" disabled={status !== "authenticated"} /><Button type="button" variant={voice.isListening ? "danger" : "secondary"} className="h-11 w-11 shrink-0 p-0" onClick={voice.isListening ? voice.stop : voice.start} aria-label={voice.isListening ? "Stop voice input" : "Use voice input"}>{voice.isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}</Button><Button type="button" className="h-11 w-11 shrink-0 p-0" onClick={() => void sendMessage()} aria-label="Send message" disabled={isLoading || !input.trim()}><Send className="h-4 w-4" /></Button></div></div>
  </section>;
}
