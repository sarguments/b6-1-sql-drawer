-- B6-1 핵심 쿼리 15개 — 설비 카탈로그·정비 이력
-- 실행: sqlite3 b6-1.sqlite3 < queries.sql   (또는 python3 scripts/capture_results.py)
--
-- 각 쿼리 위 한 줄이 "무엇을 확인하는 쿼리인지" 설명이다.
-- 순서 주의: 조회(Q01~Q12)를 먼저 실행하고, 값을 바꾸는 UPDATE·DELETE(Q13~Q14)를 뒤에 둔다.
-- 같은 파일을 다시 실행하면 Q13·Q14가 이미 바뀐 데이터에 적용되므로 결과가 달라진다.
-- 그래서 결과를 다시 만들 때는 scripts/capture_results.py 로 스키마·샘플 데이터부터 새로 채운다.

-- Q01: 가동 중(RUNNING)인 설비를 조회하고 라인 이름·자산 코드순으로 정렬한다.
SELECT asset_code, name, line_name, installed_on
FROM equipment
WHERE status = 'RUNNING'
ORDER BY line_name, asset_code;

-- Q02: 정비 시작 시각이 최근인 순서로 정렬해 앞의 5건을 조회한다.
SELECT id, equipment_id, kind, started_at, duration_min
FROM maintenance
ORDER BY started_at DESC
LIMIT 5;

-- Q03: 고장 정비(BREAKDOWN) 기록만 조회하고 시작 시각순으로 정렬한다.
SELECT id, equipment_id, technician_id, started_at, duration_min, result
FROM maintenance
WHERE kind = 'BREAKDOWN'
ORDER BY started_at;

-- Q04: 2026-09-01부터 설치한 설비를 조회하고 설치일이 최근인 순서로 정렬한다.
SELECT asset_code, name, installed_on, status
FROM equipment
WHERE installed_on >= '2026-09-01'
ORDER BY installed_on DESC;

-- Q05: 고장 정비 기록에 설비명·담당자명을 연결하고 정비 시작 시각순으로 조회한다.
SELECT m.id, e.name AS equipment_name, t.name AS technician_name, m.kind, m.started_at
FROM maintenance AS m
INNER JOIN equipment AS e ON e.id = m.equipment_id
INNER JOIN technician AS t ON t.id = m.technician_id
WHERE m.kind = 'BREAKDOWN'
ORDER BY m.started_at;

-- Q06: 부품에 설비 정보를 연결해 자산 코드·부품 번호순으로 조회한다.
SELECT e.asset_code, e.name AS equipment_name, c.part_no, c.name AS part_name, c.quantity
FROM component AS c
INNER JOIN equipment AS e ON e.id = c.equipment_id
ORDER BY e.asset_code, c.part_no;

-- Q07: 설비별 정비 건수를 세고 건수가 많은 순서로 조회한다. 정비 기록이 없는 설비도 0건으로 남긴다.
SELECT e.asset_code, e.name AS equipment_name, COUNT(m.id) AS maintenance_count
FROM equipment AS e
LEFT JOIN maintenance AS m ON m.equipment_id = e.id
GROUP BY e.id, e.asset_code, e.name
ORDER BY maintenance_count DESC, e.asset_code;

-- Q08: 설비별 알람을 조회한다. 알람이 없는 설비도 남기고 알람 정보는 NULL로 표시한다.
SELECT e.asset_code, e.name AS equipment_name, a.alarm_code, a.level, a.occurred_at
FROM equipment AS e
LEFT JOIN alarm_log AS a ON a.equipment_id = e.id
ORDER BY e.asset_code, a.occurred_at;

-- Q09: 정비 기록이 있는 담당자별 건수·총 시간을 계산하고 총 시간이 긴 순서로 조회한다.
SELECT t.employee_no, t.name AS technician_name, t.team,
       COUNT(m.id) AS maintenance_count,
       SUM(m.duration_min) AS total_minutes
