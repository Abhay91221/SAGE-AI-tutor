"""
Stage 2: AST-Based Syntax-Aware Code Chunker for LegacyLens AI.
Decomposes source code into semantic, boundary-respecting AST nodes (functions and classes).
Includes rich metadata tagging, a regex fallback chunker for non-Python/broken files,
and an XML context packer for LLM ingestion.
"""

from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from .ingestor import CodeFile


@dataclass
class ASTChunk:
    """Represents a discrete, syntax-aware code unit (function or class)."""
    chunk_id: str
    file_path: str
    node_type: str  # "function", "class", "module_globals", "block"
    node_name: str
    start_line: int
    end_line: int
    code: str
    imports: str
    content_hash: str
    language: str = "python"
    docstring: Optional[str] = None
    extra_metadata: Dict[str, Any] = field(default_factory=dict)

    def to_metadata(self) -> Dict[str, Any]:
        """Convert chunk attributes to flat metadata dictionary for vector DB indexing."""
        return {
            "chunk_id": self.chunk_id,
            "file_path": self.file_path,
            "node_type": self.node_type,
            "node_name": self.node_name,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "content_hash": self.content_hash,
            "language": self.language,
        }

    def to_search_document(self) -> str:
        """Create a dense context document formatted for embedding and semantic search."""
        header = (
            f"File: {self.file_path} | "
            f"{self.node_type.capitalize()}: {self.node_name} | "
            f"Lines: {self.start_line}-{self.end_line}"
        )
        if self.imports:
            header += f"\nImports: {self.imports}"
        return f"{header}\n\nCode:\n{self.code}"


def _extract_top_level_imports(tree: ast.AST, lines: List[str]) -> str:
    """Extract top-level import statements from a Python AST module."""
    import_snippets: List[str] = []
    for node in getattr(tree, "body", []):
        if isinstance(node, (ast.Import, ast.ImportFrom)):
            start = node.lineno - 1
            end = getattr(node, "end_lineno", node.lineno)
            snippet = "\n".join(lines[start:end]).strip()
            if snippet:
                import_snippets.append(snippet)
    return " | ".join(import_snippets)


def parse_python_ast(code_file: CodeFile) -> List[ASTChunk]:
    """
    Parse a Python file into granular AST chunks for functions and classes.
    Preserves exact line boundaries, docstrings, and module-level imports.
    """
    source = code_file.content
    lines = source.splitlines()
    total_lines = len(lines)

    try:
        tree = ast.parse(source, filename=code_file.rel_path)
    except SyntaxError:
        # Fall back to regex/line-based chunker for broken Python code
        return parse_fallback_chunks(code_file)

    imports_summary = _extract_top_level_imports(tree, lines)
    chunks: List[ASTChunk] = []

    # Track lines covered by functions/classes to capture any significant top-level globals
    covered_line_spans: List[Tuple[int, int]] = []

    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            start_line = node.lineno
            end_line = getattr(node, "end_lineno", node.lineno)
            snippet = "\n".join(lines[start_line - 1 : end_line])
            doc = ast.get_docstring(node)
            cid = f"{code_file.content_hash[:8]}_{node.name}_{start_line}"

            chunks.append(
                ASTChunk(
                    chunk_id=cid,
                    file_path=code_file.rel_path,
                    node_type="function",
                    node_name=node.name,
                    start_line=start_line,
                    end_line=end_line,
                    code=snippet,
                    imports=imports_summary,
                    content_hash=code_file.content_hash,
                    language="python",
                    docstring=doc,
                )
            )
            covered_line_spans.append((start_line, end_line))

        elif isinstance(node, ast.ClassDef):
            start_line = node.lineno
            end_line = getattr(node, "end_lineno", node.lineno)
            snippet = "\n".join(lines[start_line - 1 : end_line])
            doc = ast.get_docstring(node)
            cid = f"{code_file.content_hash[:8]}_{node.name}_{start_line}"

            chunks.append(
                ASTChunk(
                    chunk_id=cid,
                    file_path=code_file.rel_path,
                    node_type="class",
                    node_name=node.name,
                    start_line=start_line,
                    end_line=end_line,
                    code=snippet,
                    imports=imports_summary,
                    content_hash=code_file.content_hash,
                    language="python",
                    docstring=doc,
                )
            )
            covered_line_spans.append((start_line, end_line))

    # If top-level definitions exist before or between functions (e.g. global configs, constants)
    if covered_line_spans:
        first_def_start = min(s[0] for s in covered_line_spans)
        if first_def_start > 1:
            globals_lines = lines[0 : first_def_start - 1]
            globals_code = "\n".join(globals_lines).strip()
            # If there is real code besides pure import statements:
            non_import_code = [
                l for l in globals_lines
                if l.strip() and not l.strip().startswith(("import ", "from ", "#"))
            ]
            if non_import_code:
                chunks.insert(
                    0,
                    ASTChunk(
                        chunk_id=f"{code_file.content_hash[:8]}_globals_1",
                        file_path=code_file.rel_path,
                        node_type="module_globals",
                        node_name="<globals>",
                        start_line=1,
                        end_line=first_def_start - 1,
                        code=globals_code,
                        imports=imports_summary,
                        content_hash=code_file.content_hash,
                        language="python",
                    ),
                )
    else:
        # File has no functions or classes: chunk the whole file as a module block
        chunks.append(
            ASTChunk(
                chunk_id=f"{code_file.content_hash[:8]}_module_1",
                file_path=code_file.rel_path,
                node_type="module",
                node_name="<module>",
                start_line=1,
                end_line=total_lines,
                code=source,
                imports=imports_summary,
                content_hash=code_file.content_hash,
                language="python",
            )
        )

    return chunks


