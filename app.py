import streamlit as st
import fitz  # PyMuPDF
import google.generativeai as genai
import requests
import time
import json

# -------------------- UI CONFIG --------------------
st.set_page_config(
    page_title="PDF to Quiz Generator",
    page_icon="📘",
    layout="centered"
)

st.title("📘 PDF to Quiz Generator")
st.caption("Upload a PDF → Generate Quiz Questions using Google Gemini")

# -------------------- 🔴 PLACEHOLDER 1 --------------------
# CHANGE THIS IN STREAMLIT SECRETS (NOT HERE)
# GEMINI_API_KEY = "PASTE_YOUR_API_KEY"
# HF_API_KEY = "PASTE_YOUR_HUGGINGFACE_KEY"
# ----------------------------------------------------

# -------------------- LOAD API KEYS SAFELY --------------------
try:
    GEMINI_API_KEY = st.secrets["GEMINI_API_KEY"]
    HF_API_KEY = st.secrets["HF_API_KEY"]
    genai.configure(api_key=GEMINI_API_KEY)
except Exception as e:
    st.error("❌ API keys not found. Add them in Streamlit Secrets.")
    st.stop()

# -------------------- FUNCTIONS --------------------

def extract_text_from_pdf(pdf_file):
    text = ""
    pdf = fitz.open(stream=pdf_file.read(), filetype="pdf")
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


# -------------------- GEMINI FUNCTION --------------------
def gemini_generate(chunk):
    model = genai.GenerativeModel("gemini-1.5-flash")
    prompt = f"""
You are an exam question generator.

From the text below, generate 3 multiple-choice questions.
Each question must have:
- question
- 4 options
- correct_answer

Return STRICT JSON format like:
[
  {{
    "question": "",
    "options": ["", "", "", ""],
    "correct_answer": ""
  }}
]

TEXT:
{chunk}
"""
    response = model.generate_content(prompt)
    return response.text


# -------------------- HUGGINGFACE FALLBACK FUNCTION --------------------
def hf_generate(chunk):
    API_URL = "https://api-inference.huggingface.co/models/google/flan-t5-large"
    headers = {"Authorization": f"Bearer {HF_API_KEY}"}
    payload = {
        "inputs": f"""
You are an exam question generator.

From the text below, generate 3 multiple-choice questions.
Each question must have:
- question
- 4 options
- correct_answer

Return STRICT JSON format like:
[
  {{
    "question": "",
    "options": ["", "", "", ""],
    "correct_answer": ""
  }}
]

TEXT:
{chunk}
"""
    }
    response = requests.post(API_URL, headers=headers, json=payload)
    response.raise_for_status()
    return json.loads(response.json()[0]["generated_text"])


# -------------------- SMART AUTO-FALLBACK --------------------
def generate_questions(chunks):
    questions = []

    progress = st.progress(0)
    status = st.empty()

    for i, chunk in enumerate(chunks):
        status.info(f"Processing chunk {i+1}/{len(chunks)}")

        try:
            st.info("⚡ Using Gemini AI...")
            text = gemini_generate(chunk)
            parsed = json.loads(text)
            questions.extend(parsed)

        except Exception as e:
            st.warning("⚠️ Gemini failed. Switching to HuggingFace backup AI...")
            st.error(str(e))
            try:
                parsed = hf_generate(chunk)
                questions.extend(parsed)
            except Exception as hf_error:
                st.error(f"❌ HuggingFace also failed: {str(hf_error)}")

        progress.progress((i + 1) / len(chunks))
        time.sleep(0.1)

    return questions


# -------------------- UI FLOW --------------------

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

            # Show preview
            st.subheader("📝 Preview Questions")
            for i, q in enumerate(questions[:5]):
                st.markdown(f"**Q{i+1}: {q['question']}**")
                for opt in q["options"]:
                    st.markdown(f"- {opt}")
                st.markdown(f"✅ Correct: `{q['correct_answer']}`")
                st.divider()

            st.info("ℹ️ Google Form creation can be added next.")

        except Exception as e:
            st.error(f"🔥 Exact Error: {str(e)}")