FROM technician AS t
INNER JOIN maintenance AS m ON m.technician_id = t.id
GROUP BY t.id, t.employee_no, t.name, t.team
ORDER BY total_minutes DESC;

-- Q10: 정비 2건 이상인 설비의 건수·평균·최대 시간을 계산하고 평균 시간이 긴 순서로 조회한다.
SELECT e.asset_code, e.name AS equipment_name,
       COUNT(m.id) AS maintenance_count,
       ROUND(AVG(m.duration_min), 1) AS avg_minutes,
       MAX(m.duration_min) AS max_minutes
FROM maintenance AS m
INNER JOIN equipment AS e ON e.id = m.equipment_id
GROUP BY e.id, e.asset_code, e.name
HAVING COUNT(m.id) >= 2
ORDER BY avg_minutes DESC;

-- Q11: 알람이 있는 라인별 전체·ERROR 알람 건수를 세고 전체 건수가 많은 순서로 조회한다.
SELECT e.line_name,
       COUNT(a.id) AS alarm_count,
       SUM(CASE WHEN a.level = 'ERROR' THEN 1 ELSE 0 END) AS error_count
FROM alarm_log AS a
INNER JOIN equipment AS e ON e.id = a.equipment_id
GROUP BY e.line_name
ORDER BY alarm_count DESC;

-- Q12: 정비 기록이 없는 설비를 찾아 자산 코드순으로 조회한다.
SELECT e.asset_code, e.name AS equipment_name, e.installed_on, e.status
FROM equipment AS e
WHERE NOT EXISTS (
    SELECT 1 FROM maintenance AS m WHERE m.equipment_id = e.id
)
ORDER BY e.asset_code;

-- Q13: 미완료 정비 기록이 없는 MAINTENANCE 설비를 RUNNING으로 바꾼다. 정비 기록이 0건인 설비도 포함한다.
UPDATE equipment
SET status = 'RUNNING'
WHERE status = 'MAINTENANCE'
  AND NOT EXISTS (
      SELECT 1 FROM maintenance AS m
      WHERE m.equipment_id = equipment.id AND m.result <> 'DONE'
  );

-- Q13 확인: 위 UPDATE 뒤에 상태가 어떻게 바뀌었는지 같은 파일에서 바로 본다.
SELECT asset_code, name, status FROM equipment WHERE asset_code IN ('EQ-CB-002', 'EQ-WD-002') ORDER BY asset_code;

-- Q14: 처리 완료 시각이 2026-08-01 이전인 WARN 알람을 삭제한다.
DELETE FROM alarm_log
WHERE level = 'WARN'
  AND cleared_at IS NOT NULL
  AND cleared_at < '2026-08-01';

-- Q14 확인: 삭제 후 남은 알람 수를 등급별로 조회한다.
SELECT level, COUNT(*) AS remaining_count FROM alarm_log GROUP BY level ORDER BY level;

-- Q15: 설비·기간 조회의 인덱스 적용 전후 실행 계획을 비교한다.
-- 설비 번호 일치 조건과 시작 시각 범위 조건에 맞춰 (equipment_id, started_at) 인덱스를 만든다.
-- 설비 번호로 먼저 좁히고 그 안에서 시작 시각 범위를 찾도록 컬럼 순서를 정했다.
-- EXPLAIN QUERY PLAN은 SQLite 전용 구문이며, 실행 시간이 아닌 조회 계획을 비교한다.
EXPLAIN QUERY PLAN
SELECT id, started_at, duration_min FROM maintenance
WHERE equipment_id = 5 AND started_at >= '2026-07-01';

CREATE INDEX idx_maintenance_equipment_started ON maintenance (equipment_id, started_at);

EXPLAIN QUERY PLAN
SELECT id, started_at, duration_min FROM maintenance
WHERE equipment_id = 5 AND started_at >= '2026-07-01';
