-- B6-1 설비 카탈로그·정비 이력 데이터베이스 — 스키마 생성 스크립트
-- 실행: sqlite3 b6-1.sqlite3 < schema.sql   (같은 일을 python3 scripts/capture_results.py 가 자동으로 한다)
--
-- SQLite는 연결마다 외래 키 검사가 기본으로 꺼져 있다. 아래 한 줄이 없으면 자식 테이블에
-- 없는 부모 값을 넣어도 막히지 않는다. 요구사항 3의 "FK가 실제로 동작"은 이 줄에서 나온다.
PRAGMA foreign_keys = ON;

-- 1) 설비 — 카탈로그의 기준 테이블. 정비 이력·부품·알람이 이 표의 id를 참조한다.
CREATE TABLE equipment (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,   -- 자동 증가 정수 키
    asset_code   TEXT    NOT NULL UNIQUE,              -- 자산 코드, 사내에서 유일(UNIQUE)
    name         TEXT    NOT NULL,                     -- 설비 이름
    model        TEXT    NOT NULL,                     -- 제조사 모델명
    line_name    TEXT    NOT NULL,                     -- 설치 라인
    installed_on DATE    NOT NULL,                     -- 설치일: 시각이 필요 없어 DATE
    status       TEXT    NOT NULL DEFAULT 'RUNNING'    -- 상태: 정해진 값만 허용
                 CHECK (status IN ('RUNNING', 'IDLE', 'MAINTENANCE', 'RETIRED'))
);

-- 2) 정비 담당 — 정비 이력의 "누가"를 담당한다.
CREATE TABLE technician (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_no TEXT    NOT NULL UNIQUE,               -- 사번, 사내에서 유일(UNIQUE)
    name        TEXT    NOT NULL,
    team        TEXT    NOT NULL,                      -- 소속 정비팀
    cert_level  TEXT    NOT NULL                       -- 자격 등급
                CHECK (cert_level IN ('L1', 'L2', 'L3')),
    joined_on   DATE    NOT NULL
);

-- 3) 부품 — 설비 1대에 여러 부품이 붙는다(equipment 1 : N component).
CREATE TABLE component (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),   -- 부모: 설비
    part_no      TEXT    NOT NULL,                         -- 부품 번호
    name         TEXT    NOT NULL,
    quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    replaced_on  DATE,                                     -- 교체일: 아직 안 바꿨으면 NULL 허용
    UNIQUE (equipment_id, part_no)                         -- 같은 설비에 같은 부품 번호 중복 금지
);

-- 4) 정비 이력 — 설비 1대에 여러 건(equipment 1 : N maintenance),
--    담당자 1명이 여러 건(technician 1 : N maintenance).
CREATE TABLE maintenance (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id  INTEGER NOT NULL REFERENCES equipment(id),   -- 부모: 설비
    technician_id INTEGER NOT NULL REFERENCES technician(id),  -- 부모: 담당자
    kind          TEXT    NOT NULL
                  CHECK (kind IN ('PERIODIC', 'BREAKDOWN')),   -- 정기 / 고장
    started_at    DATETIME NOT NULL,                           -- 시작 시각: 시각까지 필요해 DATETIME
    duration_min  INTEGER NOT NULL CHECK (duration_min > 0),   -- 소요 시간(분)
    cost          INTEGER,                                     -- 비용(원), 미정이면 NULL
    result        TEXT    NOT NULL DEFAULT 'DONE'
                  CHECK (result IN ('DONE', 'REWORK')),        -- 완료 / 재작업 필요
    note          TEXT
);

-- 5) 알람 로그 — 설비 1대에 여러 건(equipment 1 : N alarm_log).
CREATE TABLE alarm_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    equipment_id INTEGER NOT NULL REFERENCES equipment(id),   -- 부모: 설비
    alarm_code   TEXT    NOT NULL,
    level        TEXT    NOT NULL CHECK (level IN ('WARN', 'ERROR')),
    occurred_at  DATETIME NOT NULL,
    cleared_at   DATETIME                                      -- 해제 시각: 미해제면 NULL
);

-- 관계 요약(1:N 4개)
--   equipment 1 : N component    (component.equipment_id)
--   equipment 1 : N maintenance  (maintenance.equipment_id)
--   technician 1 : N maintenance (maintenance.technician_id)
--   equipment 1 : N alarm_log    (alarm_log.equipment_id)
