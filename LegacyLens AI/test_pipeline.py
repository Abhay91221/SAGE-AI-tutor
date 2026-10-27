"""
Comprehensive test suite for LegacyLens AI pipeline and modernization engine.
Validates Stage 1 Ingestor, Stage 2 AST Chunker, Stage 3 ChromaDB Store,
and Stage 4 Syntax Guardrail.
"""

import os
import sys
import pytest

CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

from pipeline.ingestor import (
    CodeFile,
    compute_sha256,
    detect_language,
    ingest_raw_code,
    ingest_source,
    scan_directory,
)
from pipeline.ast_chunker import (
    ASTChunk,
    pack_to_xml,
    parse_codebase_to_chunks,
    parse_python_ast,
)
from engine.modernizer import (
    sanitize_mermaid_code,
    validate_python_syntax,
)
from engine.rag_store import CodeRAGStore


def test_ingestor_sample_code():
    sample_path = os.path.join(CURRENT_DIR, "sample_legacy_code.py")
    res = ingest_source("sample", sample_path)
    assert len(res.files) == 1
    cf = res.files[0]
    assert cf.rel_path == "sample_legacy_code.py"
    assert cf.language == "python"
    assert len(cf.content_hash) == 64
    assert "LegacyInventoryTracker" in cf.content


def test_ast_chunker_node_extraction():
    sample_path = os.path.join(CURRENT_DIR, "sample_legacy_code.py")
    res = ingest_source("sample", sample_path)
    chunks = parse_codebase_to_chunks(res.files)

    # Verify extracted node names
    chunk_names = [c.node_name for c in chunks]
    assert "get_customer_record" in chunk_names
    assert "calculate_discount" in chunk_names
    assert "process_order_items" in chunk_names
    assert "LegacyInventoryTracker" in chunk_names

    # Check line numbers and types
    for c in chunks:
        assert c.start_line > 0
        assert c.end_line >= c.start_line
        assert c.node_type in ("function", "class", "module_globals", "module")
        assert c.file_path == "sample_legacy_code.py"

    # Test XML packer
    xml_output = pack_to_xml(chunks)
    assert "<codebase>" in xml_output
    assert '<file path="sample_legacy_code.py"' in xml_output
    assert '<chunk name="get_customer_record"' in xml_output
    assert "</codebase>" in xml_output


def test_syntax_guardrail():
    # Valid Python
    valid_code = "def add(a: int, b: int) -> int:\n    return a + b\n"
    is_valid, err, line = validate_python_syntax(valid_code)
    assert is_valid is True
    assert err is None

    # Invalid Python syntax
    invalid_code = "def broken(\n    return 42"
    is_valid, err, line = validate_python_syntax(invalid_code)
    assert is_valid is False
    assert "SyntaxError" in err


def test_sanitize_mermaid():
    fenced = "```mermaid\ngraph TD\n    A --> B\n```"
    cleaned = sanitize_mermaid_code(fenced)
    assert not cleaned.startswith("```")
    assert cleaned.startswith("graph TD")

    bare = "A[Client] --> B[API]"
    cleaned_bare = sanitize_mermaid_code(bare)
    assert cleaned_bare.startswith("graph TD")


def test_chroma_rag_store_indexing_and_retrieval(tmp_path):
    store = CodeRAGStore(persist_dir=str(tmp_path / "test_chroma"))
    assert store.count() == 0

    chunk = ASTChunk(
        chunk_id="test_chunk_001",
        file_path="sample_legacy_code.py",
        node_type="function",
        node_name="calculate_discount",
        start_line=26,
        end_line=56,
        code="def calculate_discount(amount, tier='bronze'): return amount",
        imports="import time",
        content_hash="abcdef123456",
        language="python",
    )

    indexed = store.index_chunks([chunk], api_key=None)
    assert indexed == 1
    assert store.count() == 1

    # Semantic retrieval with query
    results = store.retrieve("discount calculation for customer tier", api_key=None, top_k=1)
    assert len(results) == 1
    hit = results[0]
    assert hit["chunk_id"] == "test_chunk_001"
    assert hit["metadata"]["node_name"] == "calculate_discount"
