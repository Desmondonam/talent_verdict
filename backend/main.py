"""
Career Profile Analyzer — FastAPI Backend
Author: Built for Desmond Onam's CV/LinkedIn revamp lead generation service
"""

from fastapi import FastAPI, UploadFile, File, Form, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import anthropic
import requests
from bs4 import BeautifulSoup
import sqlite3
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import json
import os
import re
import io
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# ─── App Setup ────────────────────────────────────────────────────────────────

app = FastAPI(title="Career Profile Analyzer API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

# ─── Database ─────────────────────────────────────────────────────────────────

def init_db():
    conn = sqlite3.connect("leads.db")
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS leads (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT,
            email         TEXT UNIQUE,
            phone         TEXT,
            linkedin_url  TEXT,
            portfolio_url TEXT,
            overall_score REAL,
            cv_grade      TEXT,
            needs_revamp  BOOLEAN,
            scores_json   TEXT,
            analysis_json TEXT,
            contacted     BOOLEAN DEFAULT 0,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()

init_db()

def save_lead(name, email, phone, linkedin_url, portfolio_url, overall_score, cv_grade, needs_revamp, scores, analysis):
    conn = sqlite3.connect("leads.db")
    c = conn.cursor()
    try:
        c.execute("""
            INSERT OR REPLACE INTO leads
            (name, email, phone, linkedin_url, portfolio_url, overall_score, cv_grade, needs_revamp, scores_json, analysis_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            name, email, phone, linkedin_url, portfolio_url,
            overall_score, cv_grade, needs_revamp,
            json.dumps(scores), json.dumps(analysis)
        ))
        conn.commit()
    except Exception as e:
        print(f"[DB ERROR] {e}")
    finally:
        conn.close()

# ─── Web Content Fetching ─────────────────────────────────────────────────────

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

def fetch_page(url: str, max_chars: int = 5000) -> str:
    if not url or not url.startswith("http"):
        return ""
    try:
        resp = requests.get(url, headers=HEADERS, timeout=12)
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "head"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return text[:max_chars]
    except Exception as e:
        return f"[Could not fetch {url}: {e}]"

def web_search(name: str) -> str:
    """Use DuckDuckGo (no API key needed) to search for the person."""
    try:
        from duckduckgo_search import DDGS
        results = []
        queries = [
            f'"{name}" data scientist engineer portfolio',
            f'"{name}" GitHub LinkedIn resume',
        ]
        with DDGS() as ddgs:
            for q in queries:
                for r in ddgs.text(q, max_results=4):
                    results.append(
                        f"Title: {r.get('title','')}\n"
                        f"Snippet: {r.get('body','')}\n"
                        f"URL: {r.get('href','')}"
                    )
        return "\n\n---\n\n".join(results[:6])
    except Exception as e:
        return f"[Web search unavailable: {e}]"

# ─── CV Text Extraction ───────────────────────────────────────────────────────

def extract_cv_text(file_bytes: bytes, filename: str) -> str:
    text = ""
    try:
        fname = filename.lower()
        if fname.endswith(".pdf"):
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                text += (page.extract_text() or "") + "\n"
        elif fname.endswith((".docx", ".doc")):
            from docx import Document
            doc = Document(io.BytesIO(file_bytes))
            text = "\n".join(p.text for p in doc.paragraphs)
        elif fname.endswith(".txt"):
            text = file_bytes.decode("utf-8", errors="ignore")
        else:
            text = "[Unsupported file format — please upload PDF, DOCX, or TXT]"
    except Exception as e:
        text = f"[CV parse error: {e}]"
    return text[:7000]

# ─── Claude Analysis ──────────────────────────────────────────────────────────

ANALYSIS_PROMPT = """
You are a senior tech career strategist and recruiter with 15+ years placing African tech professionals
into US and European companies. You do brutally honest, data-driven career profile assessments.

Analyze the following person's career profile completely and return ONLY a valid JSON object —
no markdown fences, no explanation outside the JSON.

== PROFILE DATA ==
Name: {name}
LinkedIn: {linkedin_url}
Portfolio: {portfolio_url}

== CV / RESUME CONTENT ==
{cv_text}

== LINKEDIN PAGE CONTENT (scraped) ==
{linkedin_content}

== PORTFOLIO WEBSITE CONTENT (scraped) ==
{portfolio_content}

== WEB SEARCH RESULTS ==
{web_results}

== INSTRUCTIONS ==
Score each category 1–10. Be specific and honest. Base scores on available evidence.
If info is limited, score conservatively and say so.

Return this exact JSON structure:

{{
  "overall_score": <number 1-10, one decimal ok>,
  "summary": "<2-3 honest sentences summarizing their position in the market>",
  "headline_suggestion": "<a better LinkedIn headline they should use right now>",
  "strengths": [
    "<specific strength with evidence>",
    "<specific strength with evidence>",
    "<specific strength with evidence>"
  ],
  "critical_gaps": [
    "<specific gap with explanation>",
    "<specific gap with explanation>",
    "<specific gap with explanation>"
  ],
  "scores": {{
    "technical_skills": {{
      "score": <1-10>,
      "label": "Technical Skills & Depth",
      "verdict": "<one specific sentence>",
      "color": "<green|yellow|red>"
    }},
    "work_experience": {{
      "score": <1-10>,
      "label": "Real-World Experience",
      "verdict": "<one specific sentence>",
      "color": "<green|yellow|red>"
    }},
    "portfolio_quality": {{
      "score": <1-10>,
      "label": "Portfolio & GitHub Quality",
      "verdict": "<one specific sentence>",
      "color": "<green|yellow|red>"
    }},
    "online_visibility": {{
      "score": <1-10>,
      "label": "Online Visibility & Personal Brand",
      "verdict": "<one specific sentence>",
      "color": "<green|yellow|red>"
    }},
    "positioning": {{
      "score": <1-10>,
      "label": "Positioning & Niche Clarity",
      "verdict": "<one specific sentence>",
      "color": "<green|yellow|red>"
    }},
    "freelance_presence": {{
      "score": <1-10>,
      "label": "Freelance Platform Presence",
      "verdict": "<one specific sentence>",
      "color": "<green|yellow|red>"
    }},
    "content_leadership": {{
      "score": <1-10>,
      "label": "Content & Thought Leadership",
      "verdict": "<one specific sentence>",
      "color": "<green|yellow|red>"
    }},
    "market_readiness": {{
      "score": <1-10>,
      "label": "US/Global Market Readiness",
      "verdict": "<one specific sentence>",
      "color": "<green|yellow|red>"
    }}
  }},
  "action_plan": [
    {{
      "priority": 1,
      "action": "<short action title>",
      "detail": "<exactly what to do and why — 2-3 sentences>",
      "timeline": "This week",
      "impact": "High"
    }},
    {{
      "priority": 2,
      "action": "<short action title>",
      "detail": "<exactly what to do and why>",
      "timeline": "This week",
      "impact": "High"
    }},
    {{
      "priority": 3,
      "action": "<short action title>",
      "detail": "<exactly what to do and why>",
      "timeline": "This month",
      "impact": "Medium"
    }},
    {{
      "priority": 4,
      "action": "<short action title>",
      "detail": "<exactly what to do and why>",
      "timeline": "This month",
      "impact": "Medium"
    }},
    {{
      "priority": 5,
      "action": "<short action title>",
      "detail": "<exactly what to do and why>",
      "timeline": "Next 3 months",
      "impact": "High"
    }}
  ],
  "cv_assessment": {{
    "grade": "<A|B|C|D|F>",
    "ats_friendly": <true|false>,
    "feedback": "<2-3 specific sentences on CV quality, formatting, keywords, quantified results>",
    "missing_elements": ["<element 1>", "<element 2>", "<element 3>"]
  }},
  "best_platforms": ["<platform most suited for them>", "<second>", "<third>"],
  "recommended_niche": "<the single most monetizable niche given their skills>",
  "salary_range_usd": "<realistic hourly or annual range for remote US work>",
  "needs_cv_revamp": <true|false>
}}

Color rules: green = score 7-10, yellow = score 4-6, red = score 1-3.
needs_cv_revamp = true if cv_assessment grade is C, D, or F, OR overall_score < 6.
Be direct. Sugarcoating helps no one.
"""

def run_analysis(name, email, linkedin_url, portfolio_url, cv_text, web_results, linkedin_content, portfolio_content):
    prompt = ANALYSIS_PROMPT.format(
        name=name,
        linkedin_url=linkedin_url or "Not provided",
        portfolio_url=portfolio_url or "Not provided",
        cv_text=cv_text or "No CV uploaded",
        linkedin_content=linkedin_content or "Could not scrape LinkedIn",
        portfolio_content=portfolio_content or "No portfolio content",
        web_results=web_results or "No search results",
    )

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=4096,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = response.content[0].text.strip()
    raw = re.sub(r"^```json\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)

# ─── Email Sender ─────────────────────────────────────────────────────────────

def build_email_html(name: str, analysis: dict, service_email: str) -> str:
    overall     = analysis.get("overall_score", 0)
    scores      = analysis.get("scores", {})
    cv          = analysis.get("cv_assessment", {})
    cv_grade    = cv.get("grade", "N/A")
    needs_revamp = analysis.get("needs_cv_revamp", False)
    headline    = analysis.get("headline_suggestion", "")
    niche       = analysis.get("recommended_niche", "")
    salary      = analysis.get("salary_range_usd", "")
    platforms   = analysis.get("best_platforms", [])

    color_map = {"green": "#22c55e", "yellow": "#f59e0b", "red": "#ef4444"}
    overall_color = "#22c55e" if overall >= 7 else "#f59e0b" if overall >= 4 else "#ef4444"

    score_rows = ""
    for val in scores.values():
        c = color_map.get(val.get("color", "yellow"), "#f59e0b")
        score_rows += f"""
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#334155;">
            {val.get('label','')}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">
            <span style="background:{c};color:#fff;padding:3px 12px;border-radius:20px;
                         font-weight:700;font-size:13px;">{val.get('score','')}/10</span>
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">
            {val.get('verdict','')}
          </td>
        </tr>"""

    strengths_li = "".join(
        f"<li style='margin-bottom:6px;color:#166534;'>✅ {s}</li>"
        for s in analysis.get("strengths", [])
    )
    gaps_li = "".join(
        f"<li style='margin-bottom:6px;color:#9a3412;'>⚠️ {g}</li>"
        for g in analysis.get("critical_gaps", [])
    )

    actions_html = ""
    timeline_colors = {"This week": "#dbeafe", "This month": "#fef3c7", "Next 3 months": "#ede9fe"}
    text_colors     = {"This week": "#1d4ed8", "This month": "#92400e", "Next 3 months": "#6d28d9"}
    for a in analysis.get("action_plan", []):
        tl   = a.get("timeline", "This month")
        bg   = timeline_colors.get(tl, "#f0f0f0")
        tc   = text_colors.get(tl, "#333")
        actions_html += f"""
        <div style="border-left:4px solid #6366f1;padding:12px 16px;margin-bottom:12px;
                    background:#f8fafc;border-radius:0 8px 8px 0;">
          <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:15px;">
            #{a.get('priority','')} — {a.get('action','')}
          </p>
          <p style="margin:0 0 8px;color:#475569;font-size:13px;">{a.get('detail','')}</p>
          <span style="background:{bg};color:{tc};padding:2px 10px;border-radius:12px;
                       font-size:12px;font-weight:600;">{tl}</span>
          <span style="margin-left:8px;background:#f0fdf4;color:#166534;padding:2px 10px;
                       border-radius:12px;font-size:12px;font-weight:600;">
            {a.get('impact','')} Impact
          </span>
        </div>"""

    missing = "".join(
        f"<li style='color:#dc2626;margin-bottom:4px;'>{m}</li>"
        for m in cv.get("missing_elements", [])
    )
    platforms_badges = "".join(
        f"<span style='background:#e0e7ff;color:#4338ca;padding:4px 12px;border-radius:20px;"
        f"margin-right:6px;font-size:13px;font-weight:600;'>{p}</span>"
        for p in platforms
    )

    cta_section = ""
    if needs_revamp:
        cta_section = f"""
        <div style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);
                    border-radius:14px;padding:28px;margin:28px 0;text-align:center;">
          <p style="color:#94a3b8;font-size:13px;margin:0 0 4px;letter-spacing:1px;">
            YOUR CV GRADE IS
          </p>
          <p style="color:white;font-size:48px;font-weight:900;margin:0 0 12px;">{cv_grade}</p>
          <h2 style="color:white;margin:0 0 12px;font-size:20px;">
            Your skills deserve better packaging.
          </h2>
          <p style="color:#94a3b8;margin:0 0 20px;font-size:14px;line-height:1.6;">
            You have real skills. The problem is how they're being presented.
            Our professional CV &amp; LinkedIn optimization service helps African tech
            professionals close the gap between their actual ability and their market visibility —
            and start getting responses from US and European clients.
          </p>
          <a href="mailto:{service_email}?subject=CV Revamp Enquiry — {name}"
             style="background:#6366f1;color:white;padding:14px 32px;border-radius:8px;
                    text-decoration:none;font-weight:700;font-size:15px;display:inline-block;">
            Book a Free 15-Min Strategy Call →
          </a>
        </div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:20px;background:#f1f5f9;
             font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:700px;margin:0 auto;background:white;
            border-radius:16px;overflow:hidden;
            box-shadow:0 4px 32px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#1e293b 0%,#0f172a 100%);
              padding:36px 32px;text-align:center;">
    <p style="color:#6366f1;margin:0 0 6px;font-size:13px;letter-spacing:2px;font-weight:600;">
      CAREER PROFILE ANALYSIS
    </p>
    <h1 style="color:white;margin:0 0 8px;font-size:26px;">Hi {name} 👋</h1>
    <p style="color:#94a3b8;margin:0;font-size:14px;">
      Here is your complete career profile assessment
    </p>
  </div>

  <div style="padding:36px 32px;">

    <!-- Overall Score -->
    <div style="text-align:center;margin-bottom:36px;">
      <div style="display:inline-block;width:110px;height:110px;border-radius:50%;
                  background:{overall_color};line-height:110px;font-size:44px;
                  font-weight:900;color:white;margin-bottom:14px;">
        {overall:.1f}
      </div>
      <p style="font-size:22px;font-weight:700;color:#1e293b;margin:0 0 8px;">
        Overall Score: {overall:.1f} / 10
      </p>
      <p style="color:#64748b;margin:0;line-height:1.6;font-size:14px;">
        {analysis.get('summary','')}
      </p>
    </div>

    <!-- Key Insights Row -->
    <div style="display:grid;gap:12px;margin-bottom:28px;">
      <div style="background:#f8fafc;border-radius:10px;padding:16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;letter-spacing:1px;font-weight:600;">
          💡 RECOMMENDED NICHE
        </p>
        <p style="margin:0;color:#1e293b;font-weight:600;">{niche}</p>
      </div>
      <div style="background:#f8fafc;border-radius:10px;padding:16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;letter-spacing:1px;font-weight:600;">
          ✍️ BETTER LINKEDIN HEADLINE
        </p>
        <p style="margin:0;color:#1e293b;font-style:italic;">"{headline}"</p>
      </div>
      <div style="background:#f8fafc;border-radius:10px;padding:16px;">
        <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;letter-spacing:1px;font-weight:600;">
          💰 REALISTIC US REMOTE SALARY
        </p>
        <p style="margin:0;color:#1e293b;font-weight:600;">{salary}</p>
      </div>
      <div style="background:#f8fafc;border-radius:10px;padding:16px;">
        <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;letter-spacing:1px;font-weight:600;">
          🎯 BEST PLATFORMS FOR YOU
        </p>
        <div>{platforms_badges}</div>
      </div>
    </div>

    <!-- Score Table -->
    <h2 style="color:#1e293b;font-size:18px;border-bottom:2px solid #e2e8f0;
               padding-bottom:10px;margin-bottom:16px;">
      📊 Detailed Scorecard
    </h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
      <thead>
        <tr style="background:#f8fafc;">
          <th style="padding:10px 12px;text-align:left;color:#475569;font-size:13px;">
            Category
          </th>
          <th style="padding:10px 12px;text-align:center;color:#475569;font-size:13px;">
            Score
          </th>
          <th style="padding:10px 12px;text-align:left;color:#475569;font-size:13px;">
            Verdict
          </th>
        </tr>
      </thead>
      <tbody>{score_rows}</tbody>
    </table>

    <!-- Strengths & Gaps -->
    <div style="margin-bottom:28px;">
      <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin-bottom:12px;">
        <h3 style="color:#166534;margin:0 0 12px;font-size:16px;">💪 Your Strengths</h3>
        <ul style="margin:0;padding-left:18px;">{strengths_li}</ul>
      </div>
      <div style="background:#fff7ed;border-radius:12px;padding:20px;">
        <h3 style="color:#9a3412;margin:0 0 12px;font-size:16px;">🔧 Critical Gaps</h3>
        <ul style="margin:0;padding-left:18px;">{gaps_li}</ul>
      </div>
    </div>

    <!-- CV Assessment -->
    <h2 style="color:#1e293b;font-size:18px;border-bottom:2px solid #e2e8f0;
               padding-bottom:10px;margin-bottom:16px;">
      📄 CV Assessment
    </h2>
    <div style="background:#f8fafc;border-radius:12px;padding:20px;margin-bottom:28px;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px;">
        <span style="font-size:42px;font-weight:900;color:#1e293b;">{cv_grade}</span>
        <div>
          <p style="margin:0 0 4px;font-weight:600;color:#1e293b;">
            ATS Friendly: {'✅ Yes' if cv.get('ats_friendly') else '❌ No'}
          </p>
          <p style="margin:0;font-size:13px;color:#64748b;">{cv.get('feedback','')}</p>
        </div>
      </div>
      {'<p style="margin:8px 0 4px;font-weight:600;color:#dc2626;font-size:13px;">Missing elements:</p><ul style="margin:0;padding-left:18px;">'+missing+'</ul>' if missing else ''}
    </div>

    <!-- Action Plan -->
    <h2 style="color:#1e293b;font-size:18px;border-bottom:2px solid #e2e8f0;
               padding-bottom:10px;margin-bottom:16px;">
      🎯 Your Personalized Action Plan
    </h2>
    <div style="margin-bottom:28px;">{actions_html}</div>

    {cta_section}

    <!-- Footer -->
    <div style="border-top:1px solid #e2e8f0;padding-top:20px;text-align:center;">
      <p style="color:#94a3b8;font-size:12px;margin:0 0 6px;">
        Career Profile Analyzer — Powered by AI
      </p>
      <p style="color:#cbd5e1;font-size:11px;margin:0;">
        This report was generated based on publicly available data and submitted documents.
        Results are indicative, not definitive.
      </p>
    </div>

  </div>
</div>
</body>
</html>"""


def send_email(name: str, to_email: str, analysis: dict):
    smtp_host    = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port    = int(os.getenv("SMTP_PORT", "587"))
    smtp_user    = os.getenv("SMTP_USER", "")
    smtp_pass    = os.getenv("SMTP_PASS", "")
    from_name    = os.getenv("FROM_NAME", "Career Profile Analyzer")
    service_email = os.getenv("SERVICE_EMAIL", smtp_user)

    if not smtp_user or not smtp_pass:
        print("[EMAIL] Credentials not configured — skipping email")
        return

    overall = analysis.get("overall_score", 0)
    subject = (
        f"Your Career Profile Score: {overall}/10 — Action Plan Inside | {name}"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"{from_name} <{smtp_user}>"
    msg["To"]      = to_email

    html_body = build_email_html(name, analysis, service_email)
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
        print(f"[EMAIL] ✅ Sent to {to_email}")
    except Exception as e:
        print(f"[EMAIL] ❌ Failed: {e}")


# ─── Routes ───────────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "Career Profile Analyzer API is live ✅"}


@app.post("/analyze")
async def analyze_profile(
    background_tasks: BackgroundTasks,
    name:          str = Form(...),
    email:         str = Form(...),
    phone:         str = Form(""),
    linkedin_url:  str = Form(""),
    portfolio_url: str = Form(""),
    cv_file: UploadFile = File(None),
):
    # 1. Extract CV text
    cv_text = ""
    if cv_file and cv_file.filename:
        raw = await cv_file.read()
        cv_text = extract_cv_text(raw, cv_file.filename)

    # 2. Scrape online content
    linkedin_content  = fetch_page(linkedin_url)  if linkedin_url  else ""
    portfolio_content = fetch_page(portfolio_url) if portfolio_url else ""
    web_results       = web_search(name)

    # 3. Run AI analysis
    try:
        analysis = run_analysis(
            name, email, linkedin_url, portfolio_url,
            cv_text, web_results, linkedin_content, portfolio_content
        )
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=500, detail=f"AI returned malformed JSON: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis error: {e}")

    # 4. Background tasks: save lead + send email
    overall      = analysis.get("overall_score", 0)
    cv_grade     = analysis.get("cv_assessment", {}).get("grade", "N/A")
    needs_revamp = analysis.get("needs_cv_revamp", False)

    background_tasks.add_task(
        save_lead, name, email, phone, linkedin_url, portfolio_url,
        overall, cv_grade, needs_revamp,
        analysis.get("scores", {}), analysis
    )
    background_tasks.add_task(send_email, name, email, analysis)

    return JSONResponse(content={"success": True, "analysis": analysis})


@app.get("/admin/leads")
def get_leads(secret: str = ""):
    """Admin endpoint — view all captured leads."""
    if secret != os.getenv("ADMIN_SECRET", "changeme123"):
        raise HTTPException(status_code=403, detail="Unauthorized")
    conn = sqlite3.connect("leads.db")
    c = conn.cursor()
    c.execute("""
        SELECT id, name, email, phone, linkedin_url, overall_score,
               cv_grade, needs_revamp, contacted, created_at
        FROM leads ORDER BY created_at DESC
    """)
    rows = c.fetchall()
    conn.close()
    cols = ["id","name","email","phone","linkedin","score","cv_grade",
            "needs_revamp","contacted","date"]
    return [dict(zip(cols, r)) for r in rows]


@app.patch("/admin/leads/{lead_id}/contacted")
def mark_contacted(lead_id: int, secret: str = ""):
    """Mark a lead as contacted."""
    if secret != os.getenv("ADMIN_SECRET", "changeme123"):
        raise HTTPException(status_code=403, detail="Unauthorized")
    conn = sqlite3.connect("leads.db")
    conn.execute("UPDATE leads SET contacted=1 WHERE id=?", (lead_id,))
    conn.commit()
    conn.close()
    return {"success": True}
