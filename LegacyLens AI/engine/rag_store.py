"""
Stage 3: Code-RAG Vector Store & Contextual Retrieval Engine for LegacyLens AI.
Embeds AST chunks with Google text-embedding-004, indexes them into ChromaDB,
and executes grounded Code-RAG querying with line-level citations.
"""

from __future__ import annotations

import os
import hashlib
from typing import Any, Dict, List, Optional, Tuple

import chromadb
from chromadb.config import Settings

from pipeline.ast_chunker import ASTChunk


DEFAULT_COLLECTION_NAME = "codebase_chunks"
DEFAULT_DB_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), ".chroma_db")


class CodeRAGStore:
    """
    Manages the ChromaDB collection for codebase AST chunks, embedding generation,
    and semantic similarity retrieval.
    """

    def __init__(self, persist_dir: Optional[str] = None, collection_name: str = DEFAULT_COLLECTION_NAME):
        self.persist_dir = persist_dir or DEFAULT_DB_DIR
        os.makedirs(self.persist_dir, exist_ok=True)
        self.client = chromadb.PersistentClient(
            path=self.persist_dir,
            settings=Settings(anonymized_telemetry=False)
        )
        self.collection_name = collection_name
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"description": "AST-indexed semantic code chunks for LegacyLens AI"}
        )

    def reset_collection(self) -> None:
        """Clear and re-initialize the collection."""
        try:
            self.client.delete_collection(self.collection_name)
        except Exception:
            pass
        self.collection = self.client.get_or_create_collection(
            name=self.collection_name,
            metadata={"description": "AST-indexed semantic code chunks for LegacyLens AI"}
        )

    def count(self) -> int:
        """Return the number of indexed chunks."""
        try:
            return self.collection.count()
        except Exception:
            return 0

    def generate_embeddings(
        self, texts: List[str], api_key: Optional[str] = None
    ) -> List[List[float]]:
        """
        Generate dense vector embeddings using google-genai text-embedding-004.
        Falls back to deterministic hash projection if API key is not provided (offline/test mode).
        """
        key = api_key or os.getenv("GEMINI_API_KEY")
        if not key:
            # Deterministic pseudo-embedding for testing / offline mode without API key
            return [self._offline_hash_embedding(t) for t in texts]

        try:
            from google import genai
            client = genai.Client(api_key=key)

            embeddings: List[List[float]] = []
            # Batch in chunks of 50 to respect API payload limits
            batch_size = 50
            for i in range(0, len(texts), batch_size):
                batch = texts[i : i + batch_size]
                # Embed each text item or list
                for text_item in batch:
                    resp = client.models.embed_content(
                        model="text-embedding-004",
                        contents=text_item,
                    )
                    # resp.embedding is an object with values: list[float]
                    if hasattr(resp, "embedding") and hasattr(resp.embedding, "values"):
                        embeddings.append(list(resp.embedding.values))
                    elif hasattr(resp, "embeddings") and resp.embeddings:
                        embeddings.append(list(resp.embeddings[0].values))
                    else:
                        embeddings.append(self._offline_hash_embedding(text_item))
            return embeddings
        except Exception as e:
            # If Google API call fails (e.g. invalid key or network error), fallback gracefully
            print(f"[CodeRAGStore] Warning: Google embedding API call failed ({e}). Using fallback embeddings.")
            return [self._offline_hash_embedding(t) for t in texts]

    def _offline_hash_embedding(self, text: str, dim: int = 768) -> List[float]:
        """Produce a deterministic, normalized 768-dim float vector from text hash."""
        vec = [0.0] * dim
        for i, word in enumerate(text.split()[:200]):
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            idx = (h + i) % dim
            val = ((h % 1000) / 500.0) - 1.0
            vec[idx] += val
        norm = sum(x * x for x in vec) ** 0.5 or 1.0
        return [round(x / norm, 5) for x in vec]

    def index_chunks(
        self, chunks: List[ASTChunk], api_key: Optional[str] = None
    ) -> int:
        """
        Upsert AST chunks into ChromaDB with embeddings, documents, and rich metadata.
        Returns the count of indexed items.
        """
        if not chunks:
            return 0

        ids: List[str] = []
        documents: List[str] = []
        metadatas: List[Dict[str, Any]] = []

        for c in chunks:
            ids.append(c.chunk_id)
            documents.append(c.to_search_document())
            metadatas.append(c.to_metadata())

        embeddings = self.generate_embeddings(documents, api_key=api_key)

        self.collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=documents,
            metadatas=metadatas,
        )
        return len(ids)

    def retrieve(
        self,
        query: str,
        api_key: Optional[str] = None,
        top_k: int = 5,
    ) -> List[Dict[str, Any]]:
        """
        Retrieve top_k most semantically relevant AST chunks for a query.
        """
        if self.count() == 0:
            return []

        query_emb = self.generate_embeddings([query], api_key=api_key)[0]
        results = self.collection.query(
            query_embeddings=[query_emb],
            n_results=min(top_k, self.count()),
            include=["documents", "metadatas", "distances"],
        )

        retrieved: List[Dict[str, Any]] = []
        if results and "documents" in results and results["documents"]:
            docs = results["documents"][0]
            metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
            dists = results["distances"][0] if results.get("distances") else [0.0] * len(docs)
            ids = results["ids"][0] if results.get("ids") else [""] * len(docs)

            for cid, doc, meta, dist in zip(ids, docs, metas, dists):
                retrieved.append({
                    "chunk_id": cid,
                    "document": doc,
                    "metadata": meta,
                    "distance": dist,
                    "score": round(1.0 - dist, 4) if dist is not None else 0.0,
                })

        return retrieved


