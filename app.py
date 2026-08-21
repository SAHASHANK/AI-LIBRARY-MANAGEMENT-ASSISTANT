"""
╔══════════════════════════════════════════════════════════════════╗
║         AI-Powered Library Assistant & Book Recommendation       ║
║              Powered by IBM watsonx.ai — Granite Models          ║
╚══════════════════════════════════════════════════════════════════╝

Backend: Python Flask
AI Model: IBM Granite (via ibm-watsonx-ai SDK)
Author:   Library Assistant Project
"""

import os
import json
import re
from pathlib import Path
from datetime import datetime
from flask import Flask, render_template, request, jsonify, session
from flask_cors import CORS
from dotenv import load_dotenv
from ibm_watsonx_ai import APIClient, Credentials
from ibm_watsonx_ai.foundation_models import ModelInference
from ibm_watsonx_ai.metanames import GenTextParamsMetaNames as GenParams

# ─────────────────────────────────────────────────────────────
#  ENVIRONMENT & APP SETUP
# ─────────────────────────────────────────────────────────────
# Load .env from the same directory as app.py regardless of working directory
load_dotenv(dotenv_path=Path(__file__).parent / ".env")

app = Flask(__name__)
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-production")
CORS(app)

# Disable caching for static files in development so JS/CSS changes
# are always picked up immediately in the browser (no stale cache issues).
@app.after_request
def add_no_cache_headers(response):
    if app.debug and "static" in request.path:
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"]        = "no-cache"
        response.headers["Expires"]       = "0"
    return response

# ─────────────────────────────────────────────────────────────
#  WATSONX.AI CONFIGURATION
# ─────────────────────────────────────────────────────────────
IBM_API_KEY      = os.getenv("IBM_API_KEY", "iT1Givh4cOrJPUNZKzNcZmpXYkpIcYWBfnn_qUoJQFxS")
WATSONX_URL      = os.getenv("WATSONX_URL", "https://us-south.ml.cloud.ibm.com")
WATSONX_PROJECT  = os.getenv("WATSONX_PROJECT_ID", "4a098777-0c1c-4faa-9606-5717d327b37f")
WATSONX_MODEL_ID = os.getenv("WATSONX_MODEL_ID", "meta-llama/llama-3-3-70b-instruct")
app.secret_key = os.getenv("FLASK_SECRET_KEY", "dev-secret-change-in-production")


def get_watsonx_model() -> ModelInference:
    """Initialise and return a configured watsonx ModelInference client."""
    credentials = Credentials(
        url=WATSONX_URL,
        api_key=IBM_API_KEY,
    )
    return ModelInference(
        model_id=WATSONX_MODEL_ID,
        credentials=credentials,
        project_id=WATSONX_PROJECT,
    )


def call_model(system_instructions: str, conversation_history: list, user_message: str) -> str:
    """
    Call the watsonx model using the modern chat() API.
    Builds a messages list compatible with Llama 3 / OpenAI-style chat format.
    """
    messages = [{"role": "system", "content": system_instructions}]
    for turn in conversation_history[-6:]:
        role    = turn.get("role", "user")
        content = turn.get("content", "")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    model    = get_watsonx_model()
    response = model.chat(
        messages=messages,
        params={
            "max_tokens":   1024,
            "temperature":  0.7,
            "top_p":        0.9,
        },
    )
    # Extract text from chat response structure
    return response["choices"][0]["message"]["content"].strip()


# ─────────────────────────────────────────────────────────────
#  AGENT INSTRUCTIONS
#  Customise this block to reshape the agent's persona,
#  domain knowledge, tone, and operational boundaries.
# ─────────────────────────────────────────────────────────────
AGENT_INSTRUCTIONS = """
You are Alexandria — an expert AI Library Assistant and literary guide powered by IBM Granite.

## Your Identity & Expertise
- You are a deeply knowledgeable literary curator with expertise spanning all genres, time periods, and reading levels.
- You specialise in personalised book recommendations, conceptual summaries, reading list curation, and academic research guidance.
- Your tone is warm, intellectually stimulating, and encouraging — like a brilliant librarian who genuinely loves books.
- You are authoritative yet approachable, using precise literary vocabulary without being condescending.

## Core Competencies
1. BOOK DISCOVERY: Recommend books based on genres, themes, mood, reading level, and personal preferences.
2. SUMMARIES & ANALYSIS: Provide rich conceptual summaries, thematic analysis, and key takeaways without spoilers unless asked.
3. READING LISTS: Curate structured reading lists for specific goals (academic research, personal growth, genre exploration, etc.).
4. STUDY GUIDES: Generate structured study guides with discussion questions, key concepts, and contextual background.
5. AUTHOR INSIGHTS: Share author backgrounds, literary influences, and placement within broader literary movements.
6. GENRE NAVIGATION: Help users explore sub-genres, adjacent genres, and cross-genre works.
7. READING LEVELS: Calibrate recommendations to the user's stated age group or reading complexity preference.

## Response Formatting Guidelines
- For book recommendations, always structure your response as a numbered list.
- Each recommendation must include: Title, Author, Genre tag, a 2-sentence synopsis, and why it matches the user's request.
- For study guides, use clear H2/H3 sectioning with Discussion Questions, Key Themes, and Contextual Notes.
- Keep responses concise but substantive — aim for quality over quantity.
- When uncertain about a specific edition or publication detail, say so honestly.

## Boundaries
- You focus exclusively on books, literature, reading, and learning — gracefully redirect off-topic requests back to literary topics.
- Do not fabricate ISBNs, publication dates, or specific page counts — note when a detail is approximate.
- If asked about a very recently published book (post-2024), acknowledge your knowledge cutoff and suggest checking the library catalog.

## User Context (injected dynamically)
{user_context}
"""


