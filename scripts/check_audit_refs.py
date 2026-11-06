#!/usr/bin/env python3
"""Valida las referencias de código de las auditorías.

Formato canónico:

    backend/members/services.py · RegistrationService.register
    frontend/src/pages/Members.jsx · Members

También acepta referencias históricas con línea:

    backend/members/services.py:101-208

Las referencias canónicas rotas son errores. Las líneas fuera de rango son
advertencias, salvo que se use ``--strict-lines``. Las referencias negativas
(``No existe ...``) se ignoran.

Uso:

    python3 scripts/check_audit_refs.py
    python3 scripts/check_audit_refs.py AUDITORIA-MIEMBROS.md
    python3 scripts/check_audit_refs.py --strict-lines AUDITORIA-*.md
"""

from __future__ import annotations

import argparse
import glob
import re
import sys
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent

FENCE_RE = re.compile(r"```.*?```", re.S)
CODE_SPAN_RE = re.compile(r"`([^`\n]+)`")

# ``backend/members/services.py · RegistrationService.register``
CANONICAL_RE = re.compile(
    r"^(?P<path>(?:backend|frontend|scripts|\.github)/[^`\s·]+?)"
    r"(?::(?P<start>\d+)(?:-(?P<end>\d+))?)?"
    r"\s+·\s+"
    r"(?P<symbol>[A-Za-z_][\w.]*)$"
)

# ``backend/members/services.py`` o ``backend/members/services.py:101-208``
PATH_LINE_RE = re.compile(
    r"^(?P<path>(?:backend|frontend|scripts|\.github)/[^`\s:]+?)"
    r"(?::(?P<start>\d+)(?:-(?P<end>\d+))?)?$"
)

# Archivos sueltos de la raíz que también se citan.
ROOT_FILE_RE = re.compile(
    r"^(?P<path>"
    r"Procfile|requirements\.txt|BUGS\.md|PLAN-bugs\.md|"
    r"RESTORE-BACKUPS\.md|RELEASE-CHECKLIST\.md|"
    r"Actualizacion de auditorias\.md"
    r")"
    r"(?::(?P<start>\d+)(?:-(?P<end>\d+))?)?$"
)


@dataclass(frozen=True)
class Ref:
    doc_line: int
    raw: str
    path: str
    symbol: str | None = None
    start: int | None = None
    end: int | None = None


@dataclass(frozen=True)
class Issue:
    severity: str
    doc_line: int
    raw: str
    message: str


def strip_fenced_blocks(text: str) -> str:
    """Reemplaza los bloques ``` por espacios conservando los saltos de línea."""

    def repl(match: re.Match[str]) -> str:
        return "".join(
            "\n" if char == "\n" else " " for char in match.group(0)
        )

    return FENCE_RE.sub(repl, text)


