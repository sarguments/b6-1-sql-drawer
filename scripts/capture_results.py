"""쿼리 15개의 실행 결과를 텍스트로 남기는 스크립트.

스키마와 샘플 데이터를 새 데이터베이스에 다시 채운 뒤 queries.sql을 앞에서부터 실행하고,
쿼리마다 결과를 results/ 폴더에 텍스트 표로 저장한다. 손으로 복사한 캡처 대신 같은 명령으로
다시 만들 수 있는 실행 결과를 남기려는 목적이다.

실행: python3 scripts/capture_results.py
"""

from __future__ import annotations

import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "b6-1.sqlite3"
QUERIES_PATH = ROOT / "queries.sql"
RESULTS_DIR = ROOT / "results"
MARKER = re.compile(r"^--\s*(Q\d{2}[a-z]?):\s*(.+)$")
INDEX_QUERY = (
    "SELECT name FROM sqlite_master "
    "WHERE type = 'index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
)
MIN_ROWS = 10  # 요구사항: 각 테이블에 최소 10행
CELL_LIMIT = 40


def run_script(conn: sqlite3.Connection, path: Path) -> None:
    """스키마·샘플 데이터 파일을 한 번에 실행한다."""
    conn.executescript(path.read_text(encoding="utf-8"))


def split_blocks(text: str) -> list[tuple[str, str, list[str]]]:
    """queries.sql을 쿼리 단위로 나눈다. (쿼리 이름, 설명, 문장 목록)의 목록을 돌려준다."""
    blocks: list[tuple[str, str, list[str]]] = []
    body: list[str] = []
    name: str | None = None
    desc = ""
    for line in text.splitlines():
        found = MARKER.match(line.strip())
        if found:
            if name is not None:
                blocks.append((name, desc, split_statements(body)))
            name, desc = found.group(1), found.group(2).strip()
            body = []
            continue
        if name is not None and not line.strip().startswith("--"):
            body.append(line)
    if name is not None:
        blocks.append((name, desc, split_statements(body)))
    return blocks


def split_statements(body: list[str]) -> list[str]:
    """문장을 세미콜론으로 나눈다. 문자열 안에 세미콜론을 쓰지 않는 규칙을 지킨다."""
    raw = "\n".join(body)
    return [s.strip() for s in raw.split(";") if s.strip()]


def render_table(columns: list[str], rows: list[tuple]) -> str:
    """결과를 고정 폭 텍스트 표로 만든다."""
    if not rows:
        return "(결과 행 없음)"

    def cell(value: object) -> str:
        if value is None:
            return "NULL"
        text = str(value)
        return text if len(text) <= CELL_LIMIT else text[: CELL_LIMIT - 1] + "…"

    grid = [[cell(v) for v in row] for row in rows]
    widths = [len(c) for c in columns]
    for row in grid:
        for i, value in enumerate(row):
            widths[i] = max(widths[i], len(value))
    sep = "-+-".join("-" * w for w in widths)
    head = " | ".join(c.ljust(w) for c, w in zip(columns, widths))
    lines = [head, sep]
    lines += [" | ".join(v.ljust(w) for v, w in zip(row, widths)) for row in grid]
    return "\n".join(lines)


def run_block(conn: sqlite3.Connection, statements: list[str]) -> str:
    """한 쿼리 묶음을 실행하고 결과 텍스트를 만든다."""
    chunks: list[str] = []
    for statement in statements:
        cursor = conn.execute(statement)
        if cursor.description is None:
            chunks.append(f"[변경] {cursor.rowcount}행 적용")
            continue
        columns = [d[0] for d in cursor.description]
        rows = cursor.fetchall()
        chunks.append(render_table(columns, rows) + f"\n({len(rows)}행)")
    return "\n\n".join(chunks)


def table_rows(conn: sqlite3.Connection, table: str) -> int:
    return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


def write(path: Path, text: str) -> None:
    path.write_text(text.rstrip() + "\n", encoding="utf-8")


