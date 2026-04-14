"use client"

import { useEffect, useLayoutEffect, useRef, useState, useCallback } from "react"
import { ScrollReveal } from "./scroll-reveal"
import {
  Send, Bot, User, Sparkles, MapPin, Shield, Zap, Target, TrendingUp,
  ArrowDown, ArrowUp, Thermometer, Wind, Droplets, AlertTriangle, Activity,
  CheckSquare, Square, ChevronDown, ChevronUp, FileText,
} from "lucide-react"
import { AnimatedCounter } from "./animated-counter"

// ─── Data ────────────────────────────────────────────────────────────────────

const cityHotspots = [
  { id: 1, name: "Chicago", lat: 41.878, lng: -87.629, risk: 72, pop: 2696000, temp: 38, type: "critical" },
  { id: 2, name: "Phoenix", lat: 33.448, lng: -112.074, risk: 91, pop: 1608000, temp: 47, type: "extreme" },
  { id: 3, name: "Houston", lat: 29.760, lng: -95.369, risk: 68, pop: 2304000, temp: 40, type: "high" },
  { id: 4, name: "New York", lat: 40.712, lng: -74.005, risk: 55, pop: 8336000, temp: 35, type: "high" },
  { id: 5, name: "Miami", lat: 25.775, lng: -80.208, risk: 83, pop: 478000, temp: 43, type: "critical" },
  { id: 6, name: "Los Angeles", lat: 34.052, lng: -118.243, risk: 61, pop: 3979000, temp: 42, type: "high" },
  { id: 7, name: "Denver", lat: 39.739, lng: -104.984, risk: 44, pop: 749000, temp: 34, type: "medium" },
  { id: 8, name: "Seattle", lat: 47.606, lng: -122.332, risk: 32, pop: 737000, temp: 29, type: "medium" },
]

const riskConfig = {
  extreme: { color: "#ef4444", glow: "rgba(239,68,68,0.6)", label: "Extreme" },
  critical: { color: "#f97316", glow: "rgba(249,115,22,0.6)", label: "Critical" },
  high: { color: "#eab308", glow: "rgba(234,179,8,0.6)", label: "High" },
  medium: { color: "#84cc16", glow: "rgba(132,204,22,0.6)", label: "Medium" },
}

function scoreToLevel(score: number): keyof typeof riskConfig {
  if (score >= 75) return "extreme"
  if (score >= 55) return "critical"
  if (score >= 35) return "high"
  return "medium"
}