# Global default store singleton
_DEFAULT_STORE: Optional[CodeRAGStore] = None


def get_rag_store(persist_dir: Optional[str] = None) -> CodeRAGStore:
    """Retrieve or create the default CodeRAGStore instance."""
    global _DEFAULT_STORE
    if _DEFAULT_STORE is None:
        _DEFAULT_STORE = CodeRAGStore(persist_dir=persist_dir)
    return _DEFAULT_STORE


def index_ast_chunks(
    chunks: List[ASTChunk],
    api_key: Optional[str] = None,
    store: Optional[CodeRAGStore] = None,
) -> int:
    """Convenience helper to index AST chunks into the active vector store."""
    active_store = store or get_rag_store()
    return active_store.index_chunks(chunks, api_key=api_key)


def query_codebase(
    user_question: str,
    api_key: str,
    top_k: int = 5,
    store: Optional[CodeRAGStore] = None,
    model_name: str = "gemini-2.5-flash",
) -> Dict[str, Any]:
    """
    Execute a grounded Code-RAG query against the indexed codebase.
    Instructs Gemini to answer using ONLY retrieved chunks and cite line numbers.
    """
    active_store = store or get_rag_store()
    retrieved = active_store.retrieve(user_question, api_key=api_key, top_k=top_k)

    if not retrieved:
        return {
            "answer": "No code chunks have been indexed into the vector store yet. Please ingest and index a codebase first.",
            "retrieved_chunks": [],
            "model": model_name,
        }

    # Format retrieved context
    context_blocks = []
    for i, item in enumerate(retrieved, start=1):
        meta = item.get("metadata", {})
        fpath = meta.get("file_path", "unknown")
        sline = meta.get("start_line", "?")
        eline = meta.get("end_line", "?")
        ntype = meta.get("node_type", "chunk")
        nname = meta.get("node_name", "unnamed")
        doc = item.get("document", "")

        context_blocks.append(
            f"--- CHUNK {i} ---\n"
            f"File: {fpath} (Lines {sline}-{eline})\n"
            f"Type: {ntype} | Name: {nname}\n"
            f"Content:\n{doc}\n"
        )

    context_str = "\n".join(context_blocks)

    system_instruction = (
        "You are an elite Principal Software Architect and Security Auditor specializing in code modernization.\n"
        "Your task is to answer developer questions strictly based on the provided AST code chunks.\n\n"
        "RULES:\n"
        "1. Ground every claim, explanation, or code snippet in the provided chunks.\n"
        "2. MANDATORY CITATIONS: You MUST cite the exact file path and line numbers for every function, logic block, or flaw "
        "you mention (e.g. `[sample_legacy_code.py:10-24]`).\n"
        "3. If the answer cannot be determined from the provided chunks, explicitly state that the indexed code does not contain the answer.\n"
        "4. Be precise, practical, and constructive."
    )

    prompt = (
        f"{system_instruction}\n\n"
        f"=== RETRIEVED AST CODE CHUNKS ===\n"
        f"{context_str}\n"
        f"=== END OF CHUNKS ===\n\n"
        f"Developer Question: {user_question}\n\n"
        f"Grounded Answer (with line-level citations):"
    )

    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=model_name,
            contents=prompt,
        )
        answer = response.text or "No response generated by the model."
    except Exception as e:
        answer = f"Error during Gemini generation: {str(e)}"

    return {
        "answer": answer,
        "retrieved_chunks": retrieved,
        "model": model_name,
    }
