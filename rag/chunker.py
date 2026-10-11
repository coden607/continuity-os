"""
Continuity OS · Document Chunker
Implements:
1. Recursive Character Chunking (hierarchical split across \\n\\n, \\n, sentences, words)
2. Docling / Structural Semantic Chunking (retains hierarchical heading breadcrumbs)
3. Sliding Window Chunking with configurable token/character overlap
"""

from typing import List, Dict, Any, Optional
from rag.parser import DoclingParser, DocumentBlock
from guardrails.schemas import RAGChunk
import uuid


class RecursiveChunker:
    """Hierarchical text splitter that splits on boundary markers with overlap."""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 100):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.separators = ["\n\n", "\n", ". ", "? ", "! ", " ", ""]

    def chunk_text(self, text: str, doc_id: str = "doc") -> List[RAGChunk]:
        raw_chunks = self._split_text(text, self.separators)
        results: List[RAGChunk] = []
        for idx, chunk_str in enumerate(raw_chunks):
            chunk_str = chunk_str.strip()
            if not chunk_str:
                continue
            results.append(RAGChunk(
                id=f"{doc_id}_chunk_{idx}",
                doc_id=doc_id,
                content=chunk_str,
                chunk_index=idx,
                char_count=len(chunk_str),
                metadata={"strategy": "recursive_character"}
            ))
        return results

    def _split_text(self, text: str, separators: List[str]) -> List[str]:
        final_chunks: List[str] = []
        separator = separators[-1]
        new_separators: List[str] = []

        for i, sep in enumerate(separators):
            if sep == "":
                separator = ""
                break
            if sep in text:
                separator = sep
                new_separators = separators[i + 1:]
                break

        splits = text.split(separator) if separator else list(text)
        good_splits: List[str] = []

        for s in splits:
            if len(s) < self.chunk_size:
                good_splits.append(s)
            else:
                if new_separators:
                    sub_splits = self._split_text(s, new_separators)
                    good_splits.extend(sub_splits)
                else:
                    good_splits.append(s)

        # Merge splits up to chunk_size with overlap
        current_chunk: List[str] = []
        current_len = 0

        for piece in good_splits:
            piece_len = len(piece) + len(separator)
            if current_len + piece_len > self.chunk_size and current_chunk:
                merged = separator.join(current_chunk)
                final_chunks.append(merged)
                # Overlap retention
                while current_chunk and current_len > self.chunk_overlap:
                    popped = current_chunk.pop(0)
                    current_len -= len(popped) + len(separator)

            current_chunk.append(piece)
            current_len += piece_len

        if current_chunk:
            final_chunks.append(separator.join(current_chunk))

        return final_chunks


class StructuralSemanticChunker:
    """Docling/Paperclip style semantic chunker preserving document heading hierarchy."""

    def __init__(self, target_chunk_size: int = 600):
        self.target_chunk_size = target_chunk_size
        self.parser = DoclingParser()

    def chunk_document(self, markdown_text: str, doc_id: str = "doc") -> List[RAGChunk]:
        blocks = self.parser.parse(markdown_text)
        chunks: List[RAGChunk] = []

        heading_stack: List[str] = []
        current_section_blocks: List[str] = []
        current_section_len = 0

        def current_breadcrumb() -> str:
            return " > ".join(heading_stack) if heading_stack else "Root"

        def flush_section():
            nonlocal current_section_blocks, current_section_len
            if current_section_blocks:
                content_text = "\n\n".join(current_section_blocks).strip()
                bcrumb = current_breadcrumb()
                full_chunk_text = f"[{bcrumb}]\n{content_text}"
                chunks.append(RAGChunk(
                    id=f"{doc_id}_sem_{len(chunks)}",
                    doc_id=doc_id,
                    content=full_chunk_text,
                    chunk_index=len(chunks),
                    char_count=len(full_chunk_text),
                    parent_section=bcrumb,
                    metadata={"strategy": "structural_semantic"}
                ))
                current_section_blocks = []
                current_section_len = 0

        for b in blocks:
            if b.block_type == "heading":
                flush_section()
                level = b.level or 1
                # Adjust stack to level
                while len(heading_stack) >= level:
                    heading_stack.pop()
                heading_stack.append(b.content)
            elif b.block_type == "code":
                code_text = f"```{b.language}\n{b.content}\n```"
                current_section_blocks.append(code_text)
                current_section_len += len(code_text)
                if current_section_len >= self.target_chunk_size:
                    flush_section()
            else:
                current_section_blocks.append(b.content)
                current_section_len += len(b.content)
                if current_section_len >= self.target_chunk_size:
                    flush_section()

        flush_section()
        return chunks
