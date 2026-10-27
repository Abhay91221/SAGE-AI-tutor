"""
Stage 1: Data Ingestion & Noise Filtering Pipeline for LegacyLens AI.
Handles source code ingestion from GitHub URLs, Zip files, local paths, and raw snippets.
Applies strict junk directory pruning, binary filtering, and SHA-256 fingerprinting.
"""

from __future__ import annotations

import hashlib
import os
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

# Junk directories to strictly exclude during traversal
EXCLUDED_DIRS: Set[str] = {
    ".git",
    "node_modules",
    "venv",
    ".venv",
    "__pycache__",
    "dist",
    "build",
    ".idea",
    ".vscode",
    ".antigravity",
    ".pytest_cache",
    ".mypy_cache",
    ".chroma_db",
    "egg-info",
}

# Binary / non-code / lock file extensions to strictly ignore
EXCLUDED_EXTENSIONS: Set[str] = {
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".svg",
    ".ico",
    ".pyc",
    ".pyo",
    ".pyd",
    ".lock",
    ".pdf",
    ".env",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".zip",
    ".tar",
    ".gz",
    ".7z",
    ".rar",
    ".bin",
    ".db",
    ".sqlite",
    ".sqlite3",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
}

# Allowed code file extensions
ALLOWED_EXTENSIONS: Set[str] = {
    ".py",
    ".js",
    ".ts",
    ".jsx",
    ".tsx",
    ".java",
    ".php",
    ".cpp",
    ".c",
    ".h",
    ".hpp",
    ".sql",
    ".cs",
    ".go",
    ".rb",
    ".rs",
    ".html",
    ".css",
}

EXTENSION_LANGUAGE_MAP: Dict[str, str] = {
    ".py": "python",
    ".js": "javascript",
    ".ts": "typescript",
    ".jsx": "javascript",
    ".tsx": "typescript",
    ".java": "java",
    ".php": "php",
    ".cpp": "cpp",
    ".c": "c",
    ".h": "c",
    ".hpp": "cpp",
    ".sql": "sql",
    ".cs": "csharp",
    ".go": "go",
    ".rb": "ruby",
    ".rs": "rust",
    ".html": "html",
    ".css": "css",
}


@dataclass
class CodeFile:
    """Represents a clean, fingerprinted source code file."""
    rel_path: str
    abs_path: str
    content: str
    content_hash: str
    language: str
    size_bytes: int


@dataclass
class IngestionResult:
    """Aggregated output of the ingestion pipeline."""
    files: List[CodeFile]
    total_scanned: int
    ignored_count: int
    temp_dir: Optional[str] = None

    def cleanup(self) -> None:
        """Remove any temporary directory created during ingestion."""
        if self.temp_dir and os.path.exists(self.temp_dir):
            try:
                shutil.rmtree(self.temp_dir, ignore_errors=True)
            except Exception:
                pass


def compute_sha256(content: str) -> str:
    """Compute SHA-256 fingerprint for a given string content."""
    return hashlib.sha256(content.encode("utf-8", errors="replace")).hexdigest()


def detect_language(file_path: str) -> str:
    """Infer the programming language from file extension."""
    ext = os.path.splitext(file_path)[1].lower()
    return EXTENSION_LANGUAGE_MAP.get(ext, "text")