const impactMetrics = [
  { icon: Shield, label: "Heat Risk Reduction", value: 35, suffix: "%", direction: "down", description: "Average reduction in heat-related health risks across simulated city scenarios using optimized cooling infrastructure placement.", color: "text-green-400", bgColor: "bg-green-400/10", borderColor: "border-green-400/20" },
  { icon: Zap, label: "Emergency Response", value: 48, suffix: "%", direction: "up", description: "Improvement in emergency response times when resources are positioned using AI-optimized placement derived from population vulnerability maps.", color: "text-blue-400", bgColor: "bg-blue-400/10", borderColor: "border-blue-400/20" },
  { icon: Target, label: "Resource Optimization", value: 27, suffix: "%", direction: "down", description: "Reduction in redundant infrastructure spend through AI-driven analysis identifying overlap zones and underserved areas simultaneously.", color: "text-orange-400", bgColor: "bg-orange-400/10", borderColor: "border-orange-400/20" },
  { icon: TrendingUp, label: "Planning Speed", value: 10, suffix: "x", direction: "up", description: "Faster scenario evaluation compared to traditional planning methods — what takes months of analysis now runs in seconds.", color: "text-lime-400", bgColor: "bg-lime-400/10", borderColor: "border-lime-400/20" },
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface SimResult { cityName: string; riskScore: number }

interface HistoryItem {
  cityName: string
  riskScore: number
  riskLevel: keyof typeof riskConfig
  timeAgo: string
  explanation: string
}

interface MarkerUpdate {
  cityId: number
  prevScore: number
  newScore: number
  riskLevel: keyof typeof riskConfig
  topFactor: string
}

// ─── Leaflet Map ──────────────────────────────────────────────────────────────

function CityMap({
  selected,
  onSelect,
  markerUpdate,
  onDismissCard,
}: {
  selected: number | null
  onSelect: (id: number) => void
  markerUpdate: MarkerUpdate | null
  onDismissCard: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<ReturnType<typeof import("leaflet").map> | null>(null)
  const markersRef = useRef<Map<number, ReturnType<typeof import("leaflet").circleMarker>>>(new Map())
  const pulseTimersRef = useRef<ReturnType<typeof setInterval>[]>([])

  // Build map once
  useEffect(() => {
    let L: typeof import("leaflet")

    const init = async () => {
      L = (await import("leaflet")).default
      // @ts-expect-error - leaflet icon default
      delete L.Icon.Default.prototype._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      })

      if (!containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        center: [38, -96], zoom: 4, zoomControl: true,
        attributionControl: false, scrollWheelZoom: false,
      })

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        subdomains: "abcd", maxZoom: 19,
      }).addTo(map)

      cityHotspots.forEach((city) => {
        const cfg = riskConfig[city.type as keyof typeof riskConfig]
        const radius = city.type === "extreme" ? 18 : city.type === "critical" ? 15 : city.type === "high" ? 12 : 10

        const marker = L.circleMarker([city.lat, city.lng], {
          radius, fillColor: cfg.color, color: cfg.color,
          weight: 2, opacity: 0.9, fillOpacity: 0.55,
        })

        const tooltipHtml = `
          <div style="background:#0a0a0a;border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px 14px;min-width:160px;font-family:inherit;">
            <div style="font-size:13px;font-weight:700;color:#fff;margin-bottom:6px;">${city.name}</div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#a3a3a3;margin-bottom:3px;">
              <span>Risk Score</span><span style="color:${cfg.color};font-weight:700;">${city.risk}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#a3a3a3;margin-bottom:3px;">
              <span>Peak Temp</span><span style="color:#fff;font-weight:600;">${city.temp}°C</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:#a3a3a3;">
              <span>Population</span><span style="color:#fff;font-weight:600;">${(city.pop / 1e6).toFixed(1)}M</span>
            </div>
          </div>`

        marker.bindTooltip(tooltipHtml, { permanent: false, direction: "top", className: "civic-tooltip", offset: [0, -8] })
        marker.on("click", () => onSelect(city.id))
        marker.addTo(map)
        markersRef.current.set(city.id, marker)
      })

      mapRef.current = map
    }

    init()

    return () => {
      pulseTimersRef.current.forEach(clearInterval)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markersRef.current.clear() }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Highlight selected
  useEffect(() => {
    markersRef.current.forEach((marker, id) => {
      const city = cityHotspots.find((c) => c.id === id)
      if (!city) return
      const cfg = riskConfig[city.type as keyof typeof riskConfig]
      if (id === selected) {
        marker.setStyle({ weight: 3, opacity: 1, fillOpacity: 0.85, color: "#d9f99d" })
      } else {
        marker.setStyle({ weight: 2, opacity: 0.9, fillOpacity: 0.55, color: cfg.color })
      }
    })
  }, [selected])

  // Pulse + recolor on markerUpdate
  useEffect(() => {
    if (!markerUpdate) return
    const marker = markersRef.current.get(markerUpdate.cityId)
    if (!marker) return

    const newCfg = riskConfig[markerUpdate.riskLevel]
    let pulseCount = 0
    const MAX_PULSES = 6 // 3 full pulses (expand/contract)

    const timer = setInterval(() => {
      pulseCount++
      if (pulseCount % 2 === 1) {
        marker.setStyle({ radius: 24, fillOpacity: 0.9, color: newCfg.color, fillColor: newCfg.color, weight: 4 })
      } else {
        marker.setStyle({ radius: 16, fillOpacity: 0.6, color: newCfg.color, fillColor: newCfg.color, weight: 2 })
      }
      if (pulseCount >= MAX_PULSES) {
        clearInterval(timer)
        marker.setStyle({ radius: 16, fillOpacity: 0.7, color: newCfg.color, fillColor: newCfg.color, weight: 2 })
      }
    }, 350)

    pulseTimersRef.current.push(timer)
  }, [markerUpdate])

  return (
    <>
      <style>{`
        .civic-tooltip .leaflet-tooltip { background: transparent !important; border: none !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-container { background: #0d0d0d; }
      `}</style>
      <div ref={containerRef} className="w-full h-full rounded-xl" />

      {/* Floating marker card */}
      {markerUpdate && (
        <div
          className="absolute top-3 left-3 z-[1000] bg-gray-900/95 backdrop-blur border border-white/15 rounded-xl p-3.5 shadow-2xl max-w-[220px]"
          style={{ animation: "slideInFromTop 0.3s ease-out" }}
        >
          <button
            onClick={onDismissCard}
            className="absolute top-2 right-2 text-neutral-500 hover:text-white text-xs leading-none"
            aria-label="Dismiss"
          >✕</button>
          <p className="text-white font-semibold text-sm mb-1">{markerUpdate.cityId === 1 ? "Chicago" : cityHotspots.find(c => c.id === markerUpdate.cityId)?.name}</p>
          <div className="flex items-center gap-1.5 text-xs mb-2">
            <span className="text-neutral-400">{markerUpdate.prevScore}</span>
            <span className="text-neutral-500">→</span>
            <span className="font-bold" style={{ color: riskConfig[markerUpdate.riskLevel].color }}>{markerUpdate.newScore}</span>
            {markerUpdate.newScore < markerUpdate.prevScore
              ? <ArrowDown className="w-3 h-3 text-green-400" />
              : <ArrowUp className="w-3 h-3 text-red-400" />}
          </div>
          <span
            className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full mb-2"
            style={{ background: riskConfig[markerUpdate.riskLevel].color + "30", color: riskConfig[markerUpdate.riskLevel].color }}
          >
            {riskConfig[markerUpdate.riskLevel].label}
          </span>
          <p className="text-[10px] text-neutral-400 leading-relaxed">{markerUpdate.topFactor}</p>
        </div>
      )}
    </>
  )
}

// ─── AI Copilot Chat ──────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
}

