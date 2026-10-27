"""
LegacyLens AI: Codebase Modernization & Documentation Engine
Interactive Streamlit Frontend with AST Inspector, Mermaid.js Architecture Visualizer,
and Grounded Code-RAG Chat.
"""

from __future__ import annotations

import os
import sys
import tempfile
import streamlit as st
import streamlit.components.v1 as components
import pandas as pd

# Add workspace directory to python path for modular imports
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from pipeline.ingestor import (
    CodeFile,
    IngestionResult,
    ingest_source,
    ingest_raw_code,
)
from pipeline.ast_chunker import (
    ASTChunk,
    parse_codebase_to_chunks,
    pack_to_xml,
)
from engine.rag_store import (
    CodeRAGStore,
    get_rag_store,
    index_ast_chunks,
    query_codebase,
)
from engine.modernizer import (
    CodeModernizationOutput,
    modernize_codebase,
    sanitize_mermaid_code,
)

# ---------------------------------------------------------
# Page Configuration & Styling
# ---------------------------------------------------------
st.set_page_config(
    page_title="LegacyLens AI | Modernization Engine",
    page_icon="🔍",
    layout="wide",
    initial_sidebar_state="expanded",
)

# Custom High-Aesthetic Styling
st.markdown(
    """
    <style>
    /* Gradient Headers and Glass Cards */
    .main-header {
        font-size: 2.2rem;
        font-weight: 800;
        background: linear-gradient(120deg, #60a5fa, #a78bfa, #f472b6);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        color: #94a3b8;
        font-size: 1.05rem;
        margin-bottom: 1.5rem;
    }
    .metric-card {
        background: rgba(30, 41, 59, 0.7);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 1.2rem;
        text-align: center;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    }
    .metric-value {
        font-size: 2.0rem;
        font-weight: 700;
        color: #38bdf8;
    }
    .metric-label {
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #94a3b8;
        margin-top: 0.2rem;
    }
    .badge {
        display: inline-block;
        padding: 0.25rem 0.6rem;
        border-radius: 9999px;
        font-size: 0.75rem;
        font-weight: 600;
        margin-right: 0.4rem;
    }
    .badge-func { background: #1e3a8a; color: #93c5fd; border: 1px solid #3b82f6; }
    .badge-class { background: #4c1d95; color: #d8b4fe; border: 1px solid #8b5cf6; }
    .badge-mod { background: #064e3b; color: #6ee7b7; border: 1px solid #10b981; }
    .stTabs [data-baseweb="tab-list"] {
        gap: 8px;
    }
    .stTabs [data-baseweb="tab"] {
        border-radius: 8px 8px 0px 0px;
        padding: 10px 20px;
        font-weight: 600;
    }
    </style>
    """,
    unsafe_allow_html=True,
)

# ---------------------------------------------------------
# Session State Initialization
# ---------------------------------------------------------
if "ingestion_result" not in st.session_state:
    st.session_state.ingestion_result = None
if "ast_chunks" not in st.session_state:
    st.session_state.ast_chunks = []
if "vectors_indexed" not in st.session_state:
    st.session_state.vectors_indexed = 0
if "modernization_output" not in st.session_state:
    st.session_state.modernization_output = None
if "chat_history" not in st.session_state:
    st.session_state.chat_history = []
if "raw_code_input" not in st.session_state:
    st.session_state.raw_code_input = ""

