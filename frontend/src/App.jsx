import { useState, useRef } from "react";

// ── Config ──────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

// ── Helpers ─────────────────────────────────────────────────────────────────
const scoreColor = (s) =>
  s >= 7 ? "#22c55e" : s >= 4 ? "#f59e0b" : "#ef4444";

const scoreBg = (s) =>
  s >= 7 ? "#f0fdf4" : s >= 4 ? "#fffbeb" : "#fef2f2";

const scoreLabel = (s) =>
  s >= 7 ? "Strong" : s >= 4 ? "Needs Work" : "Critical Gap";

const gradeColor = { A: "#22c55e", B: "#84cc16", C: "#f59e0b", D: "#f97316", F: "#ef4444" };

const timelineColor = {
  "This week":      { bg: "#dbeafe", text: "#1d4ed8" },
  "This month":     { bg: "#fef3c7", text: "#92400e" },
  "Next 3 months":  { bg: "#ede9fe", text: "#6d28d9" },
};

// ── Gauge Component ──────────────────────────────────────────────────────────
function Gauge({ score, size = 120 }) {
  const r   = (size / 2) * 0.8;
  const cx  = size / 2;
  const cy  = size / 2;
  const circ = Math.PI * r; // half circle
  const pct  = (score / 10) * circ;
  const col  = scoreColor(score);

  return (
    <svg width={size} height={size / 1.5} viewBox={`0 0 ${size} ${size / 1.5}`}>
      {/* Track */}
      <path
        d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
        fill="none" stroke="#e2e8f0" strokeWidth="12" strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r},${cy} A ${r},${r} 0 0,1 ${cx + r},${cy}`}
        fill="none" stroke={col} strokeWidth="12" strokeLinecap="round"
        strokeDasharray={`${pct} ${circ}`}
        style={{ transition: "stroke-dasharray 1.2s ease" }}
      />
      <text x={cx} y={cy - 4} textAnchor="middle"
        fontSize={size * 0.18} fontWeight="800" fill={col}>
        {score.toFixed(1)}
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle"
        fontSize={size * 0.09} fill="#94a3b8">
        out of 10
      </text>
    </svg>
  );
}

// ── Score Bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, score, verdict }) {
  const col = scoreColor(score);
  const pct = (score / 10) * 100;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: col }}>{score}/10</span>
      </div>
      <div style={{ background: "#e2e8f0", borderRadius: 99, height: 8, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: col, borderRadius: 99,
          transition: "width 1.2s ease"
        }} />
      </div>
      {verdict && (
        <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>{verdict}</p>
      )}
    </div>
  );
}

// ── Action Card ──────────────────────────────────────────────────────────────
function ActionCard({ action }) {
  const tl = timelineColor[action.timeline] || timelineColor["This month"];
  return (
    <div style={{
      borderLeft: "4px solid #6366f1", background: "#f8fafc",
      borderRadius: "0 10px 10px 0", padding: "14px 16px", marginBottom: 12
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#1e293b", fontSize: 15 }}>
          #{action.priority} — {action.action}
        </p>
        <span style={{
          background: action.impact === "High" ? "#dcfce7" : "#fef9c3",
          color: action.impact === "High" ? "#166534" : "#854d0e",
          padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 700,
          whiteSpace: "nowrap", marginLeft: 8
        }}>
          {action.impact} Impact
        </span>
      </div>
      <p style={{ margin: "0 0 8px", color: "#475569", fontSize: 13, lineHeight: 1.6 }}>
        {action.detail}
      </p>
      <span style={{
        background: tl.bg, color: tl.text, padding: "3px 10px",
        borderRadius: 99, fontSize: 12, fontWeight: 600
      }}>
        ⏱ {action.timeline}
      </span>
    </div>
  );
}

// ── Results Dashboard ────────────────────────────────────────────────────────
function ResultsDashboard({ data, submittedEmail }) {
  const { overall_score, summary, scores, strengths, critical_gaps,
          action_plan, cv_assessment, headline_suggestion, recommended_niche,
          salary_range_usd, best_platforms, needs_cv_revamp } = data;

  const overallColor = scoreColor(overall_score);
  const cvColor      = gradeColor[cv_assessment?.grade] || "#94a3b8";

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "0 16px 60px" }}>

      {/* Hero Score */}
      <div style={{
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        borderRadius: 20, padding: "36px 32px", textAlign: "center",
        marginBottom: 24, color: "white"
      }}>
        <p style={{ color: "#6366f1", margin: "0 0 6px", fontSize: 12,
                    letterSpacing: 2, fontWeight: 700 }}>
          CAREER PROFILE ANALYSIS COMPLETE
        </p>
        <Gauge score={overall_score} size={180} />
        <p style={{ fontSize: 22, fontWeight: 800, margin: "8px 0 10px" }}>
          Overall Score: {overall_score?.toFixed(1)} / 10
        </p>
        <p style={{ color: "#94a3b8", lineHeight: 1.7, maxWidth: 600, margin: "0 auto 16px", fontSize: 14 }}>
          {summary}
        </p>
        <div style={{
          display: "inline-block", background: "rgba(99,102,241,0.2)",
          borderRadius: 8, padding: "10px 20px"
        }}>
          <p style={{ color: "#a5b4fc", fontSize: 12, margin: "0 0 4px", letterSpacing: 1 }}>
            📩 FULL REPORT SENT TO
          </p>
          <p style={{ color: "white", fontWeight: 700, margin: 0 }}>{submittedEmail}</p>
        </div>
      </div>

      {/* Insight Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
        {[
          { label: "💡 Recommended Niche", value: recommended_niche },
          { label: "💰 Realistic US Pay", value: salary_range_usd },
        ].map(({ label, value }) => (
          <div key={label} style={{
            background: "white", borderRadius: 12, padding: 16,
            boxShadow: "0 1px 8px rgba(0,0,0,0.06)"
          }}>
            <p style={{ color: "#94a3b8", fontSize: 11, letterSpacing: 1,
                        fontWeight: 700, margin: "0 0 6px" }}>{label}</p>
            <p style={{ color: "#1e293b", fontWeight: 700, margin: 0, fontSize: 15 }}>{value}</p>
          </div>
        ))}
        <div style={{
          gridColumn: "1 / -1", background: "white", borderRadius: 12,
          padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.06)"
        }}>
          <p style={{ color: "#94a3b8", fontSize: 11, letterSpacing: 1,
                      fontWeight: 700, margin: "0 0 8px" }}>
            ✍️ BETTER LINKEDIN HEADLINE
          </p>
          <p style={{ color: "#4338ca", fontStyle: "italic", margin: 0, fontSize: 14 }}>
            "{headline_suggestion}"
          </p>
        </div>
        <div style={{
          gridColumn: "1 / -1", background: "white", borderRadius: 12,
          padding: 16, boxShadow: "0 1px 8px rgba(0,0,0,0.06)"
        }}>
          <p style={{ color: "#94a3b8", fontSize: 11, letterSpacing: 1,
                      fontWeight: 700, margin: "0 0 8px" }}>
            🎯 BEST PLATFORMS FOR YOU
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(best_platforms || []).map((p) => (
              <span key={p} style={{
                background: "#e0e7ff", color: "#4338ca", padding: "4px 14px",
                borderRadius: 99, fontSize: 13, fontWeight: 600
              }}>{p}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Score Bars */}
      <div style={{
        background: "white", borderRadius: 16, padding: "24px 28px",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)", marginBottom: 24
      }}>
        <h2 style={{ color: "#1e293b", margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>
          📊 Detailed Scorecard
        </h2>
        {Object.values(scores || {}).map((s) => (
          <ScoreBar key={s.label} label={s.label} score={s.score} verdict={s.verdict} />
        ))}
      </div>

      {/* Strengths & Gaps */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{
          background: "#f0fdf4", borderRadius: 16, padding: "20px 24px",
          boxShadow: "0 1px 8px rgba(0,0,0,0.04)"
        }}>
          <h3 style={{ color: "#166534", margin: "0 0 14px", fontSize: 16 }}>
            💪 Your Strengths
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(strengths || []).map((s, i) => (
              <li key={i} style={{ color: "#15803d", marginBottom: 8, fontSize: 13, lineHeight: 1.5 }}>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div style={{
          background: "#fff7ed", borderRadius: 16, padding: "20px 24px",
          boxShadow: "0 1px 8px rgba(0,0,0,0.04)"
        }}>
          <h3 style={{ color: "#9a3412", margin: "0 0 14px", fontSize: 16 }}>
            🔧 Critical Gaps
          </h3>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {(critical_gaps || []).map((g, i) => (
              <li key={i} style={{ color: "#c2410c", marginBottom: 8, fontSize: 13, lineHeight: 1.5 }}>
                {g}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* CV Assessment */}
      <div style={{
        background: "white", borderRadius: 16, padding: "24px 28px",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)", marginBottom: 24
      }}>
        <h2 style={{ color: "#1e293b", margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
          📄 CV / Resume Assessment
        </h2>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
          <div style={{
            minWidth: 72, height: 72, borderRadius: 12,
            background: cvColor, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 36, fontWeight: 900, color: "white"
          }}>
            {cv_assessment?.grade}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <span style={{
                background: cv_assessment?.ats_friendly ? "#dcfce7" : "#fee2e2",
                color: cv_assessment?.ats_friendly ? "#166534" : "#dc2626",
                padding: "3px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700
              }}>
                ATS {cv_assessment?.ats_friendly ? "✅ Friendly" : "❌ Not Optimised"}
              </span>
            </div>
            <p style={{ color: "#475569", margin: "0 0 10px", fontSize: 13, lineHeight: 1.6 }}>
              {cv_assessment?.feedback}
            </p>
            {cv_assessment?.missing_elements?.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", margin: "0 0 6px" }}>
                  Missing elements:
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {cv_assessment.missing_elements.map((m) => (
                    <span key={m} style={{
                      background: "#fef2f2", color: "#dc2626", padding: "3px 10px",
                      borderRadius: 99, fontSize: 12, fontWeight: 600
                    }}>{m}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Plan */}
      <div style={{
        background: "white", borderRadius: 16, padding: "24px 28px",
        boxShadow: "0 1px 8px rgba(0,0,0,0.06)", marginBottom: 24
      }}>
        <h2 style={{ color: "#1e293b", margin: "0 0 16px", fontSize: 18, fontWeight: 700 }}>
          🎯 Your Personalized Action Plan
        </h2>
        {(action_plan || []).map((a) => <ActionCard key={a.priority} action={a} />)}
      </div>

      {/* CTA */}
      {needs_cv_revamp && (
        <div style={{
          background: "linear-gradient(135deg, #1e293b 0%, #312e81 100%)",
          borderRadius: 20, padding: "32px 28px", textAlign: "center"
        }}>
          <p style={{ color: "#a5b4fc", fontSize: 12, margin: "0 0 6px",
                      letterSpacing: 2, fontWeight: 700 }}>
            YOUR CV GRADE IS
          </p>
          <p style={{ color: cvColor, fontSize: 52, fontWeight: 900, margin: "0 0 12px" }}>
            {cv_assessment?.grade}
          </p>
          <h2 style={{ color: "white", margin: "0 0 10px", fontSize: 22 }}>
            Your skills deserve better packaging.
          </h2>
          <p style={{ color: "#94a3b8", margin: "0 0 24px", lineHeight: 1.7,
                      maxWidth: 500, marginLeft: "auto", marginRight: "auto", fontSize: 14 }}>
            You have real skills — the problem is how they're presented.
            Our professional CV &amp; LinkedIn optimization service helps you
            close the gap between your actual ability and what US clients see.
          </p>
          <a
            href="mailto:your@email.com?subject=CV Revamp Enquiry"
            style={{
              display: "inline-block", background: "#6366f1", color: "white",
              padding: "14px 32px", borderRadius: 10, textDecoration: "none",
              fontWeight: 700, fontSize: 15
            }}
          >
            Book a Free 15-Min Strategy Call →
          </a>
        </div>
      )}
    </div>
  );
}

// ── Step Indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current, total }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center",
                  gap: 0, marginBottom: 32 }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", display: "flex",
            alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14,
            background: i < current ? "#6366f1" : i === current ? "#818cf8" : "#e2e8f0",
            color: i <= current ? "white" : "#94a3b8",
            transition: "all 0.3s ease"
          }}>
            {i < current ? "✓" : i + 1}
          </div>
          {i < total - 1 && (
            <div style={{
              width: 40, height: 2,
              background: i < current ? "#6366f1" : "#e2e8f0",
              transition: "background 0.3s ease"
            }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Form Field ───────────────────────────────────────────────────────────────
function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontWeight: 600, color: "#334155",
                      fontSize: 14, marginBottom: 4 }}>
        {label}
      </label>
      {hint && <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 6px" }}>{hint}</p>}
      {children}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 14px", borderRadius: 8, fontSize: 14,
  border: "1.5px solid #e2e8f0", outline: "none", color: "#1e293b",
  background: "white", boxSizing: "border-box",
  transition: "border-color 0.2s ease",
};

// ── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [step,        setStep]        = useState(0);   // 0=intro, 1-3=form steps, 4=loading, 5=results
  const [formData,    setFormData]    = useState({
    name: "", email: "", phone: "", linkedin_url: "", portfolio_url: ""
  });
  const [cvFile,      setCvFile]      = useState(null);
  const [results,     setResults]     = useState(null);
  const [error,       setError]       = useState("");
  const fileRef = useRef();

  const update = (key, val) => setFormData((p) => ({ ...p, [key]: val }));

  const STEPS = [
    {
      title: "Who are you?",
      subtitle: "We'll personalise your analysis and send results to your inbox.",
      fields: (
        <>
          <Field label="Full Name *" hint="As it appears on your CV/LinkedIn">
            <input style={inputStyle} value={formData.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. John Doe" />
          </Field>
          <Field label="Email Address *" hint="Your analysis report will be emailed here">
            <input style={inputStyle} type="email" value={formData.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="john@example.com" />
          </Field>
          <Field label="Phone / WhatsApp" hint="Optional — for follow-up">
            <input style={inputStyle} value={formData.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+254 7XX XXX XXX" />
          </Field>
        </>
      ),
      validate: () => formData.name.trim() && formData.email.includes("@"),
    },
    {
      title: "Your online presence",
      subtitle: "We search the web for your profile to check how visible you are to US clients.",
      fields: (
        <>
          <Field label="LinkedIn Profile URL"
            hint="e.g. https://linkedin.com/in/yourname — paste the full URL">
            <input style={inputStyle} value={formData.linkedin_url}
              onChange={(e) => update("linkedin_url", e.target.value)}
              placeholder="https://linkedin.com/in/yourname" />
          </Field>
          <Field label="Portfolio / Personal Website"
            hint="GitHub pages, Google Sites, personal domain, etc.">
            <input style={inputStyle} value={formData.portfolio_url}
              onChange={(e) => update("portfolio_url", e.target.value)}
              placeholder="https://yourwebsite.com" />
          </Field>
        </>
      ),
      validate: () => true,
    },
    {
      title: "Upload your CV",
      subtitle: "Optional but recommended — gives us 80% more accuracy in your analysis.",
      fields: (
        <>
          <Field label="CV / Resume File"
            hint="Accepted formats: PDF, DOCX, TXT (max 5MB)">
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                border: "2px dashed #c7d2fe", borderRadius: 12, padding: "28px 20px",
                textAlign: "center", cursor: "pointer", background: "#f8fafc",
                transition: "border-color 0.2s ease"
              }}
            >
              {cvFile ? (
                <>
                  <p style={{ fontSize: 28, margin: "0 0 6px" }}>📄</p>
                  <p style={{ fontWeight: 600, color: "#4338ca", margin: 0 }}>{cvFile.name}</p>
                  <p style={{ color: "#64748b", fontSize: 12, margin: "4px 0 0" }}>
                    {(cvFile.size / 1024).toFixed(0)} KB — click to replace
                  </p>
                </>
              ) : (
                <>
                  <p style={{ fontSize: 36, margin: "0 0 8px" }}>📁</p>
                  <p style={{ fontWeight: 600, color: "#334155", margin: "0 0 4px" }}>
                    Click to upload your CV
                  </p>
                  <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
                    PDF, DOCX, or TXT
                  </p>
                </>
              )}
            </div>
            <input ref={fileRef} type="file"
              accept=".pdf,.doc,.docx,.txt"
              style={{ display: "none" }}
              onChange={(e) => setCvFile(e.target.files[0] || null)} />
          </Field>

          <div style={{ background: "#fffbeb", border: "1px solid #fde68a",
                        borderRadius: 10, padding: "12px 16px" }}>
            <p style={{ color: "#92400e", fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              🔒 <strong>Privacy:</strong> Your CV is used solely for analysis.
              It is never stored or shared with third parties.
            </p>
          </div>
        </>
      ),
      validate: () => true,
    },
  ];

  const handleSubmit = async () => {
    setStep(4); // loading
    setError("");
    try {
      const fd = new FormData();
      fd.append("name",          formData.name);
      fd.append("email",         formData.email);
      fd.append("phone",         formData.phone);
      fd.append("linkedin_url",  formData.linkedin_url);
      fd.append("portfolio_url", formData.portfolio_url);
      if (cvFile) fd.append("cv_file", cvFile);

      const res = await fetch(`${API_BASE}/analyze`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Server error");
      }
      const json = await res.json();
      setResults(json.analysis);
      setStep(5);
    } catch (e) {
      setError(e.message);
      setStep(3); // go back to last step
    }
  };

  // ── Loading Screen ─────────────────────────────────────────────────────────
  if (step === 4) {
    const messages = [
      "🔍 Searching the web for your profile...",
      "🌐 Analysing your LinkedIn and portfolio...",
      "📄 Parsing your CV content...",
      "🤖 Running AI career analysis...",
      "📊 Calculating your scores...",
      "📧 Preparing your email report...",
    ];
    return (
      <div style={{ minHeight: "100vh", background: "#0f172a", display: "flex",
                    flexDirection: "column", alignItems: "center", justifyContent: "center",
                    padding: 24 }}>
        {/* Spinner */}
        <div style={{
          width: 80, height: 80, border: "6px solid #1e293b",
          borderTop: "6px solid #6366f1", borderRadius: "50%",
          animation: "spin 1s linear infinite", marginBottom: 32
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <h2 style={{ color: "white", margin: "0 0 8px", fontSize: 22, fontWeight: 700 }}>
          Analysing your profile...
        </h2>
        <p style={{ color: "#94a3b8", margin: "0 0 32px", fontSize: 14 }}>
          This takes about 30–60 seconds. Please don't close this page.
        </p>
        <div style={{ maxWidth: 380, width: "100%" }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 0", color: i === 0 ? "#a5b4fc" : "#475569",
              fontSize: 14, fontWeight: i === 0 ? 600 : 400
            }}>
              <span>{i === 0 ? "⏳" : "·"}</span>
              {m}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Results ────────────────────────────────────────────────────────────────
  if (step === 5 && results) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9" }}>
        <div style={{
          background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
          padding: "20px 24px", textAlign: "center", marginBottom: 32
        }}>
          <h1 style={{ color: "white", margin: 0, fontSize: 22, fontWeight: 800 }}>
            🎯 Career Profile Analyzer
          </h1>
        </div>
        <ResultsDashboard data={results} submittedEmail={formData.email} />
      </div>
    );
  }

  // ── Intro ──────────────────────────────────────────────────────────────────
  if (step === 0) {
    return (
      <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
                    display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{
          maxWidth: 540, width: "100%", background: "white",
          borderRadius: 24, overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.4)"
        }}>
          <div style={{
            background: "linear-gradient(135deg, #1e293b 0%, #312e81 100%)",
            padding: "40px 36px", textAlign: "center"
          }}>
            <p style={{ fontSize: 48, margin: "0 0 12px" }}>🎯</p>
            <h1 style={{ color: "white", margin: "0 0 10px", fontSize: 26, fontWeight: 800 }}>
              Career Profile Analyzer
            </h1>
            <p style={{ color: "#a5b4fc", margin: 0, lineHeight: 1.7, fontSize: 15 }}>
              Find out exactly why you're not getting responses from US clients and employers —
              and what to do about it.
            </p>
          </div>
          <div style={{ padding: "36px 36px" }}>
            {[
              { icon: "🔍", text: "We search the web for your public profile" },
              { icon: "📊", text: "Score you across 8 career readiness categories" },
              { icon: "📧", text: "Email you a full report with an action plan" },
              { icon: "💡", text: "Tell you exactly what's holding you back" },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: "flex", alignItems: "center",
                                       gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 22 }}>{icon}</span>
                <p style={{ margin: 0, color: "#334155", fontSize: 14, fontWeight: 500 }}>{text}</p>
              </div>
            ))}

            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "12px 16px",
                          marginBottom: 24, marginTop: 8 }}>
              <p style={{ color: "#166534", fontSize: 13, margin: 0, fontWeight: 600 }}>
                ✅ 100% Free — takes 2 minutes to complete
              </p>
            </div>

            <button
              onClick={() => setStep(1)}
              style={{
                width: "100%", padding: "14px", background: "#6366f1",
                color: "white", border: "none", borderRadius: 10, fontSize: 16,
                fontWeight: 700, cursor: "pointer"
              }}
            >
              Analyse My Profile →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Form Steps ─────────────────────────────────────────────────────────────
  const currentStep = STEPS[step - 1];
  const isLastStep  = step === STEPS.length;

  return (
    <div style={{ minHeight: "100vh",
                  background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{
        maxWidth: 540, width: "100%", background: "white",
        borderRadius: 24, overflow: "hidden",
        boxShadow: "0 25px 60px rgba(0,0,0,0.4)"
      }}>
        {/* Header */}
        <div style={{
          background: "linear-gradient(135deg, #1e293b 0%, #312e81 100%)",
          padding: "24px 32px"
        }}>
          <StepIndicator current={step} total={STEPS.length + 1} />
          <h2 style={{ color: "white", margin: "0 0 6px", fontSize: 20, fontWeight: 700 }}>
            {currentStep.title}
          </h2>
          <p style={{ color: "#a5b4fc", margin: 0, fontSize: 14 }}>
            {currentStep.subtitle}
          </p>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 32px" }}>
          {currentStep.fields}

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca",
                          borderRadius: 8, padding: "12px 16px", marginBottom: 16 }}>
              <p style={{ color: "#dc2626", fontSize: 13, margin: 0 }}>
                ❌ {error}
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: 12 }}>
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                style={{
                  flex: 1, padding: "13px", background: "#f8fafc",
                  color: "#475569", border: "1.5px solid #e2e8f0", borderRadius: 10,
                  fontSize: 15, fontWeight: 600, cursor: "pointer"
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={isLastStep ? handleSubmit : () => setStep(step + 1)}
              disabled={!currentStep.validate()}
              style={{
                flex: 2, padding: "13px",
                background: currentStep.validate() ? "#6366f1" : "#e2e8f0",
                color: currentStep.validate() ? "white" : "#94a3b8",
                border: "none", borderRadius: 10, fontSize: 15,
                fontWeight: 700, cursor: currentStep.validate() ? "pointer" : "not-allowed",
                transition: "background 0.2s ease"
              }}
            >
              {isLastStep ? "🚀 Analyse My Profile" : "Continue →"}
            </button>
          </div>

          <p style={{ color: "#94a3b8", fontSize: 12, textAlign: "center",
                      margin: "16px 0 0" }}>
            🔒 Your data is private and never sold. Used only for this analysis.
          </p>
        </div>
      </div>
    </div>
  );
}
