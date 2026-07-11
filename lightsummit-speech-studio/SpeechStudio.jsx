import { useState, useEffect, useRef } from "react";

// ————————————————————————————————————————————————
// LIGHTSUMMIT SPEECH STUDIO
// Mono system: ink on paper. Georgia for the spoken word,
// Helvetica caps for the chrome. One signature element:
// the full-bleed teleprompter.
// ————————————————————————————————————————————————

const INK = "#111111";
const PAPER = "#FAFAF8";
const GRAPHITE = "#5a5a56";
const HAIRLINE = "#d9d9d4";

const CHROME = { fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' };
const MANUSCRIPT = { fontFamily: 'Georgia, "Times New Roman", serif' };

const TONES = [
  { id: "authority", label: "Authority", brief: "measured, declarative, zero hype — a Managing Director stating what is true" },
  { id: "host", label: "Warm host", brief: "welcoming, energised, human — opening the room and setting people at ease" },
  { id: "urgent", label: "Urgent", brief: "direct, momentum, a clear call to action — the clock is part of the message" },
];

const WPM = 130; // spoken pace baseline

function wordCount(text) {
  return (text.trim().match(/\S+/g) || []).length;
}

function fmtSecs(totalSec) {
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function splitSentences(text) {
  return text.match(/[^.!?]+[.!?]+["')\]]*|\S[^.!?]*$/g) || [text];
}

// ———————————————— Teleprompter ————————————————

function Prompter({ script, minutes, onExit }) {
  const scrollRef = useRef(null);
  const rafRef = useRef(null);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [fontPx, setFontPx] = useState(30);
  const speedRef = useRef(1);
  speedRef.current = speed;

  useEffect(() => {
    if (!running) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const words = wordCount(script);
    const baseDurationSec = (words / WPM) * 60 || 60;
    let last = performance.now();
    const step = (now) => {
      const dt = (now - last) / 1000;
      last = now;
      const total = el.scrollHeight - el.clientHeight;
      if (total <= 0) return;
      const pxPerSec = (total / baseDurationSec) * speedRef.current;
      el.scrollTop += pxPerSec * dt;
      if (el.scrollTop >= total - 1) {
        setRunning(false);
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
  }, [running, script]);

  const paras = script.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: INK, color: PAPER }}>
      <div
        ref={scrollRef}
        onClick={() => setRunning((r) => !r)}
        className="flex-1 overflow-y-auto px-6 py-16 cursor-pointer"
      >
        <div className="mx-auto" style={{ maxWidth: "42rem" }}>
          <div style={{ height: "35vh" }} />
          {paras.map((p, i) => (
            <p
              key={i}
              style={{ ...MANUSCRIPT, fontSize: fontPx, lineHeight: 1.55, marginBottom: "1.4em", opacity: p.trim().toLowerCase() === "[pause]" ? 0.35 : 1 }}
            >
              {p.trim().toLowerCase() === "[pause]" ? "— pause —" : p}
            </p>
          ))}
          <div style={{ height: "55vh" }} />
        </div>
      </div>
      <div className="flex items-center justify-between px-4 py-3 gap-2" style={{ borderTop: `1px solid ${GRAPHITE}`, ...CHROME }}>
        <button onClick={onExit} className="px-3 py-2 text-xs uppercase tracking-widest" style={{ color: PAPER, border: `1px solid ${GRAPHITE}` }}>
          Exit
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => setFontPx((f) => Math.max(20, f - 4))} className="px-3 py-2 text-xs" style={{ color: PAPER, border: `1px solid ${GRAPHITE}` }} aria-label="Smaller text">A−</button>
          <button onClick={() => setFontPx((f) => Math.min(54, f + 4))} className="px-3 py-2 text-xs" style={{ color: PAPER, border: `1px solid ${GRAPHITE}` }} aria-label="Larger text">A+</button>
          <button onClick={() => setSpeed((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))} className="px-3 py-2 text-xs" style={{ color: PAPER, border: `1px solid ${GRAPHITE}` }} aria-label="Slower">−</button>
          <span className="text-xs tabular-nums" style={{ minWidth: "3ch", textAlign: "center" }}>{speed.toFixed(2)}×</span>
          <button onClick={() => setSpeed((s) => Math.min(2, +(s + 0.25).toFixed(2)))} className="px-3 py-2 text-xs" style={{ color: PAPER, border: `1px solid ${GRAPHITE}` }} aria-label="Faster">+</button>
        </div>
        <button
          onClick={() => setRunning((r) => !r)}
          className="px-4 py-2 text-xs uppercase tracking-widest font-medium"
          style={{ background: PAPER, color: INK }}
        >
          {running ? "Pause" : "Roll"}
        </button>
      </div>
    </div>
  );
}

// ———————————————— Main ————————————————

export default function SpeechStudio() {
  const [brief, setBrief] = useState({
    eventName: "",
    audience: "",
    speaker: "Baz Davies, Managing Director, Lightsummit",
    minutes: 2,
    tone: "authority",
    points: "",
    handoff: "",
  });
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState("");
  const [rate, setRate] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [prompter, setPrompter] = useState(false);
  const [saved, setSaved] = useState([]);
  const [copied, setCopied] = useState(false);
  const [saveNote, setSaveNote] = useState("");
  const cancelSpeech = useRef(false);
  const synthOk = typeof window !== "undefined" && "speechSynthesis" in window;

  // Load device voices (async on iOS)
  useEffect(() => {
    if (!synthOk) return;
    const load = () => {
      const v = window.speechSynthesis.getVoices() || [];
      if (!v.length) return;
      const rank = (x) => (x.lang && x.lang.startsWith("en-GB") ? 0 : x.lang && x.lang.startsWith("en") ? 1 : 2);
      const sorted = [...v].sort((a, b) => rank(a) - rank(b));
      setVoices(sorted);
      setVoiceURI((cur) => cur || (sorted[0] && sorted[0].voiceURI) || "");
    };
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", load);
      window.speechSynthesis.cancel();
    };
  }, [synthOk]);

  // Load archive
  useEffect(() => {
    (async () => {
      try {
        const res = await window.storage.get("lightsummit-speeches");
        if (res && res.value) setSaved(JSON.parse(res.value));
      } catch (e) {
        /* nothing saved yet */
      }
    })();
  }, []);

  const set = (k) => (e) => setBrief((b) => ({ ...b, [k]: e.target.value }));

  const generate = async () => {
    setError("");
    if (!brief.eventName.trim() || !brief.points.trim()) {
      setError("Name the event and give at least one point to land. The script is only as good as the brief.");
      return;
    }
    setGenerating(true);
    const tone = TONES.find((t) => t.id === brief.tone) || TONES[0];
    const target = Math.round(brief.minutes * WPM);
    const prompt = `Write a script to be spoken aloud at the front of a live event. Write for the ear: short sentences, plain words, natural rhythm. No headings, no bullet points, no stage directions. You may place [pause] on its own line, at most three times, where a beat of silence earns its keep.

Speaker: ${brief.speaker}
Event: ${brief.eventName}
Audience: ${brief.audience || "mixed commercial audience"}
Tone: ${tone.brief}
Length: approximately ${target} words (${brief.minutes} minute${brief.minutes > 1 ? "s" : ""} at speaking pace) — do not exceed this
Points to land, woven into the speaker's voice rather than listed: ${brief.points}
${brief.handoff.trim() ? `Close by handing off to / introducing: ${brief.handoff}` : "Close cleanly with a single memorable line. No handoff."}

Hard rules: the first two sentences must hook — a concrete number, a sharp claim, or a question. One idea per beat. British English. No clichés ("without further ado", "at the end of the day", "journey"). No exaggeration; understatement carries authority. Return ONLY the script text, separated into short paragraphs.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await response.json();
      const text = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (!text) throw new Error("Empty response");
      setScript(text);
      setTitle(brief.eventName);
    } catch (e) {
      setError("Generation failed. Check the connection and run it again.");
    } finally {
      setGenerating(false);
    }
  };

  const play = () => {
    if (!synthOk) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    cancelSpeech.current = false;
    const clean = script.replace(/\[pause\]/gi, " . . . ");
    const chunks = splitSentences(clean).map((c) => c.trim()).filter(Boolean);
    const voice = voices.find((v) => v.voiceURI === voiceURI);
    let i = 0;
    const next = () => {
      if (cancelSpeech.current || i >= chunks.length) {
        setSpeaking(false);
        return;
      }
      const u = new SpeechSynthesisUtterance(chunks[i]);
      if (voice) u.voice = voice;
      u.rate = rate;
      u.onend = () => {
        i += 1;
        next();
      };
      u.onerror = () => {
        i += 1;
        next();
      };
      synth.speak(u);
    };
    setSpeaking(true);
    next();
  };

  const stop = () => {
    cancelSpeech.current = true;
    if (synthOk) window.speechSynthesis.cancel();
    setSpeaking(false);
  };

  const saveScript = async () => {
    const entry = {
      id: Date.now().toString(36),
      title: title.trim() || brief.eventName || "Untitled",
      script,
      brief,
      ts: Date.now(),
    };
    const list = [entry, ...saved].slice(0, 20);
    setSaved(list);
    try {
      await window.storage.set("lightsummit-speeches", JSON.stringify(list));
      setSaveNote("Saved to archive");
      setTimeout(() => setSaveNote(""), 1600);
    } catch (e) {
      setError("Save failed — the script is still on screen; copy it out.");
    }
  };

  const loadEntry = (entry) => {
    stop();
    setScript(entry.script);
    setTitle(entry.title);
    setBrief(entry.brief);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteEntry = async (id) => {
    const list = saved.filter((s) => s.id !== id);
    setSaved(list);
    try {
      await window.storage.set("lightsummit-speeches", JSON.stringify(list));
    } catch (e) {
      /* non-fatal */
    }
  };

  const copyScript = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch (e) {
      setError("Copy blocked by the browser — select the text and copy manually.");
    }
  };

  const downloadScript = () => {
    const blob = new Blob([`${title || "Speech"}\n\n${script}`], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${(title || "speech").replace(/\s+/g, "-").toLowerCase()}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const words = wordCount(script);
  const estSec = words > 0 ? (words / (WPM * rate)) * 60 : 0;
  const targetSec = brief.minutes * 60;
  const ratio = targetSec > 0 ? Math.min(estSec / targetSec, 1.5) : 0;
  const over = estSec > targetSec * 1.08;

  const label = "block text-xs uppercase tracking-widest mb-2";
  const field = "w-full px-3 py-3 text-base outline-none";
  const fieldStyle = { background: "#FFFFFF", border: `1px solid ${INK}`, color: INK, ...MANUSCRIPT };

  return (
    <div className="min-h-screen" style={{ background: PAPER, color: INK, ...CHROME }}>
      {prompter && <Prompter script={script} minutes={brief.minutes} onExit={() => setPrompter(false)} />}

      <div className="mx-auto px-5 pb-24 pt-10" style={{ maxWidth: "44rem" }}>
        {/* Masthead */}
        <header className="mb-10">
          <div className="text-xs uppercase tracking-widest" style={{ color: GRAPHITE }}>Lightsummit</div>
          <h1 className="mt-1 text-3xl font-bold uppercase" style={{ letterSpacing: "0.04em" }}>Speech Studio</h1>
          <div className="mt-3" style={{ height: 2, background: INK }} />
          <p className="mt-3 text-sm" style={{ color: GRAPHITE, ...MANUSCRIPT, fontStyle: "italic" }}>
            Brief in. Script out. Rehearse it, time it, read it off the glass.
          </p>
        </header>

        {/* — BRIEF — */}
        <section className="mb-12">
          <div className="flex items-baseline justify-between mb-5">
            <h2 className="text-xs uppercase tracking-widest font-bold">Brief</h2>
            <span className="text-xs tabular-nums" style={{ color: GRAPHITE }}>~{Math.round(brief.minutes * WPM)} words at pace</span>
          </div>

          <div className="mb-4">
            <label className={label} style={{ color: GRAPHITE }}>Event</label>
            <input className={field} style={fieldStyle} value={brief.eventName} onChange={set("eventName")} placeholder="e.g. Yorkshire textiles energy briefing" />
          </div>

          <div className="mb-4">
            <label className={label} style={{ color: GRAPHITE }}>Audience</label>
            <input className={field} style={fieldStyle} value={brief.audience} onChange={set("audience")} placeholder="Who is in the room" />
          </div>

          <div className="mb-4">
            <label className={label} style={{ color: GRAPHITE }}>Points to land</label>
            <textarea className={field} style={{ ...fieldStyle, minHeight: "6rem", resize: "vertical" }} value={brief.points} onChange={set("points")} placeholder="One per line. Numbers beat adjectives." />
          </div>

          <div className="mb-4">
            <label className={label} style={{ color: GRAPHITE }}>Handoff / introduce (optional)</label>
            <input className={field} style={fieldStyle} value={brief.handoff} onChange={set("handoff")} placeholder="e.g. hand to Dom McNally" />
          </div>

          <div className="mb-4">
            <label className={label} style={{ color: GRAPHITE }}>Speaker</label>
            <input className={field} style={fieldStyle} value={brief.speaker} onChange={set("speaker")} />
          </div>

          <div className="flex flex-wrap gap-6 mb-6">
            <div>
              <label className={label} style={{ color: GRAPHITE }}>Length</label>
              <div className="flex items-center" style={{ border: `1px solid ${INK}` }}>
                <button onClick={() => setBrief((b) => ({ ...b, minutes: Math.max(1, b.minutes - 1) }))} className="px-4 py-3 text-lg" aria-label="Shorter">−</button>
                <span className="px-3 tabular-nums text-base font-medium" style={{ minWidth: "6.5ch", textAlign: "center" }}>{brief.minutes} min</span>
                <button onClick={() => setBrief((b) => ({ ...b, minutes: Math.min(4, b.minutes + 1) }))} className="px-4 py-3 text-lg" aria-label="Longer">+</button>
              </div>
            </div>
            <div className="flex-1" style={{ minWidth: "12rem" }}>
              <label className={label} style={{ color: GRAPHITE }}>Register</label>
              <div className="flex" style={{ border: `1px solid ${INK}` }}>
                {TONES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setBrief((b) => ({ ...b, tone: t.id }))}
                    className="flex-1 px-2 py-3 text-xs uppercase tracking-wider"
                    style={brief.tone === t.id ? { background: INK, color: PAPER } : { color: GRAPHITE }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            onClick={generate}
            disabled={generating}
            className="w-full py-4 text-sm uppercase tracking-widest font-bold"
            style={{ background: generating ? GRAPHITE : INK, color: PAPER }}
          >
            {generating ? "Writing…" : "Write the script"}
          </button>
          {error && (
            <p className="mt-3 text-sm" style={{ color: INK, ...MANUSCRIPT }}>{error}</p>
          )}
        </section>

        {/* — SCRIPT — */}
        {script && (
          <section className="mb-12">
            <div style={{ height: 1, background: INK }} className="mb-6" />
            <div className="flex items-baseline justify-between mb-5">
              <h2 className="text-xs uppercase tracking-widest font-bold">Script</h2>
              <span className="text-xs tabular-nums" style={{ color: over ? INK : GRAPHITE, fontWeight: over ? 700 : 400 }}>
                {words} words · {fmtSecs(estSec)} of {fmtSecs(targetSec)}{over ? " — over" : ""}
              </span>
            </div>

            {/* Timing meter */}
            <div className="mb-5" style={{ height: 4, background: HAIRLINE, position: "relative" }}>
              <div style={{ height: 4, width: `${Math.min(ratio * 100, 100)}%`, background: INK, transition: "width 200ms" }} />
              <div style={{ position: "absolute", top: -3, left: `${(1 / 1.08) * 100 * 0}%` }} />
            </div>

            <input
              className="w-full px-3 py-2 mb-3 text-lg font-bold outline-none"
              style={{ background: "transparent", borderBottom: `1px solid ${HAIRLINE}`, color: INK }}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
            />

            <textarea
              className="w-full px-4 py-4 outline-none"
              style={{ ...fieldStyle, minHeight: "20rem", resize: "vertical", fontSize: "1.05rem", lineHeight: 1.7 }}
              value={script}
              onChange={(e) => setScript(e.target.value)}
            />

            {/* — DELIVERY — */}
            <h2 className="text-xs uppercase tracking-widest font-bold mt-8 mb-4">Delivery</h2>

            {synthOk ? (
              <div className="mb-5">
                <label className={label} style={{ color: GRAPHITE }}>Rehearsal voice (from this device)</label>
                <select className={field} style={{ ...fieldStyle, fontFamily: CHROME.fontFamily, fontSize: "0.9rem" }} value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)}>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
                <div className="flex items-center gap-3 mt-3">
                  <span className="text-xs uppercase tracking-widest" style={{ color: GRAPHITE }}>Pace</span>
                  <input type="range" min="0.8" max="1.2" step="0.05" value={rate} onChange={(e) => setRate(parseFloat(e.target.value))} className="flex-1" />
                  <span className="text-xs tabular-nums" style={{ minWidth: "4ch" }}>{rate.toFixed(2)}×</span>
                </div>
              </div>
            ) : (
              <p className="mb-5 text-sm" style={{ color: GRAPHITE, ...MANUSCRIPT }}>
                Voice playback isn't available in this view — the teleprompter and export still work.
              </p>
            )}

            <div className="grid grid-cols-2 gap-2">
              {synthOk && (
                <button onClick={speaking ? stop : play} className="py-3 text-xs uppercase tracking-widest font-bold" style={{ background: INK, color: PAPER }}>
                  {speaking ? "Stop" : "Hear it"}
                </button>
              )}
              <button onClick={() => { stop(); setPrompter(true); }} className="py-3 text-xs uppercase tracking-widest font-bold" style={{ border: `1px solid ${INK}`, color: INK }}>
                Teleprompter
              </button>
              <button onClick={copyScript} className="py-3 text-xs uppercase tracking-widest" style={{ border: `1px solid ${INK}`, color: INK }}>
                {copied ? "Copied" : "Copy"}
              </button>
              <button onClick={downloadScript} className="py-3 text-xs uppercase tracking-widest" style={{ border: `1px solid ${INK}`, color: INK }}>
                Download .txt
              </button>
              <button onClick={saveScript} className="py-3 text-xs uppercase tracking-widest col-span-2" style={{ border: `1px solid ${INK}`, color: INK }}>
                {saveNote || "Save to archive"}
              </button>
            </div>

            <p className="mt-5 text-sm" style={{ color: GRAPHITE, ...MANUSCRIPT }}>
              The rehearsal voice is your device's own — good for timing and cadence, not for playing to a room. For a finished audio file: record yourself reading it off the teleprompter, or run the exported script through a broadcast-grade TTS voice.
            </p>
          </section>
        )}

        {/* — ARCHIVE — */}
        {saved.length > 0 && (
          <section>
            <div style={{ height: 1, background: INK }} className="mb-6" />
            <h2 className="text-xs uppercase tracking-widest font-bold mb-4">Archive</h2>
            {saved.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
                <button onClick={() => loadEntry(s)} className="text-left flex-1 pr-3">
                  <div className="text-sm font-medium">{s.title}</div>
                  <div className="text-xs tabular-nums" style={{ color: GRAPHITE }}>
                    {new Date(s.ts).toLocaleDateString("en-GB")} · {wordCount(s.script)} words
                  </div>
                </button>
                <button onClick={() => deleteEntry(s.id)} className="text-xs uppercase tracking-widest px-2 py-1" style={{ color: GRAPHITE }} aria-label={`Delete ${s.title}`}>
                  ×
                </button>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