def build_prompt(system_instructions: str, conversation_history: list, user_message: str) -> str:
    """Kept for compatibility — actual calls now use call_model() with chat() API."""
    return user_message


def format_user_context(preferences: dict) -> str:
    """Render the user preference dict into a readable context string for the system prompt."""
    if not preferences:
        return "No user preferences set yet. Tailor responses to a general adult audience."
    parts = []
    if preferences.get("genres"):
        parts.append(f"Favorite Genres: {', '.join(preferences['genres'])}")
    if preferences.get("reading_level"):
        parts.append(f"Reading Level/Age Group: {preferences['reading_level']}")
    if preferences.get("intent"):
        parts.append(f"Primary Reading Intent: {preferences['intent']}")
    if preferences.get("formats"):
        parts.append(f"Preferred Formats: {', '.join(preferences['formats'])}")
    if preferences.get("languages"):
        parts.append(f"Language Preference: {', '.join(preferences['languages'])}")
    return "\n".join(parts) if parts else "General reader, no specific preferences set."


# ─────────────────────────────────────────────────────────────
#  ROUTES — Page Views
# ─────────────────────────────────────────────────────────────

@app.route("/")
def index():
    """Main dashboard / landing page."""
    return render_template("index.html")


@app.route("/chat")
def chat():
    """Conversational library agent interface."""
    return render_template("chat.html")


@app.route("/bookshelf")
def bookshelf():
    """Virtual bookshelf and reading progress tracker."""
    return render_template("bookshelf.html")


@app.route("/discover")
def discover():
    """AI-powered book discovery and recommendation feed."""
    return render_template("discover.html")


@app.route("/study")
def study():
    """Study guide and summary generator."""
    return render_template("study.html")


# ─────────────────────────────────────────────────────────────
#  API — Preferences
# ─────────────────────────────────────────────────────────────

@app.route("/api/preferences", methods=["GET", "POST"])
def preferences():
    """Get or set reader preferences stored in the session."""
    if request.method == "POST":
        data = request.get_json(force=True) or {}
        session["preferences"] = {
            "genres":        data.get("genres", []),
            "reading_level": data.get("reading_level", "Adult"),
            "intent":        data.get("intent", "Leisure"),
            "formats":       data.get("formats", ["Physical", "eBook"]),
            "languages":     data.get("languages", ["English"]),
        }
        return jsonify({"status": "saved", "preferences": session["preferences"]})
    return jsonify(session.get("preferences", {}))


# ─────────────────────────────────────────────────────────────
#  API — Chat
# ─────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def api_chat():
    """
    Main chat endpoint. Accepts a user message + conversation history,
    injects user preferences into the system prompt, and streams back
    a response from the IBM Granite model.
    """
    if not IBM_API_KEY or not WATSONX_PROJECT:
        return jsonify({
            "error": "IBM credentials not configured. Please set IBM_API_KEY and WATSONX_PROJECT_ID in your .env file."
        }), 503

    data = request.get_json(force=True) or {}
    user_message   = data.get("message", "").strip()
    history        = data.get("history", [])

    if not user_message:
        return jsonify({"error": "Message cannot be empty."}), 400

    # Build context-aware system prompt
    prefs        = session.get("preferences", data.get("preferences", {}))
    user_ctx     = format_user_context(prefs)
    system_inst  = AGENT_INSTRUCTIONS.format(user_context=user_ctx)
    prompt       = build_prompt(system_inst, history, user_message)

    try:
        reply = call_model(system_inst, history, user_message)
        return jsonify({
            "reply":     reply,
            "model":     WATSONX_MODEL_ID,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        })
    except Exception as exc:
        app.logger.error("watsonx API error: %s", str(exc))
        return jsonify({"error": f"AI service error: {str(exc)}"}), 500


