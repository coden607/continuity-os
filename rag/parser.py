"""
Continuity OS · Docling & Paperclip Style Document Parser
Parses Markdown, Text, and Code into hierarchical structured blocks:
- Headings with nesting level
- Paragraphs
- Code blocks (with language tag)
- Tables
- Lists
Preserves structural metadata for high-precision semantic chunking.
"""

import re
from typing import List, Dict, Any, Optional
from pydantic import BaseModel


class DocumentBlock(BaseModel):
    block_type: str  # heading, paragraph, code, table, list_item
    content: str
    level: Optional[int] = None  # For headings (1-6)
    language: Optional[str] = None  # For code blocks
    metadata: Dict[str, Any] = {}


class DoclingParser:
    """Lightweight Docling/Paperclip architecture document parser."""

    def parse(self, text: str, source_name: str = "document") -> List[DocumentBlock]:
        blocks: List[DocumentBlock] = []
        lines = text.split("\n")
        in_code_block = False
        code_lang = ""
        code_lines: List[str] = []
        para_lines: List[str] = []

        def flush_paragraph():
            nonlocal para_lines
            if para_lines:
                p_text = "\n".join(para_lines).strip()
                if p_text:
                    blocks.append(DocumentBlock(block_type="paragraph", content=p_text))
                para_lines = []

        for line in lines:
            stripped = line.strip()

            # Code fence start/end
            if stripped.startswith("```"):
                if in_code_block:
                    # Closing code block
                    code_content = "\n".join(code_lines)
                    blocks.append(DocumentBlock(
                        block_type="code",
                        content=code_content,
                        language=code_lang or "text"
                    ))
                    code_lines = []
                    in_code_block = False
                    code_lang = ""
                else:
                    # Opening code block
                    flush_paragraph()
                    in_code_block = True
                    code_lang = stripped[3:].strip()
                continue

            if in_code_block:
                code_lines.append(line)
                continue

            # Heading (Markdown style)
            heading_match = re.match(r'^(#{1,6})\s+(.*)$', stripped)
            if heading_match:
                flush_paragraph()
                level = len(heading_match.group(1))
                h_text = heading_match.group(2).strip()
                blocks.append(DocumentBlock(
                    block_type="heading",
                    content=h_text,
                    level=level
                ))
                continue

            # Table row
            if stripped.startswith("|") and stripped.endswith("|"):
                # Table delimiter or data row
                if re.match(r'^\|[\s\-:|]+\|$', stripped):
                    continue  # Table separator
                flush_paragraph()
                blocks.append(DocumentBlock(
                    block_type="table_row",
                    content=stripped
                ))
                continue

            # List item
            if re.match(r'^[-*+]\s+', stripped) or re.match(r'^\d+\.\s+', stripped):
                flush_paragraph()
                blocks.append(DocumentBlock(
                    block_type="list_item",
                    content=stripped
                ))
                continue

            # Blank line flushes paragraph
            if not stripped:
                flush_paragraph()
                continue

            # Regular paragraph text
            para_lines.append(line)

        flush_paragraph()

        # Handle unclosed code block
        if in_code_block and code_lines:
            blocks.append(DocumentBlock(
                block_type="code",
                content="\n".join(code_lines),
                language=code_lang or "text"
            ))

        return blocks
