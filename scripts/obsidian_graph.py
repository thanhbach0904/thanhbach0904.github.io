#!/usr/bin/env python3
"""Turn one Obsidian note + its linked notes into a Jekyll "graph post".

GitHub Pages runs Jekyll without custom plugins, so the conversion happens here,
locally, and the generated files are committed:

  _posts/<post>.md                      main note body (front matter is preserved)
  _includes/notes/<name>/<slug>.md      one file per linked note
  _data/notegraphs/<name>.json          nodes + links for the graph
  assets/images/notes/<name>/*          embedded images

The graph is the connected component of the main note when wikilinks are read
in both directions (like Obsidian's local graph with backlinks).

Example:
  python scripts/obsidian_graph.py \
      --vault "C:/Users/Admin/JAIST/theory/Magnetic" \
      --main "Hard Magnetic Materials - A perspective (J.M.D Coey)" \
      --name magnetic --post _posts/2026-11-17-magnetic.md
"""
from __future__ import annotations

import argparse
import html
import json
import math
import re
import shutil
import unicodedata
from collections import deque
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
WIKILINK = re.compile(r"(!?)\[\[([^\]|#]+)(#[^\]|]*)?(?:\|([^\]]+))?\]\]")
INLINE_MATH = re.compile(r"(?<!\$)\$([^$\n]+?)\$(?!\$)")
IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif"}


def slugify(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-zA-Z0-9]+", "-", text).strip("-").lower()


def short_title(title: str) -> str:
    return re.split(r" \(| - ", title, maxsplit=1)[0].strip()


def link_targets(md: str) -> list[str]:
    return [m.group(2).strip() for m in WIKILINK.finditer(md)
            if Path(m.group(2)).suffix.lower() not in IMAGE_EXT]


def protect_pipes(tex: str) -> str:
    # kramdown may read a bare "|" as a table cell separator; \vert is the same glyph.
    return re.sub(r"(?<!\\)\|", r"\\vert ", tex)


def convert_math(md: str) -> str:
    """Obsidian math -> kramdown math ($$...$$ inline and block)."""
    out: list[str] = []
    lines = md.split("\n")
    i, in_code = 0, False
    while i < len(lines):
        line = lines[i]
        if line.lstrip().startswith("```"):
            in_code = not in_code
            out.append(line)
            i += 1
            continue
        if not in_code and line.strip() == "$$":
            j = i + 1
            while j < len(lines) and lines[j].strip() != "$$":
                j += 1
            # kramdown math blocks may not contain blank lines.
            tex = "\n".join(l for l in lines[i + 1:j] if l.strip())
            if "\\\\" in tex:  # bare line breaks need an environment to render
                tex = "\\begin{gathered}\n" + tex + "\n\\end{gathered}"
            out += ["", "$$", protect_pipes(tex), "$$", ""]
            i = j + 1
            continue
        if not in_code:
            if re.fullmatch(r"\s*[-*+]\s*", line):
                i += 1  # empty bullet: kramdown would read it as a setext heading underline
                continue
            is_table_row = line.lstrip().startswith("|")
            parts = INLINE_MATH.split(line)  # even indices: prose, odd: math
            line = "".join(
                ("$$" + protect_pipes(p) + "$$") if k % 2
                # kramdown treats any line with a bare "|" as a table row (e.g. page
                # titles like "Foo | Blog" in link text), so escape it in prose.
                else (p if is_table_row else re.sub(r"(?<!\\)\|", r"\\|", p))
                for k, p in enumerate(parts))
        out.append(line)
        i += 1
    return "\n".join(out)


def demote_headings(md: str, by: int) -> str:
    return re.sub(r"^(#{1,6})(?=\s)",
                  lambda m: "#" * min(6, len(m.group(1)) + by), md, flags=re.M)


class Converter:
    def __init__(self, vault: Path, name: str, slugs: dict[str, str], existing: set[str]):
        self.vault = vault
        self.name = name
        self.slugs = slugs
        self.existing = existing
        self.img_dir = REPO / "assets" / "images" / "notes" / name
        self.files = {p.name: p for p in vault.rglob("*") if p.is_file() and ".obsidian" not in p.parts}

    def _replace(self, m: re.Match) -> str:
        embed, target, _, alias = m.group(1), m.group(2).strip(), m.group(3), m.group(4)
        if Path(target).suffix.lower() in IMAGE_EXT:
            src = self.files.get(target)
            if src is None:
                print(f"  warning: image not found: {target}")
                return m.group(0)
            dest = slugify(Path(target).stem) + Path(target).suffix.lower()
            self.img_dir.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, self.img_dir / dest)
            return f"![{html.escape(alias or Path(target).stem)}](/assets/images/notes/{self.name}/{dest})"
        slug = self.slugs.get(target)
        if slug is None:
            return html.escape(alias or target)
        cls = "wikilink" if target in self.existing else "wikilink wikilink--empty"
        label = html.escape(alias or target)
        return f'<a class="{cls}" href="#note-{slug}" data-note="{slug}">{label}</a>'

    def convert(self, md: str, heading_shift: int) -> str:
        md = WIKILINK.sub(self._replace, md)
        md = convert_math(md)
        md = demote_headings(md, heading_shift)
        md = md.strip() + "\n"
        if "{{" in md or "{%" in md:  # LaTeX like _{{x}} would be read as Liquid
            md = "{% raw %}\n" + md + "{% endraw %}\n"
        return md