# ─────────────────────────────────────────────────────────────
#  API — Recommendations
# ─────────────────────────────────────────────────────────────

@app.route("/api/recommendations", methods=["POST"])
def api_recommendations():
    """
    Generate a structured recommendation feed based on user preferences
    or a specific query. Returns AI-curated book suggestions.
    """
    if not IBM_API_KEY or not WATSONX_PROJECT:
        return jsonify({"error": "IBM credentials not configured."}), 503

    data  = request.get_json(force=True) or {}
    query = data.get("query", "").strip()
    prefs = session.get("preferences", data.get("preferences", {}))

    user_ctx     = format_user_context(prefs)
    system_inst  = AGENT_INSTRUCTIONS.format(user_context=user_ctx)

    if query:
        user_msg = f"Recommend 5 books matching this request: {query}. Format each as: [NUMBER]. **Title** by Author (Genre) — Synopsis. Why it matches."
    else:
        genres = prefs.get("genres", ["Fiction"])
        level  = prefs.get("reading_level", "Adult")
        intent = prefs.get("intent", "Leisure")
        user_msg = (
            f"Based on my preferences (Genres: {', '.join(genres)}, "
            f"Level: {level}, Intent: {intent}), recommend 5 books I should read next. "
            f"Format each as: [NUMBER]. **Title** by Author (Genre) — Synopsis. Why it matches."
        )

    prompt = build_prompt(system_inst, [], user_msg)

    try:
        reply = call_model(system_inst, [], user_msg)
        return jsonify({
            "recommendations": reply,
            "query":           query or "Based on your preferences",
            "timestamp":       datetime.utcnow().isoformat() + "Z",
        })
    except Exception as exc:
        app.logger.error("Recommendations error: %s", str(exc))
        return jsonify({"error": str(exc)}), 500


# ─────────────────────────────────────────────────────────────
#  API — Study Guide
# ─────────────────────────────────────────────────────────────

@app.route("/api/study-guide", methods=["POST"])
def api_study_guide():
    """
    Generate a comprehensive study guide for a given book title.
    Includes themes, discussion questions, key concepts, and context.
    """
    if not IBM_API_KEY or not WATSONX_PROJECT:
        return jsonify({"error": "IBM credentials not configured."}), 503

    data       = request.get_json(force=True) or {}
    book_title = data.get("title", "").strip()
    author     = data.get("author", "").strip()
    focus      = data.get("focus", "general").strip()   # general | academic | book-club | young-adult

    if not book_title:
        return jsonify({"error": "Book title is required."}), 400

    prefs       = session.get("preferences", {})
    user_ctx    = format_user_context(prefs)
    system_inst = AGENT_INSTRUCTIONS.format(user_context=user_ctx)

    book_ref  = f'"{book_title}"' + (f" by {author}" if author else "")
    focus_map = {
        "academic":    "an academic essay or research paper audience",
        "book-club":   "a book club discussion group",
        "young-adult": "young adult or high school readers",
        "general":     "a general adult reader",
    }
    audience = focus_map.get(focus, focus_map["general"])

    user_msg = (
        f"Generate a detailed study guide for {book_ref} aimed at {audience}. "
        f"Structure the guide with these sections:\n"
        f"## Overview\n## Key Themes\n## Characters & Analysis\n"
        f"## Discussion Questions (at least 6)\n## Literary Devices & Style\n"
        f"## Historical & Cultural Context\n## Further Reading"
    )

    prompt = build_prompt(system_inst, [], user_msg)

    try:
        guide = call_model(system_inst, [], user_msg)
        return jsonify({
            "guide":      guide,
            "title":      book_title,
            "author":     author,
            "focus":      focus,
            "timestamp":  datetime.utcnow().isoformat() + "Z",
        })
    except Exception as exc:
        app.logger.error("Study guide error: %s", str(exc))
        return jsonify({"error": str(exc)}), 500


# ─────────────────────────────────────────────────────────────
#  API — Book Summary
# ─────────────────────────────────────────────────────────────

