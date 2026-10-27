from __future__ import annotations

import os
import sys

# Support direct execution (e.g. `python pipeline/__init__.py`)
if __name__ == "__main__" and (__package__ is None or __package__ == ""):
    sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    from pipeline.ingestor import CodeFile, IngestionResult, ingest_source
    from pipeline.ast_chunker import ASTChunk, parse_codebase_to_chunks, pack_to_xml
else:
    from .ingestor import CodeFile, IngestionResult, ingest_source
    from .ast_chunker import ASTChunk, parse_codebase_to_chunks, pack_to_xml

__all__ = [
    "CodeFile",
    "IngestionResult",
    "ingest_source",
    "ASTChunk",
    "parse_codebase_to_chunks",
    "pack_to_xml",
    "run_pipeline_demo",
]


def run_pipeline_demo() -> None:
    """Run demonstration of Pipeline Stage 1 (Ingestor) & Stage 2 (AST Chunker)."""
    print("=" * 70)
    print(" 🛠️  LegacyLens AI Pipeline: Stage 1 (Ingestion) & Stage 2 (AST Chunks)")
    print("=" * 70)

    workspace_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sample_file = os.path.join(workspace_dir, "sample_legacy_code.py")

    print(f"\n[Stage 1: Ingestion] Target: {os.path.relpath(sample_file, workspace_dir)}")
    result = ingest_source("sample", sample_file)
    print(f"  ✓ Files parsed: {len(result.files)}")
    print(f"  ✓ Ignored items: {result.ignored_count}")
    print(f"  ✓ File hash (SHA-256): {result.files[0].content_hash}")

    print("\n[Stage 2: AST Chunking]")
    chunks = parse_codebase_to_chunks(result.files)
    print(f"  ✓ Total AST chunks created: {len(chunks)}")
    for i, c in enumerate(chunks, 1):
        print(f"    {i}. {c.node_type.upper():<16} {c.node_name:<25} Lines {c.start_line:>3}-{c.end_line:<3}")

    xml = pack_to_xml(chunks)
    print(f"\n[XML Representation]: {len(xml)} characters generated successfully.")
    print("=" * 70)


if __name__ == "__main__":
    run_pipeline_demo()

