-- B6-1 핵심 쿼리 15개 — 설비 카탈로그·정비 이력
-- 실행: sqlite3 b6-1.sqlite3 < queries.sql   (또는 python3 scripts/capture_results.py)
--
-- 각 쿼리 위 한 줄이 "무엇을 확인하는 쿼리인지" 설명이다.
-- 순서 주의: 조회(Q01~Q12)를 먼저 실행하고, 값을 바꾸는 UPDATE·DELETE(Q13~Q14)를 뒤에 둔다.
-- 같은 파일을 다시 실행하면 Q13·Q14가 이미 바뀐 데이터에 적용되므로 결과가 달라진다.
-- 그래서 결과를 다시 만들 때는 scripts/capture_results.py 로 스키마·샘플 데이터부터 새로 채운다.

-- Q01: 가동 중(RUNNING) 설비를 라인·자산 코드 순으로 본다. WHERE 필터 + ORDER BY 정렬.
SELECT asset_code, name, line_name, installed_on
FROM equipment
WHERE status = 'RUNNING'
ORDER BY line_name, asset_code;

-- Q02: 가장 최근 정비 5건만 본다. ORDER BY 내림차순 + LIMIT.
SELECT id, equipment_id, kind, started_at, duration_min
FROM maintenance
ORDER BY started_at DESC
LIMIT 5;

-- Q03: 고장 정비(BREAKDOWN) 이력만 본다. 값이 정해진 컬럼에 대한 WHERE 비교.
SELECT id, equipment_id, technician_id, started_at, duration_min, result
FROM maintenance
WHERE kind = 'BREAKDOWN'
ORDER BY started_at;

-- Q04: 최근에 설치한 설비(2026-09-01 이후)를 본다. 날짜 범위 비교(DATE 타입).
SELECT asset_code, name, installed_on, status
FROM equipment
WHERE installed_on >= '2026-09-01'
ORDER BY installed_on DESC;

-- Q05: 정비 이력을 설비 이름·담당자 이름과 함께 본다. INNER JOIN 2개(연결된 행이 있는 것만).
SELECT m.id, e.name AS equipment_name, t.name AS technician_name, m.kind, m.started_at
FROM maintenance AS m
INNER JOIN equipment AS e ON e.id = m.equipment_id
INNER JOIN technician AS t ON t.id = m.technician_id
WHERE m.kind = 'BREAKDOWN'
ORDER BY m.started_at;

-- Q06: 설비별 부품 목록을 본다. INNER JOIN — 설비와 부품을 한 번에 뽑는다.
SELECT e.asset_code, e.name AS equipment_name, c.part_no, c.name AS part_name, c.quantity
FROM component AS c
INNER JOIN equipment AS e ON e.id = c.equipment_id
ORDER BY e.asset_code, c.part_no;

-- Q07: 설비별 정비 건수를 본다. LEFT JOIN — 정비 이력이 없는 설비도 0건으로 나온다.
SELECT e.asset_code, e.name AS equipment_name, COUNT(m.id) AS maintenance_count
FROM equipment AS e
LEFT JOIN maintenance AS m ON m.equipment_id = e.id
GROUP BY e.id, e.asset_code, e.name
ORDER BY maintenance_count DESC, e.asset_code;

-- Q08: 설비별 알람을 본다. LEFT JOIN — 알람이 한 번도 없는 설비도 목록에 남는다.
SELECT e.asset_code, e.name AS equipment_name, a.alarm_code, a.level, a.occurred_at
FROM equipment AS e
LEFT JOIN alarm_log AS a ON a.equipment_id = e.id
ORDER BY e.asset_code, a.occurred_at;

-- Q09: 담당자별 총 정비 시간을 본다. 집계 SUM + GROUP BY.
SELECT t.employee_no, t.name AS technician_name, t.team,
       COUNT(m.id) AS maintenance_count,
       SUM(m.duration_min) AS total_minutes