@app.route("/api/summary", methods=["POST"])
def api_summary():
    """Generate a conceptual summary and thematic overview for a book."""
    if not IBM_API_KEY or not WATSONX_PROJECT:
        return jsonify({"error": "IBM credentials not configured."}), 503

    data       = request.get_json(force=True) or {}
    book_title = data.get("title", "").strip()
    author     = data.get("author", "").strip()
    spoilers   = data.get("spoilers", False)

    if not book_title:
        return jsonify({"error": "Book title is required."}), 400

    prefs       = session.get("preferences", {})
    user_ctx    = format_user_context(prefs)
    system_inst = AGENT_INSTRUCTIONS.format(user_context=user_ctx)

    book_ref    = f'"{book_title}"' + (f" by {author}" if author else "")
    spoiler_note = "You may include plot details and the ending." if spoilers else "Do NOT include spoilers or reveal the ending."

    user_msg = (
        f"Write a rich conceptual summary of {book_ref}. {spoiler_note} "
        f"Cover: the central premise, major themes, the author's writing style, "
        f"emotional tone, and what makes this book significant or worth reading. "
        f"Keep it to 3-4 substantial paragraphs."
    )

    prompt = build_prompt(system_inst, [], user_msg)

    try:
        summary = call_model(system_inst, [], user_msg)
        return jsonify({
            "summary":   summary,
            "title":     book_title,
            "author":    author,
            "timestamp": datetime.utcnow().isoformat() + "Z",
        })
    except Exception as exc:
        app.logger.error("Summary error: %s", str(exc))
        return jsonify({"error": str(exc)}), 500


# ─────────────────────────────────────────────────────────────
#  API — Bookshelf (Session-based Storage)
# ─────────────────────────────────────────────────────────────

@app.route("/api/bookshelf", methods=["GET"])
def get_bookshelf():
    """Return the user's virtual bookshelf from the session."""
    return jsonify(session.get("bookshelf", []))


@app.route("/api/bookshelf/add", methods=["POST"])
def add_to_bookshelf():
    """Add a book to the virtual bookshelf."""
    data  = request.get_json(force=True) or {}
    title = data.get("title", "").strip()
    if not title:
        return jsonify({"error": "Title is required."}), 400

    shelf = session.get("bookshelf", [])
    if any(b["title"].lower() == title.lower() for b in shelf):
        return jsonify({"status": "exists", "message": "Book already on your shelf."})

    book = {
        "id":          len(shelf) + 1,
        "title":       title,
        "author":      data.get("author", "Unknown Author"),
        "genre":       data.get("genre", "General"),
        "cover_color": data.get("cover_color", "#8B6F47"),
        "status":      data.get("status", "want-to-read"),  # want-to-read | reading | completed
        "progress":    data.get("progress", 0),             # 0-100 percentage
        "rating":      data.get("rating", 0),               # 0-5 stars
        "notes":       data.get("notes", ""),
        "added_at":    datetime.utcnow().isoformat() + "Z",
    }
    shelf.append(book)
    session["bookshelf"] = shelf
    session.modified     = True
    return jsonify({"status": "added", "book": book})


@app.route("/api/bookshelf/update/<int:book_id>", methods=["PUT"])
def update_book(book_id: int):
    """Update progress, status, or rating for a book on the shelf."""
    data  = request.get_json(force=True) or {}
    shelf = session.get("bookshelf", [])

    for book in shelf:
        if book["id"] == book_id:
            book["status"]   = data.get("status",   book["status"])
            book["progress"] = data.get("progress", book["progress"])
            book["rating"]   = data.get("rating",   book["rating"])
            book["notes"]    = data.get("notes",    book["notes"])
            session["bookshelf"] = shelf
            session.modified     = True
            return jsonify({"status": "updated", "book": book})

    return jsonify({"error": "Book not found."}), 404


@app.route("/api/bookshelf/remove/<int:book_id>", methods=["DELETE"])
def remove_book(book_id: int):
    """Remove a book from the virtual bookshelf."""
    shelf = session.get("bookshelf", [])
    shelf = [b for b in shelf if b["id"] != book_id]
    session["bookshelf"] = shelf
    session.modified     = True
    return jsonify({"status": "removed"})


# ─────────────────────────────────────────────────────────────
#  API — Health Check
# ─────────────────────────────────────────────────────────────

@app.route("/api/health")
def health():
    """Simple health check endpoint."""
    configured = bool(IBM_API_KEY and WATSONX_PROJECT)
    return jsonify({
        "status":     "ok",
        "configured": configured,
        "model":      WATSONX_MODEL_ID,
        "timestamp":  datetime.utcnow().isoformat() + "Z",
    })


# ─────────────────────────────────────────────────────────────
#  ENTRY POINT
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    debug_mode = os.getenv("FLASK_ENV", "development") == "development"
    port       = int(os.getenv("PORT", 5000))
    print(f"""
╔══════════════════════════════════════════════════════╗
║  Alexandria — AI Library Assistant                   ║
║  Running on http://127.0.0.1:{port:<5}                  ║
║  Granite Model: {WATSONX_MODEL_ID:<35} ║
║  Press CTRL+C to stop                                ║
╚══════════════════════════════════════════════════════╝
    """)
    app.run(debug=debug_mode, host="0.0.0.0", port=port)