/** Parses "N Suggested Follow-Up Actions:" sections where each item may be split across lines (number line, then body). */
function parseNumberedFollowUpSection(section: string): string[] {
  const items: string[] = []
  const lines = section.split(/\r?\n/)
  const current: string[] = []
  let inItem = false

  for (const line of lines) {
    const m = line.match(/^\s*(\d+)\.\s*(.*)$/)
    if (m) {
      if (inItem && current.length) items.push(current.join(" ").trim())
      current.length = 0
      inItem = true
      const tail = m[2].trim()
      if (tail) current.push(tail)
    } else if (inItem && line.trim()) {
      current.push(line.trim())
    }
  }
  if (inItem && current.length) items.push(current.join(" ").trim())
  return items.filter((s) => s.length >= 3)
}

function extractSuggestedFollowUps(reply: string): { cleanReply: string; followUps: string[] } {
  let cut = reply
  const idx = cut.search(/\d*\s*\*?\*?Suggested Follow[- ]Up Actions?\*?\*?\s*:?/i)
  if (idx !== -1) {
    cut = cut.slice(0, idx).replace(/\n+$/u, "").trimEnd()
  }
  // Trailing pin/suggested block some models emit after a rule line
  cut = cut.replace(/\n---\s*\n+[\s\S]*?📌[\s\S]*$/u, "")
  cut = cut.replace(/\n---\s*\n+\s*📌[\s\S]*$/u, "")
  const after = idx !== -1
    ? reply.slice(idx).replace(/^\d*\s*\*?\*?Suggested Follow[- ]Up Actions?\*?\*?\s*:?\s*\n?/i, "")
    : ""
  const followUps = idx !== -1 ? parseNumberedFollowUpSection(after) : []
  return { cleanReply: cut, followUps }
}

/** Strip ** / * used as markdown so chips show plain text. */
function stripInlineMarkdownMarkers(s: string): string {
  return s.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/\*([^*]+)\*/g, "$1").replace(/\*\*/g, "").trim()
}

function isBulletOrNumberedLine(line: string): boolean {
  const t = line.trimStart()
  return /^[-*]\s/.test(t) || /^\d+\.\s/.test(t)
}

