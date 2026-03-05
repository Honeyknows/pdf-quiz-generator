import streamlit as st
import fitz
import google.generativeai as genai
import requests
import time
import json
import re
from io import BytesIO

st.set_page_config(
    page_title="PDF to Quiz Generator",
    page_icon="📘",
    layout="centered"
)

st.title("📘 PDF to Quiz Generator")
st.caption("Upload a PDF → Generate Quiz Questions using Google Gemini")

GEMINI_API_KEY = st.secrets.get("GEMINI_API_KEY")
HF_API_KEY = st.secrets.get("HF_API_KEY") 

if not GEMINI_API_KEY:
    st.error("❌ GEMINI_API_KEY not found. Add it in Streamlit Secrets.")
    st.stop()

genai.configure(api_key=GEMINI_API_KEY)

try:
    GEMINI_MODEL = genai.GenerativeModel("gemini-pro")
except Exception:
    GEMINI_MODEL = None


def extract_text_from_pdf(pdf_file):
    text = ""
    pdf_bytes = pdf_file.read()
    pdf = fitz.open(stream=pdf_bytes, filetype="pdf")
    total_pages = len(pdf)

    progress = st.progress(0)
    status = st.empty()

    for i, page in enumerate(pdf):
        status.info(f"📄 Reading page {i+1} of {total_pages}")
        text += page.get_text()
        progress.progress((i + 1) / total_pages)
        time.sleep(0.05)

    return text


def chunk_text(text, chunk_size=3000):
    return [text[i:i+chunk_size] for i in range(0, len(text), chunk_size)]


def gemini_generate(chunk):
    if GEMINI_MODEL is None:
        raise RuntimeError("Gemini model unavailable")

    prompt = f"""
You are an exam question generator.

From the text below, generate 3 multiple-choice questions.
Each question must have:
- question
- 4 options
- correct_answer

Return ONLY a JSON array (no surrounding text). Example:
[
  {
    "question": "",
    "options": ["", "", "", ""],
    "correct_answer": ""
  }
]

TEXT:
{chunk}
"""
    response = GEMINI_MODEL.generate_content(prompt)
    text = getattr(response, "text", None) or getattr(response, "content", None) or str(response)
    return text


def hf_generate(chunk):
    if not HF_API_KEY:
        raise RuntimeError("HF API key not configured for fallback")

    API_URL = "https://router.huggingface.co/v1"
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {
        "inputs": f"""
You are an exam question generator.

From the text below, generate 3 multiple-choice questions.
Each question must have:
- question
- 4 options
- correct_answer

Return ONLY a JSON array (no surrounding text).

TEXT:
{chunk}
"""
    }

    resp = requests.post(API_URL, headers=headers, json=payload, timeout=60)
    resp.raise_for_status()

    resp_json = resp.json()

    if isinstance(resp_json, list) and len(resp_json) and isinstance(resp_json[0], dict):
        gen_text = resp_json[0].get("generated_text", "")
    elif isinstance(resp_json, dict) and "generated_text" in resp_json:
        gen_text = resp_json.get("generated_text", "")
    else:
        gen_text = resp.text


    try:
        return json.loads(gen_text)
    except Exception:
        m = re.search(r"(\[\s*\{.*?\}\s*\])", gen_text, re.S)
        if m:
            return json.loads(m.group(1))

        return gen_text


def generate_questions(chunks):
    questions = []

    progress = st.progress(0)
    status = st.empty()

    for i, chunk in enumerate(chunks):
        status.info(f"Processing chunk {i+1}/{len(chunks)}")

        # try Gemini first
        try:
            st.info("⚡ Using Gemini AI...")
            text = gemini_generate(chunk)
            try:
                parsed = json.loads(text)
            except Exception:

                m = re.search(r"(\[\s*\{.*?\}\s*\])", text, re.S)
                if m:
                    parsed = json.loads(m.group(1))
                else:
 
                    st.error("Gemini raw response (non-JSON):")
                    st.code(text[:1000])
                    raise

            if isinstance(parsed, list):
                for item in parsed:
                    if isinstance(item, dict):
                        questions.append(item)
                    elif isinstance(item, str):
                        try:
                            maybe = json.loads(item)
                            if isinstance(maybe, dict):
                                questions.append(maybe)
                                continue
                        except Exception:
                            pass

                        questions.append({"question": item, "options": [], "correct_answer": ""})
            else:
                raise ValueError("Parsed Gemini output is not a list")

        except Exception as e:
            st.warning("⚠️ Gemini failed. Switching to HuggingFace backup AI...")
            st.error(str(e))
            if HF_API_KEY:
                try:
                    parsed = hf_generate(chunk)
                    if isinstance(parsed, list):
                        questions.extend(parsed)
                except Exception as hf_error:
                    st.error(f"❌ HuggingFace also failed: {str(hf_error)}")
            else:
                st.error("❌ No HuggingFace API key configured for fallback.")

        progress.progress((i + 1) / len(chunks))
        time.sleep(0.1)

    return questions



uploaded_file = st.file_uploader("📂 Upload your PDF", type=["pdf"])

if uploaded_file:
    st.success("✅ PDF uploaded successfully")

    if st.button("🚀 Generate Quiz"):
        try:
            with st.spinner("⏳ Extracting text from PDF..."):
                text = extract_text_from_pdf(uploaded_file)

            if len(text) < 500:
                st.error("❌ PDF text too short or unreadable.")
                st.stop()

            chunks = chunk_text(text)

            with st.spinner("🧠 Generating quiz questions..."):
                questions = generate_questions(chunks)

            st.success(f"🎉 Generated {len(questions)} questions")


            st.subheader("📝 Preview Questions")
            for i, q in enumerate(questions[:5]):
                question_text = q.get("question", "")
                options = q.get("options", [])
                correct = q.get("correct_answer", "")

                st.markdown(f"**Q{i+1}: {question_text}**")
                for opt in options:
                    st.markdown(f"- {opt}")
                st.markdown(f"✅ Correct: `{correct}`")
                st.divider()

            st.info("ℹ️ Google Form creation can be added next.")

        except Exception as e:
            st.error(f"🔥 Exact Error: {str(e)}")