def line_of(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def parse_ref(raw: str, doc_line: int) -> Ref | None:
    value = raw.strip()

    # Referencias deliberadamente abreviadas en el texto, no rutas reales.
    if "..." in value or "…" in value:
        return None

    canonical = CANONICAL_RE.match(value)
    if canonical:
        return Ref(
            doc_line=doc_line,
            raw=value,
            path=canonical.group("path"),
            symbol=canonical.group("symbol"),
            start=_to_int(canonical.group("start")),
            end=_to_int(canonical.group("end")),
        )

    path_line = PATH_LINE_RE.match(value)
    if path_line:
        return Ref(
            doc_line=doc_line,
            raw=value,
            path=path_line.group("path"),
            start=_to_int(path_line.group("start")),
            end=_to_int(path_line.group("end")),
        )

    root_file = ROOT_FILE_RE.match(value)
    if root_file:
        return Ref(
            doc_line=doc_line,
            raw=value,
            path=root_file.group("path"),
            start=_to_int(root_file.group("start")),
            end=_to_int(root_file.group("end")),
        )

    return None


def _to_int(value: str | None) -> int | None:
    return int(value) if value else None


def line_text(text: str, offset: int) -> str:
    start = text.rfind("\n", 0, offset) + 1
    end = text.find("\n", offset)
    return text[start:end if end != -1 else len(text)]


def extract_refs(text: str) -> list[Ref]:
    clean = strip_fenced_blocks(text)
    refs: list[Ref] = []
    for match in CODE_SPAN_RE.finditer(clean):
        # Referencias negativas: documentan que un archivo no existe.
        context = line_text(clean, match.start())
        if re.search(r"\b(no existe|no hay)\b", context, re.IGNORECASE):
            continue

        ref = parse_ref(match.group(1), line_of(clean, match.start()))
        if ref is not None:
            refs.append(ref)
    return refs


def resolve_paths(path: str) -> list[Path]:
    if any(char in path for char in "*?["):
        return sorted(
            candidate
            for candidate in ROOT.glob(path)
            if candidate.exists()
        )

    candidate = ROOT / path
    if candidate.exists():
        return [candidate]

    # Referencias abreviadas del tipo ``migrations/0001``: se resuelven
    # contra el primer archivo o directorio que empiece con ese nombre.
    parent = candidate.parent
    if parent.is_dir():
        prefix_matches = sorted(
            child
            for child in parent.iterdir()
            if child.name.startswith(candidate.name)
        )
        if prefix_matches:
            return prefix_matches

    return []


def symbol_tokens(symbol: str) -> list[str]:
    return [
        token
        for token in re.split(r"[.\s]+", symbol.strip())
        if token
    ]


def validate_ref(ref: Ref, strict_lines: bool) -> list[Issue]:
    issues: list[Issue] = []
    paths = resolve_paths(ref.path)

    if not paths:
        issues.append(
            Issue(
                "error",
                ref.doc_line,
                ref.raw,
                f"no existe el archivo o glob: {ref.path}",
            )
        )
        return issues

    if ref.symbol:
        tokens = symbol_tokens(ref.symbol)
        missing: list[str] = []
        for path in paths:
            try:
                content = path.read_text(encoding="utf-8", errors="ignore")
            except OSError as exc:
                issues.append(
                    Issue(
                        "error",
                        ref.doc_line,
                        ref.raw,
                        f"no se pudo leer {path.relative_to(ROOT)}: {exc}",
                    )
                )
                continue

            missing = [
                token
                for token in tokens
                if not re.search(rf"\b{re.escape(token)}\b", content)
            ]
            if missing:
                break

        if missing:
            names = ", ".join(missing)
            issues.append(
                Issue(
                    "error",
                    ref.doc_line,
                    ref.raw,
                    f"símbolo no encontrado en {ref.path}: {names}",
                )
            )

    if ref.start is not None:
        for path in paths:
            try:
                total = len(
                    path.read_text(
                        encoding="utf-8",
                        errors="ignore",
                    ).splitlines()
                )
            except OSError:
                continue

            end = ref.end if ref.end is not None else ref.start
            if ref.start < 1 or end < ref.start or end > total:
                severity = "error" if strict_lines else "warning"
                issues.append(
                    Issue(
                        severity,
                        ref.doc_line,
                        ref.raw,
                        (
                            f"línea fuera de rango en "
                            f"{path.relative_to(ROOT)} "
                            f"(archivo: {total} líneas)"
                        ),
                    )
                )

    return issues


def default_files() -> list[Path]:
    return sorted(
        path
        for path in ROOT.glob("AUDITORIA-*.md")
        if path.name not in {"AUDITORIA-PLANTILLA.md"}
    )


def expand_files(values: list[str]) -> list[Path]:
    files: list[Path] = []
    for value in values:
        candidate = Path(value)
        if candidate.is_file():
            files.append(candidate.resolve())
            continue
        matches = sorted(Path(p).resolve() for p in glob.glob(value))
        if not matches:
            print(f"AVISO: no se encontró ningún archivo para {value}", file=sys.stderr)
        files.extend(matches)
    return files


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Valida referencias de código en auditorías Markdown."
    )
    parser.add_argument(
        "files",
        nargs="*",
        help="Archivos a validar. Por defecto, AUDITORIA-*.md.",
    )
    parser.add_argument(
        "--strict-lines",
        action="store_true",
        help="Trata las líneas fuera de rango como errores.",
    )
    args = parser.parse_args()

    files = expand_files(args.files) if args.files else default_files()
    if not files:
        print("No hay archivos para validar.", file=sys.stderr)
        return 1

    total_refs = 0
    all_issues: list[Issue] = []

    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
        except OSError as exc:
            print(f"{path}: no se pudo leer: {exc}", file=sys.stderr)
            all_issues.append(
                Issue("error", 0, str(path), f"no se pudo leer: {exc}")
            )
            continue

        refs = extract_refs(text)
        total_refs += len(refs)
        issues: list[Issue] = []
        for ref in refs:
            issues.extend(validate_ref(ref, args.strict_lines))

        all_issues.extend(issues)

        try:
            label = path.relative_to(ROOT)
        except ValueError:
            label = path

        print(f"{label}: {len(refs)} referencias")
        for issue in issues:
            print(
                f"  {issue.severity.upper():7} "
                f"línea {issue.doc_line}: {issue.raw} — {issue.message}"
            )

    errors = sum(1 for issue in all_issues if issue.severity == "error")
    warnings = sum(1 for issue in all_issues if issue.severity == "warning")

    print()
    print(
        f"Resumen: {len(files)} archivos, {total_refs} referencias, "
        f"{errors} errores, {warnings} advertencias."
    )

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
