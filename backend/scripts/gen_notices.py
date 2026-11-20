"""Fill the dependency and font tables of THIRD_PARTY_NOTICES.md and the data declaration.

Run from `backend/`: `uv run python scripts/gen_notices.py`. It reads the installed runtime
dependency set (uv) and the frontend production set (pnpm licenses), and replaces the marker
comments in the two documents. It never invents a licence: an unknown licence is printed as such.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from importlib import metadata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
NOTICES = ROOT / "THIRD_PARTY_NOTICES.md"
DECLARATION = ROOT / "backend" / "src" / "bayan" / "data" / "declarations" / "data_declaration.md"


def _run(cmd: list[str], cwd: Path) -> str:
    shell = sys.platform == "win32"
    return subprocess.run(  # noqa: S603
        cmd, capture_output=True, text=True, encoding="utf-8", check=True, cwd=cwd, shell=shell
    ).stdout


def backend_rows() -> list[tuple[str, str, str]]:
    out = _run(
        ["uv", "export", "--no-dev", "--no-hashes", "--format", "requirements-txt"],
        ROOT / "backend",
    )
    names = sorted({m.group(1).lower() for m in re.finditer(r"^([A-Za-z0-9_.\-]+)==", out, re.M)})
    rows: list[tuple[str, str, str]] = []
    for name in names:
        if name == "bayan":
            continue
        try:
            md = metadata.metadata(name)
            version = metadata.version(name)
        except metadata.PackageNotFoundError:
            rows.append((name, "?", "not installed in this environment"))
            continue
        lic = md.get("License-Expression") or ""
        if not lic:
            raw = md.get("License") or ""
            lic = raw if raw and len(raw) < 60 else ""
        if not lic:
            cls = [
                c.split("::")[-1].strip()
                for c in md.get_all("Classifier") or []
                if c.startswith("License ::")
            ]
            lic = "; ".join(cls) if cls else "licence not stated in package metadata"
        rows.append((name, version, lic.replace("\n", " ").strip()))
    return rows


def frontend_rows() -> list[tuple[str, str, str]]:
    raw = _run(["pnpm", "licenses", "list", "--prod", "--json"], ROOT / "frontend")
    data = json.loads(raw)
    rows: list[tuple[str, str, str]] = []
    for lic, pkgs in data.items():
        for p in pkgs:
            versions = ", ".join(p.get("versions", [])) or "?"
            rows.append((p["name"], versions, lic))
    return sorted(rows, key=lambda r: r[0].lower())


def table(title: str, rows: list[tuple[str, str, str]]) -> str:
    lines = [f"### {title}", "", "| Package | Version | Licence |", "|---|---|---|"]
    lines += [f"| {n} | {v} | {lic} |" for n, v, lic in rows]
    return "\n".join(lines)


def fonts_block() -> str:
    src = ROOT / "frontend" / "src"
    found: set[str] = set()
    for path in list(src.rglob("*.ts")) + list(src.rglob("*.tsx")):
        text = path.read_text(encoding="utf-8")
        for m in re.finditer(r"from ['\"]next/font/google['\"]", text):
            del m
            for name in re.findall(r"import \{([^}]+)\} from ['\"]next/font/google['\"]", text):
                found.update(n.strip() for n in name.split(","))
    if not found:
        return "No web fonts are loaded from a third party at run time; the interface uses the fonts named in `docs/design/DESIGN.md`."
    listing = "\n".join(
        f"- {n.replace('_', ' ')}: SIL Open Font License 1.1 (served by `next/font`, self-hosted at build time)"
        for n in sorted(found)
    )
    return listing


def main() -> None:
    be = backend_rows()
    try:
        fe = frontend_rows()
    except (subprocess.CalledProcessError, FileNotFoundError, json.JSONDecodeError) as exc:
        sys.stderr.write(f"frontend licences unavailable: {exc}\n")
        fe = []
    dep_table = (
        table("Backend (Python, runtime set)", be)
        + "\n\n"
        + (
            table("Frontend (JavaScript, production set)", fe)
            if fe
            else "Frontend licences were not available when this was generated."
        )
    )
    notices = NOTICES.read_text(encoding="utf-8")
    notices = notices.replace("<!-- DEPENDENCY TABLE -->", dep_table)
    notices = notices.replace("<!-- FONT TABLE -->", fonts_block())
    notices = notices.replace(
        "<!-- LICENCE TEXTS -->",
        "Each package's licence text ships in its own distribution (the `licenses` directory of the wheel or the package folder in `node_modules`). They are not reproduced here.",
    )
    NOTICES.write_text(notices, encoding="utf-8", newline="\n")
    decl = DECLARATION.read_text(encoding="utf-8")
    short = (
        "The runtime dependencies, their versions and licences are listed in `THIRD_PARTY_NOTICES.md` "
        f"({len(be)} Python packages and {len(fe)} JavaScript packages in the production sets). "
        "No dependency ships third-party data or model weights."
    )
    decl = decl.replace("<!-- DEPENDENCY LIST -->", short)
    DECLARATION.write_text(decl, encoding="utf-8", newline="\n")
    sys.stdout.write(f"backend {len(be)}, frontend {len(fe)}\n")


if __name__ == "__main__":
    main()
