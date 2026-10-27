# Ponytail Engineering Rules & Architecture Guidelines

## 1. Core Philosophy: The Ponytail Mindset (Lazy Senior Dev / YAGNI)
- **You Aren't Gonna Need It (YAGNI)**: Avoid unnecessary dependencies, over-engineered abstractions, and bloated wrappers.
- **Python Standard Library First**:
  - Leverage `ast` for parsing and syntax tree analysis.
  - Use `hashlib` for content fingerprinting (SHA-256).
  - Use `tempfile` and `pathlib` for clean workspace isolation and cleanup.
  - Use `re` for fallback parsing and text sanitization.
- **Fail Fast & Self-Heal**:
  - Code generation MUST be guarded by `ast.parse()`.
  - When syntax errors occur, trigger an automated 1-step corrective feedback loop rather than failing silently or crashing.

## 2. Pipeline Design Rules
- **Stage 1 (Ingestion)**:
  - Strictly filter junk directories (`.git`, `node_modules`, `venv`, `__pycache__`, etc.) and non-code file extensions.
  - Hash-fingerprint every code file so re-indexing skips unchanged files.
- **Stage 2 (AST Chunking)**:
  - Never do naive character-count splitting on code. Code chunks must respect function and class boundaries.
  - Every chunk must preserve rich metadata: relative `file_path`, `node_type`, `node_name`, `start_line`, `end_line`, and file-level imports.
  - Provide a fallback chunker for non-Python or syntax-invalid source code.
  - Implement an XML context packer (`<file><chunk>...</chunk></file>`) for Gemini long-context comprehension.

## 3. Engine Design Rules
- **Stage 3 (Code-RAG Store)**:
  - Store AST chunks with explicit metadata summaries (`File: X | Function: Y | Lines A-B`).
  - RAG responses must be strictly grounded and cite exact `file_path` and `start_line-end_line` ranges.
- **Stage 4 (Modernizer)**:
  - Enforce structured outputs using Pydantic schemas via `google-genai`'s `response_schema`.
  - Ensure generated Mermaid.js diagrams use valid `graph TD` syntax without markdown code fences.
  - Ensure modernized code conforms to PEP-8, Google-style docstrings, and complete type annotations.
  - Unit tests must be runnable `pytest` test suites with edge case coverage.

## 4. Frontend & User Experience
- Streamlit layout must be clean, responsive (`wide` layout), and visually engaging.
- Provide interactive Mermaid.js rendering via official CDN iframe.
- Support instant sample loading, raw paste, file upload, and GitHub cloning.