def parse_fallback_chunks(code_file: CodeFile) -> List[ASTChunk]:
    """
    Line/Regex-based fallback chunker for non-Python files (JS, TS, Java, C++, SQL)
    or Python files with broken syntax. Detects class/function boundary declarations
    while strictly preserving line numbers.
    """
    lines = code_file.content.splitlines()
    total_lines = len(lines)
    if not lines:
        return []

    # Patterns matching function/class signatures across Python, JS/TS, Java, C++, PHP
    pattern = re.compile(
        r"^(?:\s*)(?:export\s+)?(?:async\s+)?(?:def|class|function|fn|func|public|private|protected|static|\w+\s+(?:\w+\s+)?)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*(\(.*?\)|\{)?"
    )

    boundaries: List[Tuple[int, str, str]] = []  # (1-indexed line_no, node_type, name)

    for i, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", "//", "/*", "*")):
            continue

        match = pattern.match(line)
        if match:
            name = match.group(1)
            # Infer type
            if "class " in line:
                node_type = "class"
            elif any(k in line for k in ("def ", "function", "fn ", "=>", "(")):
                node_type = "function"
            else:
                node_type = "block"
            boundaries.append((i, node_type, name))

    chunks: List[ASTChunk] = []

    if not boundaries:
        # Break into 50-line blocks if no function boundaries detected
        block_size = 50
        for start_idx in range(0, total_lines, block_size):
            end_idx = min(start_idx + block_size, total_lines)
            snippet = "\n".join(lines[start_idx:end_idx])
            start_line = start_idx + 1
            end_line = end_idx
            cid = f"{code_file.content_hash[:8]}_block_{start_line}"
            chunks.append(
                ASTChunk(
                    chunk_id=cid,
                    file_path=code_file.rel_path,
                    node_type="block",
                    node_name=f"block_{start_line}_{end_line}",
                    start_line=start_line,
                    end_line=end_line,
                    code=snippet,
                    imports="",
                    content_hash=code_file.content_hash,
                    language=code_file.language,
                )
            )
        return chunks

    # Build spans from boundary to boundary
    for idx, (start_line, node_type, name) in enumerate(boundaries):
        if idx + 1 < len(boundaries):
            end_line = boundaries[idx + 1][0] - 1
        else:
            end_line = total_lines

        snippet = "\n".join(lines[start_line - 1 : end_line])
        cid = f"{code_file.content_hash[:8]}_{name}_{start_line}"
        chunks.append(
            ASTChunk(
                chunk_id=cid,
                file_path=code_file.rel_path,
                node_type=node_type,
                node_name=name,
                start_line=start_line,
                end_line=end_line,
                code=snippet,
                imports="",
                content_hash=code_file.content_hash,
                language=code_file.language,
            )
        )

    return chunks


def parse_codebase_to_chunks(code_files: List[CodeFile]) -> List[ASTChunk]:
    """
    Process all ingested code files and generate unified AST chunks.
    Dispatches to Python AST parser for .py files, and fallback chunker for others.
    """
    all_chunks: List[ASTChunk] = []
    for cf in code_files:
        if cf.language == "python" or cf.rel_path.endswith(".py"):
            file_chunks = parse_python_ast(cf)
        else:
            file_chunks = parse_fallback_chunks(cf)
        all_chunks.extend(file_chunks)
    return all_chunks


def pack_to_xml(chunks: List[ASTChunk]) -> str:
    """
    Formats parsed AST chunks into hierarchical XML for long-context LLM analysis:
    <file path="..."><chunk name="..." type="..." lines="...-...">code</chunk></file>
    """
    from collections import defaultdict
    by_file = defaultdict(list)
    for c in chunks:
        by_file[c.file_path].append(c)

    xml_parts = ['<codebase>\n']
    for file_path, f_chunks in by_file.items():
        lang = f_chunks[0].language if f_chunks else "text"
        xml_parts.append(f'  <file path="{file_path}" language="{lang}">\n')
        for chunk in f_chunks:
            # Escape XML entities in attributes
            safe_name = chunk.node_name.replace('"', '&quot;')
            xml_parts.append(
                f'    <chunk name="{safe_name}" type="{chunk.node_type}" lines="{chunk.start_line}-{chunk.end_line}">\n'
            )
            # Indent chunk code
            for line in chunk.code.splitlines():
                xml_parts.append(f"      {line}\n")
            xml_parts.append("    </chunk>\n")
        xml_parts.append("  </file>\n")
    xml_parts.append("</codebase>")
    return "".join(xml_parts)
