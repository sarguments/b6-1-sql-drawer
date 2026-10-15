"""원본 SQL을 메모리 SQLite에서만 실행하고 시연용 evidence.json을 만든다."""
import argparse
import hashlib
import json
import os
import re
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("repo", type=Path)
args = parser.parse_args()
repo = args.repo.resolve()
sources = {name: (repo / name).read_text(encoding="utf-8") for name in ("schema.sql", "seed.sql", "queries.sql")}
db = sqlite3.connect(":memory:")
db.row_factory = sqlite3.Row
db.executescript(sources["schema.sql"])
db.executescript(sources["seed.sql"])
names = ["equipment", "technician", "component", "maintenance", "alarm_log"]

def tables():
    return {n: [dict(r) for r in db.execute(f'SELECT * FROM "{n}" ORDER BY id')] for n in names}

def run(sql):
    cursor = db.execute(sql)
    if cursor.description:
        return {"columns": [c[0] for c in cursor.description], "rows": [list(r) for r in cursor.fetchall()]}
    return {"columns": [], "rows": [], "affected": cursor.rowcount}

payload = {"created": datetime.now(timezone.utc).isoformat(), "source": os.path.relpath(repo, Path(__file__).resolve().parent), "sqlite": sqlite3.sqlite_version,
           "digests": {k: hashlib.sha256(v.encode()).hexdigest() for k, v in sources.items()},
           "tables": tables(), "schema": {}, "queries": []}
for n in names:
    payload["schema"][n] = {"columns": [dict(r) for r in db.execute(f'PRAGMA table_info("{n}")')],
                            "foreignKeys": [dict(r) for r in db.execute(f'PRAGMA foreign_key_list("{n}")')]}
blocks = re.split(r"(?m)^-- (Q\d{2}): ", sources["queries.sql"])
for i in range(1, len(blocks), 2):
    qid, block = blocks[i:i+2]
    title = block.splitlines()[0]
    sql = "\n".join(l for l in block.splitlines()[1:] if not l.strip().startswith("--")).strip()
    before = tables() if qid in ("Q13", "Q14") else None
    outputs = []
    for stmt in sql.split(";"):
        if stmt.strip():
            outputs.append(run(stmt.strip()))
    item = {"id": qid, "title": title, "sql": sql, "outputs": outputs}
    if before is not None:
        item["before"] = before
        item["after"] = tables()
    payload["queries"].append(item)
match_sql = "SELECT id, equipment_id, started_at, duration_min FROM maintenance WHERE equipment_id = 5 AND started_at >= '2026-07-01'"
payload["indexMatches"] = run(match_sql)
# 이 INSERT는 설명용 실패 사례. 시드의 실제 정비값을 복제하되 부모 번호만 없는 번호로 바꾼다.
r = dict(db.execute("SELECT * FROM maintenance WHERE id = 2").fetchone())
r.pop("id")
r["equipment_id"] = 999999
cols = list(r)
invalid_sql = f'INSERT INTO maintenance ({", ".join(cols)}) VALUES ({", ".join("?" for _ in cols)})'
try:
    db.execute(invalid_sql, [r[c] for c in cols])
    raise RuntimeError("없는 부모가 허용됨")
except sqlite3.IntegrityError as exc:
    payload["fkFailure"] = {"sql": invalid_sql, "values": [r[c] for c in cols], "error": str(exc), "equipment_id": 999999}
assert len(payload["queries"]) == 15
assert sum(len(rs) for rs in payload["tables"].values()) == 94
out = Path(__file__).resolve().parent / "evidence.json"
out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"tables": {n: len(v) for n, v in payload["tables"].items()}, "queries": len(payload["queries"]),
                  "indexMatches": payload["indexMatches"], "fkFailure": payload["fkFailure"]["error"]}, ensure_ascii=False))