def default_front_matter(title: str, name: str, read_time: int, date: str) -> str:
    return (
        "---\n"
        "# Body below the front matter is generated by scripts/obsidian_graph.py.\n"
        "# Edit the Obsidian note and re-run the script; front matter is kept.\n"
        "layout: graph-post\n"
        f"title: {json.dumps(title, ensure_ascii=False)}\n"
        f"date: {date}\n"
        "tag: technical\n"
        "description: \"Ghi chú đọc bài báo của J.M.D. Coey về vật liệu từ cứng\"\n"
        f"read_time: {read_time}\n"
        "math: true\n"
        f"notegraph: {name}\n"
        "---\n"
    )


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vault", type=Path, required=True)
    ap.add_argument("--main", required=True, help="main note title (file name without .md)")
    ap.add_argument("--name", required=True, help="graph id, used in paths and front matter")
    ap.add_argument("--post", type=Path, required=True, help="post file, relative to repo root")
    args = ap.parse_args()

    notes = {p.stem: p.read_text(encoding="utf-8")
             for p in args.vault.rglob("*.md") if ".obsidian" not in p.parts}
    if args.main not in notes:
        raise SystemExit(f"main note not found: {args.main}")

    forward = {t: [x for x in dict.fromkeys(link_targets(md))] for t, md in notes.items()}
    undirected: dict[str, set[str]] = {}
    for src, targets in forward.items():
        for dst in targets:
            undirected.setdefault(src, set()).add(dst)
            undirected.setdefault(dst, set()).add(src)

    component, queue = [args.main], deque([args.main])
    while queue:
        for nb in sorted(undirected.get(queue.popleft(), ())):
            if nb not in component:
                component.append(nb)
                queue.append(nb)

    slugs = {t: slugify(t) for t in component}
    if len(set(slugs.values())) != len(slugs):
        raise SystemExit("slug collision; rename a note")
    existing = {t for t in component if notes.get(t, "").strip()}

    inc_dir = REPO / "_includes" / "notes" / args.name
    img_dir = REPO / "assets" / "images" / "notes" / args.name
    for d in (inc_dir, img_dir):  # fully generated: wipe stale files
        if d.exists():
            shutil.rmtree(d)
    inc_dir.mkdir(parents=True)

    conv = Converter(args.vault, args.name, slugs, existing)
    for title in component[1:]:
        if title in existing:
            (inc_dir / f"{slugs[title]}.md").write_text(conv.convert(notes[title], 2), encoding="utf-8")

    post_path = REPO / args.post
    body = conv.convert(notes[args.main], 1)
    old = post_path.read_text(encoding="utf-8") if post_path.exists() else ""
    fm_match = re.match(r"^---\n.*?\n---\n", old, flags=re.S)
    if fm_match:
        front = fm_match.group(0)
    else:
        date = re.match(r"(\d{4}-\d{2}-\d{2})", post_path.name)
        words = len(re.findall(r"\w+", notes[args.main]))
        front = default_front_matter(args.main, args.name, max(1, math.ceil(words / 200)),
                                     date.group(1) if date else "2026-01-01")
    post_path.write_text(front + "\n" + body, encoding="utf-8")

    nodes = [{"id": slugs[t], "title": t, "short": "Bài chính" if t == args.main else short_title(t),
              "main": t == args.main, "empty": t not in existing} for t in component]
    links = [{"source": slugs[s], "target": slugs[d]}
             for s in component for d in forward.get(s, []) if d in slugs and d != s]
    data_dir = REPO / "_data" / "notegraphs"
    data_dir.mkdir(parents=True, exist_ok=True)
    (data_dir / f"{args.name}.json").write_text(
        json.dumps({"main": slugs[args.main], "nodes": nodes, "links": links},
                   ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{len(nodes)} notes ({len(nodes) - len(existing)} empty), {len(links)} links")
    for n in nodes:
        print(f"  {'*' if n['main'] else ' '} {n['id']}{'  (empty)' if n['empty'] else ''}")


if __name__ == "__main__":
    main()