def scan_directory(dir_path: str, base_dir: Optional[str] = None) -> IngestionResult:
    """
    Traverse a directory, prune junk folders, filter code extensions,
    and produce fingerprinted CodeFile records.
    """
    root_path = Path(dir_path).resolve()
    base_path = Path(base_dir).resolve() if base_dir else root_path

    code_files: List[CodeFile] = []
    total_scanned = 0
    ignored_count = 0

    for current_root, dirs, files in os.walk(str(root_path)):
        # In-place directory exclusion to avoid traversing junk trees
        dirs[:] = [
            d for d in dirs
            if d not in EXCLUDED_DIRS
            and not d.startswith(".")
            and not d.endswith(".egg-info")
        ]

        for file_name in sorted(files):
            total_scanned += 1
            file_path = os.path.join(current_root, file_name)
            ext = os.path.splitext(file_name)[1].lower()

            if ext in EXCLUDED_EXTENSIONS or ext not in ALLOWED_EXTENSIONS:
                ignored_count += 1
                continue

            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()

                # Skip completely empty files
                if not content.strip():
                    ignored_count += 1
                    continue

                rel_path = os.path.relpath(file_path, str(base_path)).replace("\\", "/")
                content_hash = compute_sha256(content)
                lang = detect_language(file_name)
                size_bytes = len(content.encode("utf-8"))

                code_files.append(
                    CodeFile(
                        rel_path=rel_path,
                        abs_path=os.path.abspath(file_path),
                        content=content,
                        content_hash=content_hash,
                        language=lang,
                        size_bytes=size_bytes,
                    )
                )
            except Exception:
                ignored_count += 1

    return IngestionResult(
        files=code_files,
        total_scanned=total_scanned,
        ignored_count=ignored_count,
    )


def clone_github_repo(repo_url: str) -> Tuple[str, IngestionResult]:
    """
    Clone a public GitHub repository into a temporary directory and ingest its code.
    Requires gitpython installed.
    """
    clean_url = repo_url.strip()
    if not clean_url:
        raise ValueError("GitHub repository URL cannot be empty.")

    temp_dir = tempfile.mkdtemp(prefix="legacylens_git_")
    try:
        from git import Repo  # Lazy import
        Repo.clone_from(clean_url, temp_dir, depth=1)
        res = scan_directory(temp_dir, base_dir=temp_dir)
        res.temp_dir = temp_dir
        return temp_dir, res
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError(f"Failed to clone repository '{clean_url}': {e}") from e


def extract_zip_bytes(zip_bytes: bytes) -> Tuple[str, IngestionResult]:
    """Extract in-memory ZIP bytes to a temporary directory and ingest."""
    temp_dir = tempfile.mkdtemp(prefix="legacylens_zip_")
    zip_path = os.path.join(temp_dir, "uploaded.zip")
    try:
        with open(zip_path, "wb") as f:
            f.write(zip_bytes)
        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(temp_dir)
        os.remove(zip_path)
        res = scan_directory(temp_dir, base_dir=temp_dir)
        res.temp_dir = temp_dir
        return temp_dir, res
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise RuntimeError(f"Failed to extract zip archive: {e}") from e


def ingest_raw_code(code: str, filename: str = "snippet.py") -> IngestionResult:
    """Ingest a raw string of code (e.g. pasted into the web UI)."""
    cleaned = code.strip()
    if not cleaned:
        return IngestionResult(files=[], total_scanned=0, ignored_count=0)

    content_hash = compute_sha256(cleaned)
    lang = detect_language(filename)
    code_file = CodeFile(
        rel_path=filename,
        abs_path=filename,
        content=cleaned,
        content_hash=content_hash,
        language=lang,
        size_bytes=len(cleaned.encode("utf-8")),
    )
    return IngestionResult(
        files=[code_file],
        total_scanned=1,
        ignored_count=0,
    )


def ingest_source(
    source_type: str,
    source_data: Any,
    filename: str = "snippet.py",
) -> IngestionResult:
    """
    Unified entry point for data ingestion.
    source_type: 'sample' | 'raw' | 'github' | 'zip' | 'directory'
    """
    stype = source_type.lower()
    if stype == "sample":
        path = str(source_data)
        if not os.path.exists(path):
            raise FileNotFoundError(f"Sample file not found at: {path}")
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read()
        return ingest_raw_code(content, filename=os.path.basename(path))

    elif stype == "raw":
        return ingest_raw_code(str(source_data), filename=filename)

    elif stype == "github":
        _, result = clone_github_repo(str(source_data))
        return result

    elif stype == "zip":
        if isinstance(source_data, bytes):
            _, result = extract_zip_bytes(source_data)
            return result
        else:
            raise TypeError("Expected bytes for zip source_data.")

    elif stype == "directory":
        return scan_directory(str(source_data))

    else:
        raise ValueError(f"Unsupported source_type: {source_type}")