def main() -> int:
    for path in (ROOT / "schema.sql", ROOT / "seed.sql", QUERIES_PATH):
        if not path.exists():
            print(f"필요한 파일이 없다: {path.name}", file=sys.stderr)
            return 1

    RESULTS_DIR.mkdir(exist_ok=True)
    if DB_PATH.exists():
        DB_PATH.unlink()

    conn = sqlite3.connect(DB_PATH)
    run_script(conn, ROOT / "schema.sql")
    run_script(conn, ROOT / "seed.sql")

    tables = ["equipment", "technician", "component", "maintenance", "alarm_log"]
    counts = {t: table_rows(conn, t) for t in tables}
    short = [t for t, n in counts.items() if n < MIN_ROWS]

    summary = [
        "환경",
        f"- sqlite3 라이브러리 버전: {sqlite3.sqlite_version}",
        f"- 파이썬: {sys.version.split()[0]}",
        f"- 데이터베이스: {DB_PATH.name} (스키마·샘플 데이터를 새로 채운 뒤 실행)",
        "",
        "테이블별 행 수 (요구: 최소 10행)",
    ]
    summary += [f"- {t}: {n}행" + ("  ← 10행 미만" if n < MIN_ROWS else "") for t, n in counts.items()]

    fk_issues = conn.execute("PRAGMA foreign_key_check").fetchall()
    summary += [
        "",
        "무결성",
        f"- PRAGMA foreign_key_check: {'문제 없음' if not fk_issues else fk_issues}",
    ]

    blocks = split_blocks(QUERIES_PATH.read_text(encoding="utf-8"))
    summary += ["", "쿼리 15개 실행 결과"]
    for name, desc, statements in blocks:
        result = run_block(conn, statements)
        write(RESULTS_DIR / f"{name}.txt", f"{name} — {desc}\n\n{result}")
        summary.append(f"- {name}: {desc}")

    summary.append(f"- Q15 실행 후 등록된 인덱스: {[r[0] for r in conn.execute(INDEX_QUERY)]}")

    # 보너스 1: 같은 요구를 JOIN과 서브쿼리 두 방식으로 풀어 비교한다.
    requirement = "정비 이력이 있는 설비만 고르기"
    with_join = render_table(
        ["asset_code", "name"],
        conn.execute(
            "SELECT DISTINCT e.asset_code, e.name FROM equipment AS e "
            "INNER JOIN maintenance AS m ON m.equipment_id = e.id ORDER BY e.asset_code"
        ).fetchall(),
    )
    with_subquery = render_table(
        ["asset_code", "name"],
        conn.execute(
            "SELECT e.asset_code, e.name FROM equipment AS e WHERE EXISTS "
            "(SELECT 1 FROM maintenance AS m WHERE m.equipment_id = e.id) ORDER BY e.asset_code"
        ).fetchall(),
    )
    write(
        RESULTS_DIR / "bonus1-join-vs-subquery.txt",
        f"보너스 1 — 같은 요구({requirement})를 두 방식으로 풀기\n\n"
        f"[JOIN 방식]\n{with_join}\n\n[서브쿼리 방식]\n{with_subquery}\n\n"
        "비교: 결과는 같다. JOIN은 연결된 행을 실제로 만들어 세어야 할 때(예: 건수·합계 집계) 쓰고, "
        "서브쿼리(EXISTS)는 '있냐 없냐'만 볼 때 쓴다. EXISTS는 조건에 맞는 행을 찾으면 거기서 멈춘다.",
    )

    # 보너스 2: 없는 부모 값을 넣어 FK가 실제로 막는지 확인한다.
    bad_sql = (
        "INSERT INTO maintenance (equipment_id, technician_id, kind, started_at, duration_min) "
        "VALUES (999, 1, 'PERIODIC', '2026-10-01 09:00:00', 30)"
    )
    try:
        conn.execute(bad_sql)
        fk_result = "막지 못했다 — FOREIGN KEY 설정을 확인해야 한다"
    except sqlite3.IntegrityError as error:
        fk_result = f"막았다 — sqlite3.IntegrityError: {error}"
    write(
        RESULTS_DIR / "bonus2-fk-violation.txt",
        "보너스 2 — 데이터 정합성 깨뜨려 보기\n\n"
        f"시도한 SQL\n{bad_sql}\n\n결과\n- {fk_result}\n\n"
        "왜 막히는가: equipment_id 999는 equipment에 없다. schema.sql 첫 줄의 "
        "PRAGMA foreign_keys = ON 이 켜져 있어야 이 검사가 동작한다. SQLite는 기본이 꺼짐이다.\n"
        "어떻게 고치는가: 없는 부모를 참조한 것이므로 ① equipment에 해당 설비를 먼저 넣거나 "
        "② 실제 설비 id로 바꿔 넣는다.",
    )

    write(RESULTS_DIR / "00-summary.txt", "\n".join(summary))
    conn.close()

    print("\n".join(summary))
    if short:
        print(f"\n10행 미만 테이블: {short}", file=sys.stderr)
        return 1
    print(f"\n결과 파일 {len(list(RESULTS_DIR.glob('*.txt')))}개를 {RESULTS_DIR.name}/ 에 썼다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
