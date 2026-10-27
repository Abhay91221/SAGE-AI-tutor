from __future__ import annotations

import os
import sys

# Support direct execution (e.g. `python engine/__init__.py`)
if __name__ == "__main__" and (__package__ is None or __package__ == ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from engine.rag_store import (
        CodeRAGStore,
        get_rag_store,
        index_ast_chunks,
        query_codebase,
    )
    from engine.modernizer import (
        CodeModernizationOutput,
        modernize_codebase,
        validate_python_syntax,
    )
else:
    from .rag_store import (
        CodeRAGStore,
        get_rag_store,
        index_ast_chunks,
        query_codebase,
    )
    from .modernizer import (
        CodeModernizationOutput,
        modernize_codebase,
        validate_python_syntax,
    )

__all__ = [
    "CodeRAGStore",
    "get_rag_store",
    "index_ast_chunks",
    "query_codebase",
    "CodeModernizationOutput",
    "modernize_codebase",
    "validate_python_syntax",
    "run_engine_demo",
]


def run_engine_demo() -> None:
    """Run an end-to-end demonstration of the LegacyLens AI engine."""
    print("=" * 70)
    print(" 🔍 LegacyLens AI Engine: Stage 3 (RAG Store) & Stage 4 (Modernizer)")
    print("=" * 70)

    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sample_file = os.path.join(workspace_dir, "sample_legacy_code.py")

    from pipeline.ingestor import ingest_source
    from pipeline.ast_chunker import parse_codebase_to_chunks, pack_to_xml

    ingestion = ingest_source("sample", sample_file)
    total_lines = sum(len(f.content.splitlines()) for f in ingestion.files)
    print(f"\n[1] Ingesting source code from: {os.path.relpath(sample_file, workspace_dir)}")
    print(f"    ✓ Files ingested: {len(ingestion.files)}")
    print(f"    ✓ Total source lines: {total_lines}")
    print(f"    ✓ SHA-256 fingerprint: {ingestion.files[0].content_hash[:16]}...")

    print("\n[2] Parsing AST syntax chunks...")
    chunks = parse_codebase_to_chunks(ingestion.files)
    print(f"    ✓ Extracted {len(chunks)} structural AST chunks:")
    for c in chunks:
        print(f"      - [{c.node_type.upper()}] {c.node_name} (Lines {c.start_line}-{c.end_line})")

    print("\n[3] Generating XML context pack for LLM ingestion...")
    xml_pack = pack_to_xml(chunks)
    print(f"    ✓ XML length: {len(xml_pack)} chars (preview below):")
    xml_preview = "\n".join(xml_pack.splitlines()[:10])
    print("    " + xml_preview.replace("\n", "\n    ") + "\n    ...")

    print("\n[4] Initializing ChromaDB vector store and indexing chunks...")
    store = get_rag_store()
    indexed_count = store.index_chunks(chunks)
    print(f"    ✓ Successfully indexed {indexed_count} chunks into collection: '{store.collection_name}'")
    print(f"    ✓ Total collection size: {store.count()} chunks")

    query = "How does discount calculation work for different customer tiers?"
    print(f"\n[5] Executing Grounded AST-RAG query:\n    Q: '{query}'")
    results = store.retrieve(query, top_k=2)
    print(f"    ✓ Retrieved top {len(results)} matches:")
    for rank, hit in enumerate(results, start=1):
        meta = hit["metadata"]
        print(f"      #{rank}: {meta.get('file_path')} | {meta.get('node_type')} '{meta.get('node_name')}' (Lines {meta.get('start_line')}-{meta.get('end_line')})")
        print(f"          Relevance distance: {hit.get('distance'):.4f}")

    print("\n[6] Syntax Guardrail check on legacy functions:")
    for c in chunks:
        if c.node_type in ("function", "class"):
            is_valid, err, line = validate_python_syntax(c.code)
            status = "VALID" if is_valid else f"SYNTAX ERROR ({err})"
            print(f"    ✓ Syntax parse [{c.node_name}]: {status}")

    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        print("\n[7] GEMINI_API_KEY detected! Testing Gemini Modernization Engine...")
        try:
            sample_chunk = chunks[1] if len(chunks) > 1 else chunks[0]
            print(f"    Modernizing node: '{sample_chunk.node_name}'...")
            output = modernize_codebase(
                xml_context=pack_to_xml([sample_chunk]),
                focus_target=sample_chunk.node_name,
                api_key=api_key,
            )
            print(f"    ✓ Architecture Type: {output.architecture_type}")
            print(f"    ✓ Modernized functions: {len(output.modernized_files)}")
            print(f"    ✓ Architecture Explanation: {output.architectural_explanation[:150]}...")
        except Exception as e:
            print(f"    ⚠ Modernization API call error: {e}")
    else:
        print("\n[7] Note: GEMINI_API_KEY not set in environment.")
        print("    Set GEMINI_API_KEY to run live Gemini long-context modernizations,")
        print("    or enter your key in the Streamlit UI at http://localhost:8501")

    print("\n" + "=" * 70)
    print(" ✅ Engine run completed successfully!")
    print(" 🌐 Streamlit Web UI is live at: http://localhost:8501")
    print("=" * 70)


if __name__ == "__main__":
    run_engine_demo()