FROM technician AS t
INNER JOIN maintenance AS m ON m.technician_id = t.id
GROUP BY t.id, t.employee_no, t.name, t.team
ORDER BY total_minutes DESC;

-- Q10: 정비가 2건 이상인 설비의 평균·최대 정비 시간을 본다. 집계 AVG + GROUP BY + HAVING.
SELECT e.asset_code, e.name AS equipment_name,
       COUNT(m.id) AS maintenance_count,
       ROUND(AVG(m.duration_min), 1) AS avg_minutes,
       MAX(m.duration_min) AS max_minutes
FROM maintenance AS m
INNER JOIN equipment AS e ON e.id = m.equipment_id
GROUP BY e.id, e.asset_code, e.name
HAVING COUNT(m.id) >= 2
ORDER BY avg_minutes DESC;

-- Q11: 라인별 알람 건수를 본다. 집계 COUNT + GROUP BY, ERROR 건수는 조건부 집계로 센다.
SELECT e.line_name,
       COUNT(a.id) AS alarm_count,
       SUM(CASE WHEN a.level = 'ERROR' THEN 1 ELSE 0 END) AS error_count
FROM alarm_log AS a
INNER JOIN equipment AS e ON e.id = a.equipment_id
GROUP BY e.line_name
ORDER BY alarm_count DESC;

-- Q12: 정비 이력이 한 번도 없는 설비를 찾는다. 서브쿼리(NOT EXISTS).
SELECT e.asset_code, e.name AS equipment_name, e.installed_on, e.status
FROM equipment AS e
WHERE NOT EXISTS (
    SELECT 1 FROM maintenance AS m WHERE m.equipment_id = e.id
)
ORDER BY e.asset_code;

-- Q13: 정비가 끝난(DONE) 이력만 있는 MAINTENANCE 상태 설비를 가동(RUNNING)으로 되돌린다. UPDATE.
UPDATE equipment
SET status = 'RUNNING'
WHERE status = 'MAINTENANCE'
  AND NOT EXISTS (
      SELECT 1 FROM maintenance AS m
      WHERE m.equipment_id = equipment.id AND m.result <> 'DONE'
  );

-- Q13 확인: 위 UPDATE 뒤에 상태가 어떻게 바뀌었는지 같은 파일에서 바로 본다.
SELECT asset_code, name, status FROM equipment WHERE asset_code IN ('EQ-CB-002', 'EQ-WD-002') ORDER BY asset_code;

-- Q14: 처리 완료(cleared_at 있음)된 WARN 알람 중 오래된 것(2026-08-01 이전)을 지운다. DELETE.
DELETE FROM alarm_log
WHERE level = 'WARN'
  AND cleared_at IS NOT NULL
  AND cleared_at < '2026-08-01';

-- Q14 확인: 남은 알람 수와 지워진 조건 밖의 행이 그대로인지 본다.
SELECT level, COUNT(*) AS remaining_count FROM alarm_log GROUP BY level ORDER BY level;

-- Q15: 정비 이력 조회에 인덱스를 붙인다.
-- 적용 이유: 화면 조회는 "설비 하나의 기간별 정비 이력"이 가장 잦다. 인덱스가 없으면 그 조회가
-- 매번 maintenance 전체를 훑는다. (equipment_id, started_at) 순서로 두면 설비로 먼저 좁히고
-- 그 안에서 기간을 자를 수 있다. 아래 EXPLAIN QUERY PLAN 두 줄이 붙기 전과 후를 보여준다.
-- (EXPLAIN QUERY PLAN은 SQLite 전용 문법이다.)
EXPLAIN QUERY PLAN
SELECT id, started_at, duration_min FROM maintenance
WHERE equipment_id = 5 AND started_at >= '2026-07-01';

CREATE INDEX idx_maintenance_equipment_started ON maintenance (equipment_id, started_at);

EXPLAIN QUERY PLAN
SELECT id, started_at, duration_min FROM maintenance
WHERE equipment_id = 5 AND started_at >= '2026-07-01';
