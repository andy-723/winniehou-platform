"""Claude helpers via the Emergent universal LLM key (emergentintegrations)."""
import os
import io
import json
import re
import logging
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger("lms.ai")

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY")
CLAUDE_MODEL = os.environ.get("CLAUDE_MODEL", "claude-sonnet-5-5")


def extract_text(data: bytes, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    try:
        if ext == "pdf":
            from pypdf import PdfReader
            reader = PdfReader(io.BytesIO(data))
            return "\n".join((p.extract_text() or "") for p in reader.pages).strip()
        if ext in ("doc", "docx"):
            from docx import Document
            doc = Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs).strip()
    except Exception as e:
        logger.warning(f"Resume text extraction failed: {e}")
    try:
        return data.decode("utf-8", "ignore").strip()
    except Exception:
        return ""


async def _claude_json(system: str, prompt: str):
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    import uuid
    chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=str(uuid.uuid4()), system_message=system).with_model("anthropic", CLAUDE_MODEL)
    out = await chat.send_message(UserMessage(text=prompt))
    text = out if isinstance(out, str) else getattr(out, "content", str(out))
    m = re.search(r"\{.*\}", text, re.S)
    return json.loads(m.group(0) if m else text)


async def parse_resume(resume_text: str):
    if not resume_text or len(resume_text) < 20:
        return None
    system = ("You extract structured data from resumes for a career-coaching business. "
              "Output STRICT JSON only, no prose, no markdown. Never guess; use null for anything not clearly present.")
    prompt = (
        'Return JSON exactly in this shape:\n'
        '{"first_name":null,"last_name":null,"email":null,"mobile":null,'
        '"education":[],"experience_summary":null,"most_recent_role":null,"years_experience":null}\n'
        "education is a list of short strings. experience_summary is 1-2 sentences. "
        "years_experience is a number or null.\n\nRESUME:\n" + resume_text[:12000]
    )
    try:
        return await _claude_json(system, prompt)
    except Exception as e:
        logger.warning(f"parse_resume failed: {e}")
        return None
