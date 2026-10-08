#!/usr/bin/env python3
"""Builds the presentations list from the files in presentations/slides/.

GitHub runs this automatically (.github/workflows/presentations.yml) whenever something in
presentations/slides/ changes, so nobody needs to run it by hand. It writes:
  data/presentations.json     the list the website reads
  presentations/thumbs/*.jpg  the first slide of each deck, used as the card image

File names are read as "2026-10-14 Intro to Git (Rishi B.).pdf": date, title, then the presenter
in parentheses. Date and presenter are optional; without a date, the day the file was added is used.

Needs pdftoppm (poppler-utils), plus LibreOffice for PowerPoint thumbnails.
"""
import hashlib
import json
import re
import shutil
import subprocess
import tempfile
import urllib.parse
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SLIDES = ROOT / "presentations" / "slides"
THUMBS = ROOT / "presentations" / "thumbs"
OUT = ROOT / "data" / "presentations.json"
SITE = "https://crhs-cs.github.io"
KINDS = {".pdf": "pdf", ".pptx": "powerpoint", ".ppt": "powerpoint"}


def parse_name(stem):
    """'2026-10-14 Intro to Git (Rishi B.)' -> (date, title, presenter). Each part is optional."""
    s, when, presenter = stem.strip(), "", ""
    m = re.match(r"^(\d{4})[-_.](\d{1,2})[-_.](\d{1,2})\s*[-–—:_]?\s*", s)
    if m:
        try:
            when = date(int(m[1]), int(m[2]), int(m[3])).isoformat()
            s = s[m.end():]
        except ValueError:
            pass
    p = re.search(r"\s*\(([^()]+)\)\s*$", s)
    if p:
        presenter, s = p[1].strip(), s[:p.start()]
    return when, s.strip() or stem, presenter


def added_on(path):
    """The day the file was first committed, or its modified date outside git."""
    try:
        out = subprocess.run(["git", "log", "--diff-filter=A", "--follow", "--format=%as", "--", str(path)],
                             cwd=ROOT, capture_output=True, text=True, timeout=30).stdout.split()
        if out:
            return out[-1]
    except (OSError, subprocess.SubprocessError):
        pass
    return datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()


def first_slide(src, dest):
    """Renders the first page/slide of src to dest (JPEG, 960px wide). Returns True on success."""
    with tempfile.TemporaryDirectory() as tmp:
        pdf = src
        if src.suffix.lower() != ".pdf":
            soffice = shutil.which("soffice") or shutil.which("libreoffice")
            if not soffice:
                print(f"  no LibreOffice, skipping thumbnail for {src.name}")
                return False
            copy = Path(tmp) / ("deck" + src.suffix.lower())   # plain name: LibreOffice dislikes some characters
            shutil.copy(src, copy)
            subprocess.run([soffice, "--headless", f"-env:UserInstallation=file://{tmp}/lo",
                            "--convert-to", "pdf", "--outdir", tmp, str(copy)],
                           capture_output=True, timeout=300)
            pdf = Path(tmp) / "deck.pdf"
            if not pdf.exists():
                print(f"  could not convert {src.name}")
                return False
        prefix = Path(tmp) / "thumb"
        r = subprocess.run(["pdftoppm", "-jpeg", "-jpegopt", "quality=82", "-f", "1", "-l", "1",
                            "-scale-to", "960", "-singlefile", str(pdf), str(prefix)],
                           capture_output=True, timeout=120)
        out = prefix.with_suffix(".jpg")
        if r.returncode or not out.exists():
            print(f"  could not render {src.name}: {r.stderr.decode(errors='replace').strip()}")
            return False
        shutil.move(out, dest)
        return True


def main():
    SLIDES.mkdir(parents=True, exist_ok=True)
    THUMBS.mkdir(parents=True, exist_ok=True)
    try:
        previous = {p["file"]: p for p in json.loads(OUT.read_text())}
    except (OSError, ValueError, KeyError, TypeError):
        previous = {}

    items, keep = [], set()
    for path in sorted(SLIDES.iterdir()):
        kind = KINDS.get(path.suffix.lower())
        if not path.is_file() or not kind or path.name.startswith("."):
            continue
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        when, title, presenter = parse_name(path.stem)
        slug = re.sub(r"[^a-z0-9]+", "-", path.stem.lower()).strip("-")[:60] or "deck"
        thumb_name = f"{slug}-{digest[:8]}.jpg"   # new name whenever the file changes, so browsers never show an old one

        old = previous.get(path.name)
        if old and old.get("sha256") == digest and (THUMBS / thumb_name).exists():
            has_thumb = True
        else:
            print(f"Rendering {path.name}")
            has_thumb = first_slide(path, THUMBS / thumb_name)
        if has_thumb:
            keep.add(thumb_name)

        file_url = "/presentations/slides/" + urllib.parse.quote(path.name)
        # Browsers open PDFs themselves; PowerPoint files open in Microsoft's free web viewer.
        href = file_url if kind == "pdf" else \
            "https://view.officeapps.live.com/op/view.aspx?src=" + urllib.parse.quote(SITE + file_url, safe="")
        items.append({
            "title": title,
            "presenter": presenter,
            "date": when or added_on(path),
            "file": path.name,
            "kind": kind,
            "slides": href,
            "download": file_url,
            "thumb": f"/presentations/thumbs/{thumb_name}" if has_thumb else "",
            "sha256": digest,
        })

    for old_thumb in THUMBS.glob("*.jpg"):
        if old_thumb.name not in keep:
            old_thumb.unlink()

    items.sort(key=lambda p: (p["date"], p["title"]), reverse=True)
    OUT.write_text(json.dumps(items, indent=2, ensure_ascii=False) + "\n")
    print(f"{len(items)} presentation(s) listed")


if __name__ == "__main__":
    main()