# ---------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------
def render_mermaid(diagram_code: str, height: int = 420):
    """Renders a Mermaid.js diagram inside an iframe using official CDN."""
    cleaned = sanitize_mermaid_code(diagram_code)
    html_code = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body {{
          margin: 0;
          padding: 16px;
          background-color: #0f172a;
          color: #e2e8f0;
          font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 100vh;
        }}
        .mermaid {{
          width: 100%;
          text-align: center;
        }}
      </style>
      <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({{
          startOnLoad: true,
          theme: 'dark',
          themeVariables: {{
            darkMode: true,
            background: '#0f172a',
            primaryColor: '#3b82f6',
            primaryTextColor: '#f8fafc',
            primaryBorderColor: '#60a5fa',
            lineColor: '#94a3b8',
            secondaryColor: '#8b5cf6',
            tertiaryColor: '#1e293b'
          }}
        }});
      </script>
    </head>
    <body>
      <div class="mermaid">
{cleaned}
      </div>
    </body>
    </html>
    """
    components.html(html_code, height=height, scrolling=True)


# ---------------------------------------------------------
# Sidebar Configuration
# ---------------------------------------------------------
with st.sidebar:
    st.image(
        "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=400&q=80",
        caption="LegacyLens AI Engine",
        use_container_width=True,
    )
    st.markdown("### ⚙️ Engine Settings")

    api_key_input = st.text_input(
        "Gemini API Key",
        value=os.getenv("GEMINI_API_KEY", ""),
        type="password",
        help="Enter your Google AI Studio Gemini API Key. If empty, runs in offline demonstration mode.",
    )

    model_choice = st.selectbox(
        "Gemini Model",
        options=["gemini-2.5-pro", "gemini-2.5-flash"],
        index=0,
        help="gemini-2.5-pro recommended for long-context architecture analysis and refactoring.",
    )

    st.markdown("---")
    st.markdown("### 📥 Source Code Ingestion")

    input_mode = st.radio(
        "Select Input Mode:",
        options=[
            "Load Sample Legacy Code",
            "Paste Raw Code",
            "Clone GitHub Repo URL",
            "Upload Code / Zip",
        ],
        index=0,
    )

    source_path_or_text = ""
    uploaded_bytes = None

    if input_mode == "Load Sample Legacy Code":
        sample_path = os.path.join(CURRENT_DIR, "sample_legacy_code.py")
        if os.path.exists(sample_path):
            with open(sample_path, "r", encoding="utf-8") as sf:
                sample_preview = sf.read()
            st.info(f"Loaded `sample_legacy_code.py` ({len(sample_preview.splitlines())} lines).")
            source_path_or_text = sample_path
        else:
            st.error("sample_legacy_code.py not found in workspace.")

    elif input_mode == "Paste Raw Code":
        source_path_or_text = st.text_area(
            "Paste Legacy Code Here:",
            height=200,
            value=st.session_state.raw_code_input,
            placeholder="def old_function(x, y=[]):\n    # messy legacy code\n    pass",
        )
        st.session_state.raw_code_input = source_path_or_text

    elif input_mode == "Clone GitHub Repo URL":
        source_path_or_text = st.text_input(
            "Public GitHub Repo URL:",
            placeholder="https://github.com/username/legacy-repo.git",
        )

    elif input_mode == "Upload Code / Zip":
        uploaded_file = st.file_uploader(
            "Upload .py, .js, .ts, or .zip archive",
            type=["py", "js", "ts", "java", "cpp", "sql", "zip"],
        )
        if uploaded_file:
            uploaded_bytes = uploaded_file.read()
            source_path_or_text = uploaded_file.name

    st.markdown("---")
    run_pipeline_btn = st.button(
        "🚀 Run Ingestion & AST Pipeline",
        type="primary",
        use_container_width=True,
    )

# ---------------------------------------------------------
# Pipeline Execution Trigger
# ---------------------------------------------------------
if run_pipeline_btn:
    progress_bar = st.progress(0, text="Initiating Data Pipeline...")

    try:
        # Stage 1: Ingestion & Noise Filtering
        progress_bar.progress(20, text="Stage 1: Ingesting source code and filtering junk files...")
        if input_mode == "Load Sample Legacy Code":
            ingestion_res = ingest_source("sample", source_path_or_text)
        elif input_mode == "Paste Raw Code":
            if not source_path_or_text.strip():
                st.error("Please paste code before running the pipeline.")
                st.stop()
            ingestion_res = ingest_source("raw", source_path_or_text)
        elif input_mode == "Clone GitHub Repo URL":
            if not source_path_or_text.strip():
                st.error("Please provide a valid GitHub URL.")
                st.stop()
            ingestion_res = ingest_source("github", source_path_or_text)
        elif input_mode == "Upload Code / Zip":
            if not uploaded_bytes:
                st.error("Please upload a file first.")
                st.stop()
            if source_path_or_text.endswith(".zip"):
                ingestion_res = ingest_source("zip", uploaded_bytes)
            else:
                ingestion_res = ingest_raw_code(
                    uploaded_bytes.decode("utf-8", errors="replace"),
                    filename=source_path_or_text,
                )

        st.session_state.ingestion_result = ingestion_res

        # Stage 2: AST-Based Syntax-Aware Chunking
        progress_bar.progress(50, text="Stage 2: Parsing Abstract Syntax Tree (AST) & extracting nodes...")
        chunks = parse_codebase_to_chunks(ingestion_res.files)
        st.session_state.ast_chunks = chunks

        # Stage 3: Vector Store Indexing
        progress_bar.progress(80, text="Stage 3: Embedding chunks & indexing into ChromaDB...")
        store = get_rag_store()
        store.reset_collection()
        indexed_count = store.index_chunks(chunks, api_key=api_key_input)
        st.session_state.vectors_indexed = indexed_count

        progress_bar.progress(100, text="Pipeline complete!")
        st.success(
            f"Successfully ingested {len(ingestion_res.files)} code file(s), "
            f"extracted {len(chunks)} AST node chunks, and indexed {indexed_count} vectors into ChromaDB!"
        )

    except Exception as e:
        progress_bar.empty()
        st.error(f"Pipeline error: {str(e)}")

# ---------------------------------------------------------
# Main Dashboard UI Layout
# ---------------------------------------------------------
st.markdown('<div class="main-header">LegacyLens AI</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="sub-header">Codebase Modernization, AST Intelligence & Grounded Architecture Engine</div>',
    unsafe_allow_html=True,
)

# Tabs Navigation
tab1, tab2, tab3 = st.tabs([
    "📊 Tab 1: Pipeline & AST Inspector",
    "✨ Tab 2: Codebase Modernization (Long-Context)",
    "💬 Tab 3: Chat with Codebase (AST-RAG)",
])

# =========================================================
# TAB 1: PIPELINE & AST INSPECTOR
# =========================================================
with tab1:
    st.subheader("Codebase Ingestion & AST Decomposition Telemetry")

    # Metrics Summary Row
    m1, m2, m3, m4 = st.columns(4)
    scanned_count = len(st.session_state.ingestion_result.files) if st.session_state.ingestion_result else 0
    ast_count = len(st.session_state.ast_chunks)
    vectors_count = st.session_state.vectors_indexed
    funcs_classes = sum(1 for c in st.session_state.ast_chunks if c.node_type in ("function", "class"))

    with m1:
        st.markdown(
            f'<div class="metric-card"><div class="metric-value">{scanned_count}</div>'
            f'<div class="metric-label">Code Files Scanned</div></div>',
            unsafe_allow_html=True,
        )
    with m2:
        st.markdown(
            f'<div class="metric-card"><div class="metric-value">{ast_count}</div>'
            f'<div class="metric-label">AST Chunks Extracted</div></div>',
            unsafe_allow_html=True,
        )
    with m3:
        st.markdown(
            f'<div class="metric-card"><div class="metric-value">{funcs_classes}</div>'
            f'<div class="metric-label">Functions & Classes</div></div>',
            unsafe_allow_html=True,
        )
    with m4:
        st.markdown(
            f'<div class="metric-card"><div class="metric-value">{vectors_count}</div>'
            f'<div class="metric-label">ChromaDB Vectors</div></div>',
            unsafe_allow_html=True,
        )

    st.markdown("<br>", unsafe_allow_html=True)

    if not st.session_state.ast_chunks:
        st.info("👈 Run the Ingestion & AST Pipeline from the sidebar to inspect extracted syntax chunks.")
    else:
        # Table of AST Chunks
        st.markdown("#### 🌲 Extracted AST Semantic Chunks")
        table_rows = []
        for i, c in enumerate(st.session_state.ast_chunks, 1):
            table_rows.append({
                "#": i,
                "Node Type": c.node_type,
                "Node Name": c.node_name,
                "File Path": c.file_path,
                "Start Line": c.start_line,
                "End Line": c.end_line,
                "Lines of Code": (c.end_line - c.start_line) + 1,
                "Language": c.language,
            })
        df_chunks = pd.DataFrame(table_rows)
        st.dataframe(df_chunks, use_container_width=True, hide_index=True)

        # Chunk Code Viewer
        st.markdown("#### 🔍 Chunk Code Inspector")
        selected_chunk_idx = st.selectbox(
            "Select an AST chunk to preview source & metadata:",
            options=range(len(st.session_state.ast_chunks)),
            format_func=lambda idx: (
                f"[{st.session_state.ast_chunks[idx].node_type.upper()}] "
                f"{st.session_state.ast_chunks[idx].node_name} "
                f"({st.session_state.ast_chunks[idx].file_path}:{st.session_state.ast_chunks[idx].start_line}-{st.session_state.ast_chunks[idx].end_line})"
            ),
        )

        chosen_chunk = st.session_state.ast_chunks[selected_chunk_idx]
        col_c1, col_c2 = st.columns([1, 2])
        with col_c1:
            st.markdown(f"**Chunk ID:** `{chosen_chunk.chunk_id}`")
            st.markdown(f"**Node Type:** `{chosen_chunk.node_type}`")
            st.markdown(f"**Node Name:** `{chosen_chunk.node_name}`")
            st.markdown(f"**File:** `{chosen_chunk.file_path}`")
            st.markdown(f"**Line Range:** `{chosen_chunk.start_line}` – `{chosen_chunk.end_line}`")
            if chosen_chunk.imports:
                st.markdown(f"**Imports Context:** `{chosen_chunk.imports}`")
        with col_c2:
            st.code(chosen_chunk.code, language=chosen_chunk.language)

        with st.expander("📦 View Full Hierarchical XML Codebase Pack (for Gemini Long-Context)"):
            xml_preview = pack_to_xml(st.session_state.ast_chunks)
            st.code(xml_preview, language="xml")

# =========================================================
# TAB 2: FULL CODEBASE MODERNIZATION
# =========================================================
with tab2:
    st.subheader("Architectural Modernization & Structured Generation")
    st.markdown(
        "Execute deep long-context reasoning over the ingested AST chunks using Gemini "
        "to generate architectural summaries, Mermaid.js data flowcharts, tech debt audits, "
        "type-annotated PEP-8 code, and a runnable pytest suite."
    )

    if not st.session_state.ast_chunks:
        st.warning("Please run the Ingestion & AST Pipeline in the sidebar first.")
    else:
        btn_col, _ = st.columns([1, 3])
        with btn_col:
            trigger_modernization = st.button(
                "⚡ Modernize Codebase Now",
                type="primary",
                use_container_width=True,
            )

        if trigger_modernization:
            with st.spinner("Analyzing codebase architecture with Gemini long-context & validating syntax..."):
                mod_result = modernize_codebase(
                    ingestion_result=st.session_state.ingestion_result,
                    chunks=st.session_state.ast_chunks,
                    api_key=api_key_input,
                    model_name=model_choice,
                )
                st.session_state.modernization_output = mod_result
            st.success("Modernization complete with AST syntax validation!")

        if st.session_state.modernization_output:
            mod_data: CodeModernizationOutput = st.session_state.modernization_output

            # Executive Summary
            st.markdown("### 📋 Executive Summary")
            st.info(mod_data.executive_summary)

            # Mermaid Architecture Flowchart
            st.markdown("### 🗺️ System Architecture Flowchart (Mermaid.js)")
            render_mermaid(mod_data.mermaid_flowchart, height=440)

            with st.expander("View Raw Mermaid Syntax"):
                st.code(mod_data.mermaid_flowchart, language="mermaid")

            # Tech Debt & Security Audit
            st.markdown("### ⚠️ Tech Debt & Security Risks Audit")
            for risk in mod_data.tech_debt_and_risks:
                if "CRITICAL" in risk.upper() or "SQL" in risk.upper() or "SECURITY" in risk.upper():
                    st.error(risk)
                else:
                    st.warning(risk)

            st.markdown("---")

            # Code Tabs: Modernized Code & Pytest Suite
            subtab_code, subtab_tests = st.tabs([
                "✨ Modernized Code (PEP-8 & Docstrings)",
                "🧪 Auto-Generated Pytest Suite",
            ])

            with subtab_code:
                st.markdown("#### Modernized, Type-Annotated Implementation")
                st.code(mod_data.modernized_code, language="python")
                st.download_button(
                    label="💾 Download Modernized Code",
                    data=mod_data.modernized_code,
                    file_name="modernized_code.py",
                    mime="text/x-python",
                )

            with subtab_tests:
                st.markdown("#### Complete Executable Pytest Suite")
                st.code(mod_data.pytest_suite, language="python")
                st.download_button(
                    label="💾 Download Pytest Suite",
                    data=mod_data.pytest_suite,
                    file_name="test_modernized.py",
                    mime="text/x-python",
                )

# =========================================================
# TAB 3: CHAT WITH CODEBASE (AST-RAG)
# =========================================================
with tab3:
    st.subheader("Grounded Code-RAG Chat with Line-Level Citations")
    st.markdown(
        "Ask targeted architectural, security, or implementation questions. "
        "Answers are grounded strictly in retrieved AST chunks with explicit line number citations."
    )

    if st.session_state.vectors_indexed == 0:
        st.warning("Please index the codebase in the sidebar to enable Code-RAG chat.")
    else:
        # Render previous chat messages
        for msg in st.session_state.chat_history:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
                if "retrieved_chunks" in msg and msg["retrieved_chunks"]:
                    with st.expander("📍 View Retrieved AST Chunks & Line Numbers"):
                        for idx, rc in enumerate(msg["retrieved_chunks"], 1):
                            m = rc.get("metadata", {})
                            st.markdown(
                                f"**Hit {idx}:** `{m.get('file_path')}` (Lines {m.get('start_line')}-{m.get('end_line')}) "
                                f"| Node: `{m.get('node_type')}` **{m.get('node_name')}**"
                            )
                            st.code(rc.get("document", ""), language="python")

        # Chat input prompt
        if user_query := st.chat_input("Ask a question about this codebase... (e.g. 'Are there SQL injection vulnerabilities?')"):
            # Add user message to history
            st.session_state.chat_history.append({"role": "user", "content": user_query})
            with st.chat_message("user"):
                st.markdown(user_query)

            # Generate grounded RAG answer
            with st.chat_message("assistant"):
                with st.spinner("Searching ChromaDB AST vectors and querying Gemini..."):
                    rag_res = query_codebase(
                        user_question=user_query,
                        api_key=api_key_input,
                        top_k=5,
                        model_name="gemini-2.5-flash",
                    )
                    answer = rag_res["answer"]
                    retrieved_chunks = rag_res["retrieved_chunks"]

                    st.markdown(answer)
                    if retrieved_chunks:
                        with st.expander("📍 View Retrieved AST Chunks & Line Numbers"):
                            for idx, rc in enumerate(retrieved_chunks, 1):
                                m = rc.get("metadata", {})
                                st.markdown(
                                    f"**Hit {idx}:** `{m.get('file_path')}` (Lines {m.get('start_line')}-{m.get('end_line')}) "
                                    f"| Node: `{m.get('node_type')}` **{m.get('node_name')}**"
                                )
                                st.code(rc.get("document", ""), language="python")

            # Save assistant reply to history
            st.session_state.chat_history.append({
                "role": "assistant",
                "content": answer,
                "retrieved_chunks": retrieved_chunks,
            })