/** True when the line looks like a scenario banner (not body bullets). */
function looksLikeScenarioBannerLine(line: string): boolean {
  const t = line.trim()
  if (!t || t.length > 320) return false
  if (isBulletOrNumberedLine(t)) return false
  if (/^#{1,6}\s/.test(t)) return true
  if (/^\*\*[^*\n]+\*\*\s*$/.test(t) && t.includes(":")) return true
  // Wrapped scenario title, e.g. (🌡️ Phoenix: … (Research-Estimated))
  if (t.startsWith("(") && t.endsWith(")") && t.includes(":")) {
    if (/\p{Extended_Pictographic}/u.test(t)) return true
    if (/\b(Scenario|Research-Estimated|Research Estimated|Cooling Centers|Tree Canopy)\b/i.test(t)) return true
  }
  const hasEmoji = /\p{Extended_Pictographic}/u.test(t)
  const hasColon = /:/.test(t)
  if (!hasColon) return false
  if (
    hasEmoji &&
    /\b(Scenario|Research-Estimated|Research Estimated|Cooling Centers|Tree Canopy|Intervention|Estimated)\b/i.test(t)
  ) {
    return true
  }
  // "City: +N …" style title row (often with emoji at start)
  if (
    hasEmoji &&
    /^[\s(]*[\p{Extended_Pictographic}\s]+[A-Za-z][^:\n]{0,50}:\s*.+/u.test(t) &&
    /\+?\d+|Centers|Canopy|heat/i.test(t)
  ) {
    return true
  }
  return false
}

/** Remove leading scenario titles, emoji banners, and markdown headings until bullets/content. */
function stripLeadingScenarioNoise(text: string): string {
  let lines = text.split(/\r?\n/)
  let guard = 0
  while (guard++ < 30 && lines.length) {
    const line = lines[0].trim()
    if (!line) {
      lines.shift()
      continue
    }
    if (isBulletOrNumberedLine(line)) break
    if (looksLikeScenarioBannerLine(line)) {
      lines.shift()
      continue
    }
    break
  }
  return lines.join("\n")
}

/** Remove all emoji / pictographs so only text remains. */
function stripAllEmojis(text: string): string {
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\uFE0F/g, "")
    .replace(/  +/g, " ")
    .replace(/^ +/gm, "")
}

/** Remove intros, trailing junk, emojis, stray markdown, and extra blank lines. */
function sanitizeAssistantOutput(raw: string): string {
  let t = raw.trim()
  t = stripLeadingScenarioNoise(t)
  t = t.replace(/^Here's (?:the )?analysis for [^:\n]+:?\s*\n*/i, "")
  t = t.replace(/^Here is (?:the )?analysis for [^:\n]+:?\s*\n*/i, "")
  t = t.replace(/^Let me (?:break|walk) .+?:\s*\n*/i, "")
  t = t.replace(/^(?:Below|Above) (?:is|are) .+?:\s*\n*/i, "")
  t = t.replace(/^I've? (?:prepared|compiled|included) .+?:\s*\n*/i, "")
  t = t.replace(/^\*{0,2}Analysis\*{0,2}\s*\n*/i, "")
  t = t.replace(/(?:\n\s*---\s*)+$/g, "")
  t = t.replace(/(?:\n\s*[*_]{3,}\s*)+$/g, "")
  t = t.replace(/\n📌[\s\S]*$/u, "")
  t = t.replace(/\s*\*{1,3}\s*$/g, "")

  t = stripAllEmojis(t)
  t = stripLeadingScenarioNoise(t)

  const lines = t.split(/\r?\n/)
  while (lines.length) {
    const L = lines[lines.length - 1].trim()
    if (!L) {
      lines.pop()
      continue
    }
    if (/^(?:📌|🔖|💡|🗺️|📋)$/u.test(L)) {
      lines.pop()
      continue
    }
    const noEmoji = L.replace(/\p{Extended_Pictographic}/gu, "").replace(/\uFE0F/g, "").trim()
    if (noEmoji.length === 0) {
      lines.pop()
      continue
    }
    if (/^[\s*•.]+$/.test(L)) {
      lines.pop()
      continue
    }
    break
  }
  t = lines.join("\n")
  t = t.replace(/\s*\*+\s*$/g, "")
  t = t.replace(/\n{3,}/g, "\n\n").trim()
  return t
}

function markdownToAssistantHtml(src: string): string {
  const escaped = src
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
  let t = escaped
    .replace(/^## (.+)$/gm, '<h3 style="color:white;font-weight:700;font-size:14px;margin:10px 0 6px;">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 style="color:rgba(255,255,255,0.85);font-weight:600;font-size:13px;margin:8px 0 4px;">$1</h4>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:10px 0;"/>')
    .replace(/^\* (.+)$/gm, '<div style="display:flex;gap:8px;margin-bottom:6px;"><span style="color:#a3e635;flex-shrink:0;">•</span><span>$1</span></div>')
    .replace(/^(\d+)\. (.+)$/gm, '<div style="display:flex;gap:8px;margin-bottom:6px;"><span style="color:#a3e635;font-weight:700;flex-shrink:0;">$1.</span><span>$2</span></div>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:white;font-weight:600;">$1</strong>')
    .replace(/\*([^*]+?)\*/g, "<em>$1</em>")
  t = t.replace(/\n{3,}/g, "\n\n")
  t = t.replace(/\n/g, "<br/>")
  t = t.replace(/(?:<br\s*\/?>\s*){3,}/gi, "<br/><br/>")
  t = t.replace(/\*+$/g, "")
  t = t.replace(/(?:<br\s*\/?>\s*)+$/gi, "")
  return t
}

function AICopilotChat({ onSimResult }: { onSimResult: (result: SimResult) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollContentRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [suggestedFollowUps, setSuggestedFollowUps] = useState<string[]>([])
  const handleSend = async () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return
    setError(null)
    setInput("")
    setSuggestedFollowUps([])

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setIsStreaming(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || `Server returned ${res.status}`)
      }

      const data = await res.json()
      const reply: string = data.reply || "I encountered an issue processing your request."

      const { cleanReply, followUps } = extractSuggestedFollowUps(reply)
      const polished = sanitizeAssistantOutput(cleanReply)
      setSuggestedFollowUps(followUps.slice(0, 3).map(stripInlineMarkdownMarkers))
      const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: polished }
      setMessages((prev) => [...prev, assistantMsg])

      const cityMatch = cityHotspots.find((c) => reply.toLowerCase().includes(c.name.toLowerCase()))
      const scoreMatch = reply.match(/risk(?:\s+score)?[^\d]*(\d{1,3})%?/i) ?? reply.match(/(\d{1,3})%?\s+risk/i)
      if (cityMatch && scoreMatch) {
        const score = parseInt(scoreMatch[1])
        if (score >= 1 && score <= 100) onSimResult({ cityName: cityMatch.name, riskScore: score })
      }
    } catch (err: any) {
      console.error("[chat] Error:", err)
      setError("Unable to connect to AI service. Please try again later.")
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  useLayoutEffect(() => {
    const root = scrollRef.current
    const content = scrollContentRef.current
    if (!root) return

    const scrollToBottom = () => {
      root.scrollTop = root.scrollHeight
    }

    let innerRaf = 0
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(scrollToBottom)
    })

    let ro: ResizeObserver | undefined
    if (content && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        scrollToBottom()
      })
      ro.observe(content)
    }

    const t2 = window.setTimeout(scrollToBottom, 0)
    const t3 = window.setTimeout(scrollToBottom, 100)

    return () => {
      cancelAnimationFrame(outerRaf)
      cancelAnimationFrame(innerRaf)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      ro?.disconnect()
    }
  }, [messages, isStreaming, suggestedFollowUps])

  const suggestedPrompts = [
    "What if Phoenix adds 10 cooling centers?",
    "Compare flood risk for Miami vs Houston",
    "How to reduce Chicago heat deaths by 30%?",
  ]

  const hideScrollbar =
    "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex shrink-0 items-center gap-3 border-b border-white/10 bg-black/20 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-lime-400/20">
          <Sparkles className="h-4 w-4 text-lime-300" />
        </div>
        <div>
          <span className="text-sm font-semibold text-white">AI Copilot</span>
          <p className="text-[10px] text-neutral-500">City scenario planner</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-lime-400" />
          <span className="text-[10px] text-lime-300">Live</span>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={`min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain scroll-smooth ${hideScrollbar}`}
      >
        <div ref={scrollContentRef} className="space-y-4 p-4 pb-3">
          {error && (
            <div className="flex gap-2.5 justify-start">
              <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-red-400/20">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
              </div>
              <div className="max-w-[85%] rounded-2xl border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-sm text-red-400">{error}</div>
            </div>
          )}
          {messages.length === 0 && !error ? (
            <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 py-10 text-center">
              <Bot className="h-10 w-10 text-lime-300/30" />
              <p className="max-w-[200px] text-xs text-neutral-500">
                Ask about any city scenario — heat risk, floods, infrastructure, or resource planning.
              </p>
              <div className="flex w-full flex-col gap-2">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="rounded-lg border border-lime-300/20 px-3 py-2 text-left text-[11px] text-lime-300/70 transition-all hover:border-lime-300/40 hover:bg-lime-300/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && (
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-lime-400/20">
                    <Bot className="h-3.5 w-3.5 text-lime-300" />
                  </div>
                )}
                {msg.role === "assistant" ? (
                  <div
                    className="w-full min-w-0 max-w-full rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm leading-relaxed break-words text-white [&_*:last-child]:mb-0"
                    dangerouslySetInnerHTML={{ __html: markdownToAssistantHtml(msg.content) }}
                  />
                ) : (
                  <div className="max-w-[85%] rounded-2xl bg-lime-400 px-3.5 py-2.5 text-sm font-medium leading-relaxed break-words text-black">
                    {msg.content}
                  </div>
                )}
                {msg.role === "user" && (
                  <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-white/10">
                    <User className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
              </div>
            ))
          )}
          {isStreaming && messages[messages.length - 1]?.role !== "assistant" && (
            <div className="flex gap-2.5 justify-start">
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-lime-400/20">
                <Bot className="h-3.5 w-3.5 text-lime-300" />
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-3.5 py-2.5">
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-lime-300"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {suggestedFollowUps.length > 0 && !isStreaming && (
            <div className="flex flex-col gap-1.5 pt-1">
              {suggestedFollowUps.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInput(prompt)
                    setSuggestedFollowUps([])
                  }}
                  className="rounded-lg border border-lime-300/20 px-3 py-2 text-left text-[11px] text-lime-300/70 transition-all hover:border-lime-300/40 hover:bg-lime-300/10"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-black/20 px-3 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about any city scenario..."
            disabled={isStreaming}
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-3.5 py-2 text-xs text-white placeholder:text-neutral-500 transition-colors focus:border-lime-300/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={isStreaming || !input.trim()}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-lime-400 transition-colors hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Send message"
          >
            <Send className="h-3.5 w-3.5 text-black" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── City Detail Bar ─────────────────────────────────────────────────────────

function CityDetailBar({ cityId }: { cityId: number | null }) {
  if (!cityId) return null
  const city = cityHotspots.find((c) => c.id === cityId)
  if (!city) return null
  const cfg = riskConfig[city.type as keyof typeof riskConfig]
  return (
    <div className="mt-3 p-4 bg-white/5 rounded-xl border border-white/10 grid grid-cols-4 gap-3 text-center">
      <div>
        <AlertTriangle className="w-4 h-4 mx-auto mb-1" style={{ color: cfg.color }} />
        <div className="text-lg font-bold text-white">{city.risk}%</div>
        <div className="text-[10px] text-neutral-400">Risk Score</div>
      </div>
      <div>
        <Thermometer className="w-4 h-4 mx-auto mb-1 text-red-400" />
        <div className="text-lg font-bold text-white">{city.temp}°C</div>
        <div className="text-[10px] text-neutral-400">Peak Temp</div>
      </div>
      <div>
        <Wind className="w-4 h-4 mx-auto mb-1 text-blue-400" />
        <div className="text-lg font-bold text-white">{(city.pop / 1e6).toFixed(1)}M</div>
        <div className="text-[10px] text-neutral-400">Population</div>
      </div>
      <div>
        <Droplets className="w-4 h-4 mx-auto mb-1 text-cyan-400" />
        <div className="text-lg font-bold" style={{ color: cfg.color }}>{cfg.label}</div>
        <div className="text-[10px] text-neutral-400">Risk Level</div>
      </div>
    </div>
  )
}

// ─── Live Simulation Feed ─────────────────────────────────────────────────────

const riskBadgeStyle: Record<keyof typeof riskConfig, string> = {
  extreme: "bg-red-500/20 text-red-400 border-red-500/30",
  critical: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  high: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  medium: "bg-lime-500/20 text-lime-400 border-lime-500/30",
}

function LiveSimulationFeed() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [newIds, setNewIds] = useState<Set<number>>(new Set())
  const prevCitiesRef = useRef<Set<string>>(new Set())

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/history")
      if (!res.ok) {
        console.warn("[v0] History fetch returned", res.status)
        return
      }
      const data: HistoryItem[] = await res.json()

      setItems((prev) => {
        const incoming = new Set(data.map((d) => d.cityName + d.riskScore))
        const prevNames = prevCitiesRef.current
        const brandNew = data.filter((d) => !prevNames.has(d.cityName + d.riskScore))
        if (brandNew.length > 0) {
          setNewIds(new Set(brandNew.map((_, i) => i)))
          setTimeout(() => setNewIds(new Set()), 800)
        }
        prevCitiesRef.current = incoming
        return data
      })
    } catch (err) {
      console.warn("[v0] History fetch error:", err instanceof Error ? err.message : err)
      // silently ignore network errors in feed — will retry on next poll
    }
  }, [])

  useEffect(() => {
    fetchHistory()
    const id = setInterval(fetchHistory, 10000)
    return () => clearInterval(id)
  }, [fetchHistory])

  return (
    <div className="liquid-glass flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-white/10">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-black/20 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-blue-400/20 flex items-center justify-center">
          <Activity className="w-4 h-4 text-blue-300" />
        </div>
        <div>
          <span className="text-sm font-semibold text-white">Live Simulation Feed</span>
          <p className="text-[10px] text-neutral-500">Refreshes every 10s</p>
        </div>
        <div className="ml-auto">
          <span className="text-[9px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-full px-2 py-0.5">
            Powered by Palantir Ontology
          </span>
        </div>
      </div>

      {/* Feed list */}
      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
            <Activity className="w-8 h-8 text-neutral-600" />
            <p className="text-neutral-500 text-xs">Loading simulation history...</p>
          </div>
        ) : (
          items.map((item, i) => {
            const cfg = riskConfig[item.riskLevel]
            const isNew = newIds.has(i)
            return (
              <div
                key={`${item.cityName}-${item.riskScore}-${i}`}
                className="px-4 py-3 hover:bg-white/5 transition-colors"
                style={isNew ? { animation: "slideInFromTop 0.4s ease-out" } : undefined}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3 h-3 text-neutral-400 flex-shrink-0" />
                    <span className="text-sm font-semibold text-white">{item.cityName}</span>
                  </div>
                  <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${riskBadgeStyle[item.riskLevel]}`}>
                    {item.riskScore}
                  </span>
                </div>
                <p className="text-[11px] text-neutral-400 leading-relaxed line-clamp-2 pl-5 mb-1">{item.explanation}</p>
                <p className="text-[10px] text-neutral-600 pl-5">{item.timeAgo}</p>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─── Intervention Plan ────────────────────────────────────────────────────────

const PRIORITY_OPTIONS = [
  "Reduce Heat Risk",
  "Improve Air Quality",
  "Expand Healthcare Access",
  "Upgrade Infrastructure",
  "Support Vulnerable Populations",
]

const TIMELINE_OPTIONS = [
  { label: "6 Months", value: 6 },
  { label: "1 Year", value: 12 },
  { label: "5 Years", value: 60 },
]

function parsePlan(raw: string): { projectedScore: number | null; body: string } {
  const scoreMatch = raw.match(/\*\*PROJECTED_SCORE:(\d+)\*\*/)
  const projectedScore = scoreMatch ? parseInt(scoreMatch[1]) : null
  const body = raw.replace(/\*\*PROJECTED_SCORE:\d+\*\*\n?/, "")
  return { projectedScore, body }
}

function InterventionPlan({ simResult }: { simResult: SimResult | null }) {
  const [budget, setBudget] = useState(50)
  const [timeline, setTimeline] = useState(12)
  const [priorities, setPriorities] = useState<string[]>(["Reduce Heat Risk", "Support Vulnerable Populations"])
  const [loading, setLoading] = useState(false)
  const [planRaw, setPlanRaw] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!simResult) return null

  const togglePriority = (p: string) => {
    setPriorities((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p])
  }

  const handleGenerate = async () => {
    if (priorities.length === 0) { setError("Select at least one priority."); return }
    setLoading(true)
    setError(null)
    setPlanRaw(null)
    try {
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cityName: simResult.cityName,
          currentRiskScore: simResult.riskScore,
          budget,
          timeline,
          priorities: priorities.join(", "),
        }),
      })
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        setError(errorData.error || `Plan generation failed (${res.status})`)
        return
      }
      const data = await res.json()
      if (!data.plan) {
        setError("No plan was generated. Please try again.")
        return
      }
      setPlanRaw(data.plan)
    } catch (err) {
      console.error("[v0] Plan generation error:", err)
      setError("Failed to connect to plan service. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const { projectedScore, body } = planRaw ? parsePlan(planRaw) : { projectedScore: null, body: "" }
  const projLevel = projectedScore !== null ? scoreToLevel(projectedScore) : null

  // Format body: parse ## headings, numbered lists, bold
  const formatBody = (text: string) =>
    text
      .replace(/^## (.+)$/gm, '<h3 class="text-white font-bold text-base mt-4 mb-2">$1</h3>')
      .replace(/^### (.+)$/gm, '<h4 class="text-white/80 font-semibold text-sm mt-3 mb-1.5">$1</h4>')
      .replace(/^\d+\.\s+(.+)$/gm, '<div class="flex gap-2 text-sm text-neutral-300 leading-relaxed mb-2"><span class="text-lime-400 font-bold flex-shrink-0">•</span><span>$1</span></div>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>')
      .replace(/\n{2,}/g, '<br/>')

  return (
    <ScrollReveal delay={100} className="mt-10 w-full">
      <div className="w-full liquid-glass rounded-2xl border border-white/10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10 bg-black/20">
          <div className="w-9 h-9 rounded-xl bg-lime-400/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-lime-300" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Build Intervention Plan</h3>
            <p className="text-[11px] text-neutral-500">
              Based on simulation result for <span className="text-lime-300 font-semibold">{simResult.cityName}</span> — risk score{" "}
              <span className="text-white font-semibold">{simResult.riskScore}</span>
            </p>
          </div>
        </div>

        <div className="p-6 grid lg:grid-cols-[1fr_1.4fr] gap-8">
          {/* Controls */}
          <div className="space-y-6">
            {/* Budget slider */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold text-white">Budget</label>
                <span className="text-lime-300 font-bold text-sm">${budget}M</span>
              </div>
              <input
                type="range" min={1} max={500} step={1} value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-lime-400"
                style={{ background: `linear-gradient(to right, #a3e635 0%, #a3e635 ${(budget / 500) * 100}%, rgba(255,255,255,0.1) ${(budget / 500) * 100}%, rgba(255,255,255,0.1) 100%)` }}
              />
              <div className="flex justify-between text-[10px] text-neutral-600 mt-1">
                <span>$1M</span><span>$500M</span>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <label className="text-sm font-semibold text-white block mb-2">Timeline</label>
              <div className="flex gap-2">
                {TIMELINE_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTimeline(t.value)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${timeline === t.value ? "bg-lime-400 text-black border-lime-400" : "bg-white/5 text-neutral-300 border-white/10 hover:bg-white/10"}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Priorities */}
            <div>
              <label className="text-sm font-semibold text-white block mb-2">Priorities</label>
              <div className="space-y-2">
                {PRIORITY_OPTIONS.map((p) => {
                  const checked = priorities.includes(p)
                  return (
                    <button
                      key={p}
                      onClick={() => togglePriority(p)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all text-xs ${checked ? "bg-lime-400/10 border-lime-400/30 text-white" : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/8"}`}
                    >
                      {checked
                        ? <CheckSquare className="w-3.5 h-3.5 text-lime-400 flex-shrink-0" />
                        : <Square className="w-3.5 h-3.5 text-neutral-600 flex-shrink-0" />}
                      {p}
                    </button>
                  )
                })}
              </div>
            </div>

            {error && <p className="text-red-400 text-xs">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-lime-400 text-black font-bold rounded-xl py-3 text-sm hover:bg-lime-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  Generating Plan...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate Plan
                </>
              )}
            </button>
          </div>

          {/* Plan output */}
          <div className="bg-black/30 rounded-xl border border-white/10 overflow-hidden flex flex-col">
            {!planRaw && !loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12 text-center px-6">
                <FileText className="w-10 h-10 text-neutral-700" />
                <p className="text-neutral-500 text-sm">Configure the parameters on the left and click <strong className="text-neutral-300">Generate Plan</strong> to produce a roadmap.</p>
              </div>
            ) : loading ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-12">
                <div className="w-8 h-8 border-2 border-lime-400/30 border-t-lime-400 rounded-full animate-spin" />
                <p className="text-neutral-500 text-xs">Generating roadmap...</p>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-5">
                {/* Title */}
                <h3 className="text-lg font-extrabold text-white mb-1">{simResult.cityName} Intervention Roadmap</h3>

                {/* Projected score */}
                {projectedScore !== null && projLevel && (
                  <div className="flex items-center gap-3 mb-4 p-3 bg-white/5 rounded-xl border border-white/10">
                    <div>
                      <p className="text-[10px] text-neutral-500 mb-0.5">Projected Risk Score</p>
                      <span className="text-4xl font-extrabold" style={{ color: riskConfig[projLevel].color }}>{projectedScore}</span>
                    </div>
                    <div className="ml-auto flex flex-col items-end gap-1">
                      <span className={`text-xs font-semibold border rounded-full px-2.5 py-0.5 ${riskBadgeStyle[projLevel]}`}>{riskConfig[projLevel].label}</span>
                      {projectedScore < simResult.riskScore && (
                        <div className="flex items-center gap-1 text-green-400 text-xs">
                          <ArrowDown className="w-3.5 h-3.5" />
                          <span>−{simResult.riskScore - projectedScore} pts</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Body */}
                <div
                  className="text-sm text-neutral-300 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatBody(body) }}
                />

                {/* Palantir badge */}
                <div className="mt-5 flex justify-end">
                  <span className="text-[9px] font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-full px-2.5 py-1">
                    Powered by Palantir AIP
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ScrollReveal>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function SimulationPreview() {
  const [selectedCity, setSelectedCity] = useState<number | null>(null)
  const [mapMounted, setMapMounted] = useState(false)
  const [simResult, setSimResult] = useState<SimResult | null>(null)
  const [markerUpdate, setMarkerUpdate] = useState<MarkerUpdate | null>(null)
  const sectionRef = useRef<HTMLElement>(null)

  // Auto-load map when section scrolls into view
  useEffect(() => {
    if (mapMounted) return
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setMapMounted(true)
          observer.disconnect()
        }
      },
      { threshold: 0.15 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [mapMounted])

  const handleSimResult = useCallback((result: SimResult) => {
    setSimResult(result)
    const city = cityHotspots.find((c) => c.name === result.cityName)
    if (city) {
      const newLevel = scoreToLevel(result.riskScore)
      // Extract a top factor by inspecting which priorities stand out
      const topFactor =
        result.riskScore >= 75
          ? "Extreme heat and limited cooling infrastructure are the top contributing factors."
          : result.riskScore >= 55
            ? "Urban heat island effect and vulnerable population density are key risk drivers."
            : "Moderate climate exposure with manageable infrastructure gaps identified."
      setMarkerUpdate({ cityId: city.id, prevScore: city.risk, newScore: result.riskScore, riskLevel: newLevel, topFactor })
    }
  }, [])

  return (
    <section ref={sectionRef} id="simulation" className="py-16 sm:py-24 relative overflow-hidden">
      <style>{`
        @keyframes slideInFromTop {
          from { opacity: 0; transform: translateY(-12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div className="absolute inset-0 particle-bg opacity-30" />
      <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-lime-400/5 rounded-full blur-3xl" />

      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <ScrollReveal className="text-center mb-12">
          <p className="text-[11px] tracking-widest text-lime-300/80 mb-2">LIVE SIMULATION</p>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
            Explore cities. Ask the <span className="text-lime-300">AI Copilot</span>.
          </h2>
          <p className="text-neutral-400 max-w-2xl mx-auto">
            Click any city on the map to inspect its risk profile, then ask the AI Copilot to simulate interventions and project outcomes.
          </p>
        </ScrollReveal>

        {/* Map + Chat + Live Feed */}
        <ScrollReveal delay={100}>
          <div className="w-full">
            <div className="grid min-h-0 grid-cols-1 items-stretch gap-5 min-w-0 lg:grid-cols-[1fr_500px_280px]">
              {/* Shared max height keeps row aligned; min-h-0 lets overflow scroll inside cells */}
              {/* Left: Leaflet Map */}
              <div className="liquid-glass flex h-full min-h-[480px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 lg:min-h-0 lg:h-[min(680px,78vh)] lg:max-h-[78vh]">
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-black/20 flex-shrink-0">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-lime-300" />
                    US City Heat Risk Map
                  </h3>
                  <div className="flex items-center gap-3 text-[10px] text-neutral-400">
                    {Object.entries(riskConfig).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-1">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: val.color }} />
                        <span>{val.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="relative flex-1 min-h-0">
                  {!mapMounted && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 z-10">
                      <div className="w-8 h-8 border-2 border-lime-400/30 border-t-lime-400 rounded-full animate-spin" />
                      <p className="text-sm text-neutral-400">Loading interactive map...</p>
                    </div>
                  )}
                  {mapMounted && (
                    <CityMap
                      selected={selectedCity}
                      onSelect={setSelectedCity}
                      markerUpdate={markerUpdate}
                      onDismissCard={() => setMarkerUpdate(null)}
                    />
                  )}
                </div>

                <div className="px-5 pb-4">
                  {selectedCity ? (
                    <CityDetailBar cityId={selectedCity} />
                  ) : (
                    <p className="text-[11px] text-neutral-500 text-center py-3">
                      Click a marker to inspect city risk details
                    </p>
                  )}
                </div>
              </div>

              {/* Middle: AI Copilot Chat */}
              <div className="liquid-glass flex h-full min-h-[480px] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 lg:min-h-0 lg:h-[min(680px,78vh)] lg:max-h-[78vh]">
                <AICopilotChat onSimResult={handleSimResult} />
              </div>

              {/* Right: Live Simulation Feed */}
              <div className="hidden h-full min-h-0 w-full min-w-0 flex-col overflow-hidden lg:flex lg:h-[min(680px,78vh)] lg:max-h-[78vh]">
                <LiveSimulationFeed />
              </div>
            </div>

            {/* Live Feed on mobile (below the grid) */}
            <div className="lg:hidden mt-5">
              <LiveSimulationFeed />
            </div>
          </div>
        </ScrollReveal>

        {/* Intervention Plan — appears after a sim result */}
        <InterventionPlan simResult={simResult} />

        {/* Project Impact */}
        <ScrollReveal delay={150} className="mt-20 w-full">
          <div className="text-center mb-12">
            <p className="text-[11px] tracking-widest text-lime-300/80 mb-2">PROJECT IMPACT</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              What this platform can <span className="text-lime-300">change</span>
            </h2>
            <p className="text-neutral-400 max-w-2xl mx-auto">
              Projections derived from simulation modelling and peer-reviewed urban planning research. Numbers will be validated through pilot programs.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
            {impactMetrics.map((metric, index) => (
              <ScrollReveal key={metric.label} delay={index * 100}>
                <div className={`liquid-glass rounded-2xl p-6 h-full border ${metric.borderColor} glass-card-interactive group`}>
                  <div className={`w-12 h-12 rounded-xl ${metric.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <metric.icon className={`w-6 h-6 ${metric.color}`} />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-4xl font-bold ${metric.color}`}>
                      <AnimatedCounter end={metric.value} suffix={metric.suffix} duration={2000 + index * 200} />
                    </span>
                    {metric.direction === "down"
                      ? <ArrowDown className="w-5 h-5 text-green-400" />
                      : <ArrowUp className="w-5 h-5 text-blue-400" />}
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2">{metric.label}</h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">{metric.description}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p className="text-xs text-neutral-600 max-w-xl mx-auto">
              These projections are based on simulation models and may vary depending on city-specific conditions, implementation strategies, and local factors. Actual results will be validated through pilot programs.
            </p>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
