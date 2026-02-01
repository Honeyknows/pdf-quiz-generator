import streamlit as st
import fitz  # PyMuPDF
import google.generativeai as genai
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
# ----------------------------------------------------

# -------------------- LOAD API KEY SAFELY --------------------
try:
    GEMINI_API_KEY = st.secrets["GEMINI_API_KEY"]
    genai.configure(api_key=GEMINI_API_KEY)
except Exception as e:
    st.error("❌ Gemini API key not found. Add it in Streamlit Secrets.")
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


def generate_questions(chunks):
    model = genai.GenerativeModel("gemini-1.5-flash")

    questions = []

    progress = st.progress(0)
    status = st.empty()

    for i, chunk in enumerate(chunks):
        status.warning(f"🧠 Generating questions from chunk {i+1}/{len(chunks)}")

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

        try:
            parsed = json.loads(response.text)
            questions.extend(parsed)
        except:
            st.error("❌ Failed to parse AI response. Skipping this chunk.")

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

            with st.spinner("🧠 Generating quiz questions using Gemini..."):
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
