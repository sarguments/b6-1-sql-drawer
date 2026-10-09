# B6-1 핵심 쿼리 15개 — 설명·SQL·실행 결과

쿼리 15개를 한 쿼리마다 한 줄 설명 + SQL 본문 + 실행 결과 전체로 묶었다.
쿼리 본문의 원본은 [`queries.sql`](queries.sql)이고, 실행 결과의 원본은 [`results/`](results)의 `Qxx.txt`다.
결과는 `python3 scripts/capture_results.py`로 다시 만든다.

## 범주 요약

| 번호 | 범주 | 무엇을 확인하는가 |
| --- | --- | --- |
| [Q01](#q01--가동-중-설비-목록-where--order-by) | 기본 조회 | 가동 중 설비 목록 (`WHERE` + `ORDER BY`) |
| [Q02](#q02--최근-정비-5건-order-by--limit) | 기본 조회 | 최근 정비 5건 (`ORDER BY` + `LIMIT`) |
| [Q03](#q03--고장-정비-이력만-where-값-비교) | 기본 조회 | 고장 정비 이력만 (`WHERE` 값 비교) |
| [Q04](#q04--2026-09-01-이후-설치-설비-date-범위-비교) | 기본 조회 | 2026-09-01 이후 설치 설비 (`DATE` 범위 비교) |
| [Q05](#q05--정비-이력--설비--담당자-inner-join-2개) | 조인 | 정비 이력 + 설비 + 담당자 (`INNER JOIN` 2개) |
| [Q06](#q06--설비별-부품-목록-inner-join) | 조인 | 설비별 부품 목록 (`INNER JOIN`) |
| [Q07](#q07--설비별-정비-건수-left-join--count) | 조인 | 설비별 정비 건수 (`LEFT JOIN` + `COUNT`) |
| [Q08](#q08--설비별-알람-left-join) | 조인 | 설비별 알람 (`LEFT JOIN`) |
| [Q09](#q09--담당자별-총-정비-시간-sum--group-by) | 집계 | 담당자별 총 정비 시간 (`SUM` + `GROUP BY`) |
| [Q10](#q10--정비-2건-이상-설비의-평균최대-시간-avg--group-by--having) | 집계 | 정비 2건 이상 설비의 평균·최대 시간 (`AVG` + `GROUP BY` + `HAVING`) |
| [Q11](#q11--라인별-알람-건수-count--group-by) | 집계 | 라인별 알람 건수 (`COUNT` + `GROUP BY`) |
| [Q12](#q12--정비-이력이-없는-설비-not-exists) | 서브쿼리 | 정비 이력이 없는 설비 찾기 (`NOT EXISTS`) |
| [Q13](#q13--정비-완료-설비를-가동-상태로-되돌리기-update) | 수정 | 정비 완료 설비를 가동 상태로 되돌리기 (`UPDATE`) |
| [Q14](#q14--처리-완료된-오래된-warn-알람-지우기-delete) | 삭제 | 처리 완료된 오래된 `WARN` 알람 지우기 (`DELETE`) |
| [Q15](#q15--정비-이력-조회-인덱스-생성--적용-이유) | 인덱스 | 정비 이력 조회 인덱스 생성 + 적용 이유 |

범주 분포: 기본 조회 4 / 조인 4(INNER 2·LEFT 2) / 집계 3(`COUNT`·`SUM`·`AVG`) / 서브쿼리 1 / 수정·삭제 2 / 인덱스 1.

---

## Q01 — 가동 중 설비 목록 (`WHERE` + `ORDER BY`)

가동 중(RUNNING) 설비를 라인·자산 코드 순으로 본다. `WHERE` 필터 + `ORDER BY` 정렬.

```sql
SELECT asset_code, name, line_name, installed_on
FROM equipment
WHERE status = 'RUNNING'
ORDER BY line_name, asset_code;
```

```text
asset_code | name      | line_name | installed_on
-----------+-----------+-----------+-------------
EQ-VS-001  | 비전 검사기 1호 | 검사 라인     | 2024-11-15
EQ-VS-002  | 비전 검사기 2호 | 검사 라인     | 2025-06-01
EQ-WD-001  | 용접 로봇 1호  | 용접 라인     | 2023-02-13
EQ-CV-001  | 컨베이어 1호   | 이송 라인     | 2023-05-09
EQ-RB-001  | 조립 로봇팔 1호 | 조립 A라인    | 2024-03-11
EQ-RB-002  | 조립 로봇팔 2호 | 조립 A라인    | 2024-03-11
EQ-CB-001  | 협동로봇 셀 1호 | 조립 B라인    | 2024-07-02
EQ-PL-001  | 포장기 1호    | 포장 라인     | 2022-09-27
(8행)
```

## Q02 — 최근 정비 5건 (`ORDER BY` + `LIMIT`)

가장 최근 정비 5건만 본다. `ORDER BY` 내림차순 + `LIMIT`.

```sql
SELECT id, equipment_id, kind, started_at, duration_min
FROM maintenance
ORDER BY started_at DESC
LIMIT 5;
```

```text
id | equipment_id | kind      | started_at          | duration_min
---+--------------+-----------+---------------------+-------------
30 | 5            | BREAKDOWN | 2026-09-28 18:20:00 | 100
29 | 7            | PERIODIC  | 2026-09-26 09:05:00 | 45
28 | 4            | PERIODIC  | 2026-09-25 13:45:00 | 50
27 | 2            | PERIODIC  | 2026-09-24 09:15:00 | 55
19 | 8            | PERIODIC  | 2026-09-22 10:15:00 | 40
(5행)
```

## Q03 — 고장 정비 이력만 (`WHERE` 값 비교)

고장 정비(BREAKDOWN) 이력만 본다. 값이 정해진 컬럼에 대한 `WHERE` 비교.

```sql
SELECT id, equipment_id, technician_id, started_at, duration_min, result
FROM maintenance
WHERE kind = 'BREAKDOWN'
ORDER BY started_at;
```

```text
id | equipment_id | technician_id | started_at          | duration_min | result
---+--------------+---------------+---------------------+--------------+-------
26 | 11           | 8             | 2026-06-27 17:10:00 | 90           | DONE
2  | 1            | 2             | 2026-07-12 14:05:00 | 130          | DONE
11 | 5            | 7             | 2026-07-21 16:30:00 | 110          | DONE
21 | 9            | 10            | 2026-07-27 07:55:00 | 125          | DONE
7  | 3            | 9             | 2026-08-05 08:25:00 | 150          | REWORK
24 | 10           | 1             | 2026-08-07 12:40:00 | 200          | DONE
14 | 6            | 4             | 2026-08-11 19:45:00 | 65           | DONE
5  | 2            | 8             | 2026-08-19 21:15:00 | 95           | DONE
8  | 3            | 3             | 2026-08-26 08:40:00 | 75           | DONE
18 | 8            | 3             | 2026-08-29 15:35:00 | 70           | DONE
9  | 4            | 6             | 2026-09-08 10:05:00 | 180          | REWORK
16 | 7            | 8             | 2026-09-15 13:20:00 | 85           | DONE
30 | 5            | 6             | 2026-09-28 18:20:00 | 100          | REWORK
(13행)
```

## Q04 — 2026-09-01 이후 설치 설비 (`DATE` 범위 비교)

최근에 설치한 설비(2026-09-01 이후)를 본다. 날짜 범위 비교(`DATE` 타입).

```sql
SELECT asset_code, name, installed_on, status
FROM equipment
WHERE installed_on >= '2026-09-01'
ORDER BY installed_on DESC;
```

```text
asset_code | name      | installed_on | status
-----------+-----------+--------------+------------
EQ-AG-001  | 이동 로봇 1호  | 2026-09-20   | IDLE
EQ-CB-002  | 협동로봇 셀 2호 | 2026-09-05   | MAINTENANCE
(2행)
```

## Q05 — 정비 이력 + 설비 + 담당자 (`INNER JOIN` 2개)

정비 이력을 설비 이름·담당자 이름과 함께 본다. `INNER JOIN` 2개(연결된 행이 있는 것만).

```sql
SELECT m.id, e.name AS equipment_name, t.name AS technician_name, m.kind, m.started_at
FROM maintenance AS m
INNER JOIN equipment AS e ON e.id = m.equipment_id
INNER JOIN technician AS t ON t.id = m.technician_id
WHERE m.kind = 'BREAKDOWN'
ORDER BY m.started_at;
```

```text
id | equipment_name | technician_name | kind      | started_at
---+----------------+-----------------+-----------+--------------------
26 | 용접 로봇 2호       | 오세진             | BREAKDOWN | 2026-06-27 17:10:00
2  | 조립 로봇팔 1호      | 박서연             | BREAKDOWN | 2026-07-12 14:05:00
11 | 컨베이어 1호        | 윤가람             | BREAKDOWN | 2026-07-21 16:30:00
21 | 포장기 1호         | 배현우             | BREAKDOWN | 2026-07-27 07:55:00
7  | 협동로봇 셀 1호      | 신유라             | BREAKDOWN | 2026-08-05 08:25:00
24 | 용접 로봇 1호       | 김정우             | BREAKDOWN | 2026-08-07 12:40:00
14 | 컨베이어 2호        | 최민지             | BREAKDOWN | 2026-08-11 19:45:00
5  | 조립 로봇팔 2호      | 오세진             | BREAKDOWN | 2026-08-19 21:15:00
8  | 협동로봇 셀 1호      | 이현수             | BREAKDOWN | 2026-08-26 08:40:00
18 | 비전 검사기 2호      | 이현수             | BREAKDOWN | 2026-08-29 15:35:00
9  | 협동로봇 셀 2호      | 한지훈             | BREAKDOWN | 2026-09-08 10:05:00
16 | 비전 검사기 1호      | 오세진             | BREAKDOWN | 2026-09-15 13:20:00
30 | 컨베이어 1호        | 한지훈             | BREAKDOWN | 2026-09-28 18:20:00
(13행)
```

## Q06 — 설비별 부품 목록 (`INNER JOIN`)

설비별 부품 목록을 본다. `INNER JOIN` — 설비와 부품을 한 번에 뽑는다.

```sql
SELECT e.asset_code, e.name AS equipment_name, c.part_no, c.name AS part_name, c.quantity
FROM component AS c
INNER JOIN equipment AS e ON e.id = c.equipment_id
ORDER BY e.asset_code, c.part_no;
```

```text
asset_code | equipment_name | part_no    | part_name  | quantity
-----------+----------------+------------+------------+---------
EQ-AG-001  | 이동 로봇 1호       | AG-BAT-250 | 배터리 팩      | 1
EQ-AG-001  | 이동 로봇 1호       | AG-LDR-11  | 라이다 센서     | 1
EQ-CB-001  | 협동로봇 셀 1호      | CB-CTL-11  | 컨트롤러 모듈    | 1
EQ-CB-001  | 협동로봇 셀 1호      | CB-FNG-01  | 핑거 그리퍼     | 2
EQ-CB-002  | 협동로봇 셀 2호      | CB-CBL-07  | 전원 케이블     | 1
EQ-CB-002  | 협동로봇 셀 2호      | CB-FNG-02  | 핑거 그리퍼 대형  | 2
EQ-CV-001  | 컨베이어 1호        | CV-BLT-300 | 컨베이어 벨트    | 1
EQ-CV-001  | 컨베이어 1호        | CV-MTR-05  | 구동 모터      | 1
EQ-CV-002  | 컨베이어 2호        | CV-BLT-300 | 컨베이어 벨트    | 1
EQ-CV-002  | 컨베이어 2호        | CV-ROL-02  | 이송 롤러      | 6
EQ-PL-001  | 포장기 1호         | PL-FLM-01  | 포장 필름 롤러   | 2
EQ-PL-001  | 포장기 1호         | PL-SEA-03  | 실링 히터      | 1
EQ-RB-001  | 조립 로봇팔 1호      | RB-BLT-01  | 타이밍 벨트     | 2
EQ-RB-001  | 조립 로봇팔 1호      | RB-JNT-03  | 조인트 모듈 J3  | 1
EQ-RB-002  | 조립 로봇팔 2호      | RB-GRS-02  | 감속기 그리스 세트 | 1
EQ-RB-002  | 조립 로봇팔 2호      | RB-JNT-03  | 조인트 모듈 J3  | 1
EQ-VS-001  | 비전 검사기 1호      | VS-CAM-20  | 검사 카메라     | 1
EQ-VS-001  | 비전 검사기 1호      | VS-LGT-04  | 링 조명       | 1
EQ-VS-002  | 비전 검사기 2호      | VS-CAM-20  | 검사 카메라     | 1
EQ-VS-002  | 비전 검사기 2호      | VS-LNS-08  | 교환 렌즈      | 1
EQ-WD-001  | 용접 로봇 1호       | WD-TRC-012 | 토치 팁       | 4
EQ-WD-001  | 용접 로봇 1호       | WD-WIR-14  | 용접 와이어 공급기 | 1
EQ-WD-002  | 용접 로봇 2호       | WD-GUN-02  | 용접 건       | 1
EQ-WD-002  | 용접 로봇 2호       | WD-TRC-012 | 토치 팁       | 2
(24행)
```

## Q07 — 설비별 정비 건수 (`LEFT JOIN` + `COUNT`)

설비별 정비 건수를 본다. `LEFT JOIN` — 정비 이력이 없는 설비도 0건으로 나온다.
`maintenance`에 이력이 없는 `EQ-AG-001`(이동 로봇 1호)이 그 예다.

```sql
SELECT e.asset_code, e.name AS equipment_name, COUNT(m.id) AS maintenance_count
FROM equipment AS e
LEFT JOIN maintenance AS m ON m.equipment_id = e.id
GROUP BY e.id, e.asset_code, e.name
ORDER BY maintenance_count DESC, e.asset_code;
```

```text
asset_code | equipment_name | maintenance_count
-----------+----------------+------------------
EQ-CV-001  | 컨베이어 1호        | 4
EQ-CB-001  | 협동로봇 셀 1호      | 3
EQ-PL-001  | 포장기 1호         | 3
EQ-RB-001  | 조립 로봇팔 1호      | 3
EQ-RB-002  | 조립 로봇팔 2호      | 3
EQ-VS-001  | 비전 검사기 1호      | 3
EQ-VS-002  | 비전 검사기 2호      | 3
EQ-WD-001  | 용접 로봇 1호       | 3
EQ-CB-002  | 협동로봇 셀 2호      | 2
EQ-CV-002  | 컨베이어 2호        | 2
EQ-WD-002  | 용접 로봇 2호       | 1
EQ-AG-001  | 이동 로봇 1호       | 0
(12행)
```

## Q08 — 설비별 알람 (`LEFT JOIN`)

설비별 알람을 본다. `LEFT JOIN` — 알람이 한 번도 없는 설비도 목록에 남는다.
`EQ-AG-001`(이동 로봇 1호)은 알람이 없어 값이 `NULL`로 나온다.

```sql
SELECT e.asset_code, e.name AS equipment_name, a.alarm_code, a.level, a.occurred_at
FROM equipment AS e
LEFT JOIN alarm_log AS a ON a.equipment_id = e.id
ORDER BY e.asset_code, a.occurred_at;
```

```text
asset_code | equipment_name | alarm_code     | level | occurred_at
-----------+----------------+----------------+-------+--------------------
EQ-AG-001  | 이동 로봇 1호       | NULL           | NULL  | NULL
EQ-CB-001  | 협동로봇 셀 1호      | GRIPPER_ALIGN  | ERROR | 2026-08-05 08:12:00
EQ-CB-001  | 협동로봇 셀 1호      | GRIPPER_ALIGN  | WARN  | 2026-09-18 14:30:00
EQ-CB-002  | 협동로봇 셀 2호      | VISION_TIMEOUT | WARN  | 2026-09-08 09:47:00
EQ-CV-001  | 컨베이어 1호        | MOTOR_OVERTEMP | ERROR | 2026-07-21 16:18:00
EQ-CV-001  | 컨베이어 1호        | BELT_SLIP      | WARN  | 2026-09-28 18:05:00
EQ-CV-002  | 컨베이어 2호        | ROLLER_JAM     | WARN  | 2026-08-11 19:31:00
EQ-PL-001  | 포장기 1호         | HEATER_OPEN    | ERROR | 2026-07-27 07:41:00
EQ-PL-001  | 포장기 1호         | FILM_TENSION   | WARN  | 2026-09-16 14:52:00
EQ-RB-001  | 조립 로봇팔 1호      | MOTOR_OVERTEMP | WARN  | 2026-07-12 13:58:00
EQ-RB-001  | 조립 로봇팔 1호      | POS_DEVIATION  | ERROR | 2026-08-14 10:22:00
EQ-RB-002  | 조립 로봇팔 2호      | BELT_TENSION   | WARN  | 2026-08-19 21:02:00
EQ-VS-001  | 비전 검사기 1호      | LIGHT_FAIL     | WARN  | 2026-09-15 13:08:00
EQ-VS-001  | 비전 검사기 1호      | CAM_LOST       | ERROR | 2026-09-25 11:44:00
EQ-VS-002  | 비전 검사기 2호      | CAM_LOST       | ERROR | 2026-08-29 15:21:00
EQ-VS-002  | 비전 검사기 2호      | LENS_DIRT      | WARN  | 2026-09-22 10:02:00
EQ-WD-001  | 용접 로봇 1호       | TORCH_WEAR     | WARN  | 2026-07-31 09:10:00
EQ-WD-001  | 용접 로봇 1호       | WIRE_SUPPLY    | ERROR | 2026-08-07 12:25:00
EQ-WD-002  | 용접 로봇 2호       | GUN_DAMAGE     | ERROR | 2026-06-27 16:55:00
(19행)
```

## Q09 — 담당자별 총 정비 시간 (`SUM` + `GROUP BY`)

담당자별 총 정비 시간을 본다. 집계 `SUM` + `GROUP BY`.

```sql
SELECT t.employee_no, t.name AS technician_name, t.team,
       COUNT(m.id) AS maintenance_count,
       SUM(m.duration_min) AS total_minutes
FROM technician AS t
INNER JOIN maintenance AS m ON m.technician_id = t.id
GROUP BY t.id, t.employee_no, t.name, t.team
ORDER BY total_minutes DESC;
```

```text
employee_no | technician_name | team | maintenance_count | total_minutes
------------+-----------------+------+-------------------+--------------
TEC-1006    | 한지훈             | 정비3팀 | 4                 | 395
TEC-1001    | 김정우             | 정비1팀 | 3                 | 305
TEC-1008    | 오세진             | 정비1팀 | 3                 | 270
TEC-1002    | 박서연             | 정비1팀 | 4                 | 260
TEC-1010    | 배현우             | 정비3팀 | 3                 | 260
TEC-1009    | 신유라             | 정비2팀 | 3                 | 235
TEC-1003    | 이현수             | 정비2팀 | 3                 | 190
TEC-1005    | 정도현             | 정비1팀 | 3                 | 165
TEC-1007    | 윤가람             | 정비3팀 | 2                 | 160
TEC-1004    | 최민지             | 정비2팀 | 2                 | 100
(10행)
```

## Q10 — 정비 2건 이상 설비의 평균·최대 시간 (`AVG` + `GROUP BY` + `HAVING`)

`GROUP BY`로 설비별로 묶고, `HAVING COUNT(m.id) >= 2`로 2건 이상만 남겨 평균 소요 시간 순으로 본다.

```sql
SELECT e.asset_code, e.name AS equipment_name,
       COUNT(m.id) AS maintenance_count,
       ROUND(AVG(m.duration_min), 1) AS avg_minutes,
       MAX(m.duration_min) AS max_minutes
FROM maintenance AS m
INNER JOIN equipment AS e ON e.id = m.equipment_id
GROUP BY e.id, e.asset_code, e.name
HAVING COUNT(m.id) >= 2
ORDER BY avg_minutes DESC;
```

```text
asset_code | equipment_name | maintenance_count | avg_minutes | max_minutes
-----------+----------------+-------------------+-------------+------------
EQ-CB-002  | 협동로봇 셀 2호      | 2                 | 115.0       | 180
EQ-WD-001  | 용접 로봇 1호       | 3                 | 111.7       | 200
EQ-CB-001  | 협동로봇 셀 1호      | 3                 | 90.0        | 150
EQ-RB-001  | 조립 로봇팔 1호      | 3                 | 81.7        | 130
EQ-PL-001  | 포장기 1호         | 3                 | 80.0        | 125
EQ-CV-001  | 컨베이어 1호        | 4                 | 73.8        | 110
EQ-RB-002  | 조립 로봇팔 2호      | 3                 | 66.7        | 95
EQ-VS-001  | 비전 검사기 1호      | 3                 | 60.0        | 85
EQ-VS-002  | 비전 검사기 2호      | 3                 | 51.7        | 70
EQ-CV-002  | 컨베이어 2호        | 2                 | 50.0        | 65
(10행)
```

## Q11 — 라인별 알람 건수 (`COUNT` + `GROUP BY`)

라인별 알람 건수를 본다. 집계 `COUNT` + `GROUP BY`, `ERROR` 건수는 조건부 집계로 센다.

```sql
SELECT e.line_name,
       COUNT(a.id) AS alarm_count,
       SUM(CASE WHEN a.level = 'ERROR' THEN 1 ELSE 0 END) AS error_count
FROM alarm_log AS a
INNER JOIN equipment AS e ON e.id = a.equipment_id
GROUP BY e.line_name
ORDER BY alarm_count DESC;
```

```text
line_name | alarm_count | error_count
----------+-------------+------------
검사 라인     | 4           | 2
조립 B라인    | 3           | 1
조립 A라인    | 3           | 1
이송 라인     | 3           | 1
용접 라인     | 3           | 2
포장 라인     | 2           | 1
(6행)
```

## Q12 — 정비 이력이 없는 설비 (`NOT EXISTS`)

정비 이력이 한 번도 없는 설비를 찾는다. 서브쿼리(`NOT EXISTS`).

단계별 분해:

1. 바깥 쿼리가 `equipment` 한 행(`e`)을 집는다.
2. 안쪽 서브쿼리가 `maintenance`에서 `equipment_id = e.id`인 행이 있는지 찾는다.
3. 안쪽에 행이 하나라도 있으면 `EXISTS`가 참이므로 `NOT EXISTS`는 거짓 → 그 설비는 제외된다.
4. 안쪽에 행이 하나도 없으면 `NOT EXISTS`가 참 → 그 설비가 결과에 남는다.
5. 남은 행을 `asset_code` 순으로 정렬한다. 결과는 `EQ-AG-001` 1행이다.

```sql
SELECT e.asset_code, e.name AS equipment_name, e.installed_on, e.status
FROM equipment AS e
WHERE NOT EXISTS (
    SELECT 1 FROM maintenance AS m WHERE m.equipment_id = e.id
)
ORDER BY e.asset_code;
```

```text
asset_code | equipment_name | installed_on | status
-----------+----------------+--------------+-------
EQ-AG-001  | 이동 로봇 1호       | 2026-09-20   | IDLE
(1행)
```

## Q13 — 정비 완료 설비를 가동 상태로 되돌리기 (`UPDATE`)

정비가 끝난(DONE) 이력만 있는 MAINTENANCE 상태 설비를 가동(RUNNING)으로 되돌린다. `UPDATE`.
아래 확인 조회는 바뀐 대상 두 설비의 상태를 바로 본다.

```sql
UPDATE equipment
SET status = 'RUNNING'
WHERE status = 'MAINTENANCE'
  AND NOT EXISTS (
      SELECT 1 FROM maintenance AS m
      WHERE m.equipment_id = equipment.id AND m.result <> 'DONE'
  );

SELECT asset_code, name, status FROM equipment WHERE asset_code IN ('EQ-CB-002', 'EQ-WD-002') ORDER BY asset_code;
```

```text
[변경] 0행 적용

asset_code | name      | status
-----------+-----------+------------
EQ-CB-002  | 협동로봇 셀 2호 | MAINTENANCE
EQ-WD-002  | 용접 로봇 2호  | RETIRED
(2행)
```

## Q14 — 처리 완료된 오래된 WARN 알람 지우기 (`DELETE`)

처리 완료(`cleared_at` 있음)된 WARN 알람 중 오래된 것(2026-08-01 이전)을 지운다. `DELETE`.
아래 확인 조회는 남은 알람 수를 등급별로 본다.

```sql
DELETE FROM alarm_log
WHERE level = 'WARN'
  AND cleared_at IS NOT NULL
  AND cleared_at < '2026-08-01';

SELECT level, COUNT(*) AS remaining_count FROM alarm_log GROUP BY level ORDER BY level;
```

```text
[변경] 2행 적용

level | remaining_count
------+----------------
ERROR | 8
WARN  | 8
(2행)
```

## Q15 — 정비 이력 조회 인덱스 생성 + 적용 이유

정비 이력 조회에 인덱스를 붙인다.

적용 이유: 화면 조회는 "설비 하나의 기간별 정비 이력"이 가장 잦다. 인덱스가 없으면 그 조회가 매번 `maintenance` 전체를 훑는다. `(equipment_id, started_at)` 순서로 두면 설비로 먼저 좁히고 그 안에서 기간을 자를 수 있다. 아래 `EXPLAIN QUERY PLAN` 두 줄이 인덱스를 붙이기 전과 후를 보여준다. (`EXPLAIN QUERY PLAN`은 SQLite 전용 문법이다.)

```sql
EXPLAIN QUERY PLAN
SELECT id, started_at, duration_min FROM maintenance
WHERE equipment_id = 5 AND started_at >= '2026-07-01';

CREATE INDEX idx_maintenance_equipment_started ON maintenance (equipment_id, started_at);

EXPLAIN QUERY PLAN
SELECT id, started_at, duration_min FROM maintenance
WHERE equipment_id = 5 AND started_at >= '2026-07-01';
```

```text
id | parent | notused | detail
---+--------+---------+-----------------
2  | 0      | 0       | SCAN maintenance
(1행)

[변경] -1행 적용

id | parent | notused | detail
---+--------+---------+-----------------------------------------
3  | 0      | 0       | SEARCH maintenance USING INDEX idx_main…
(1행)
```

위에서 첫 번째 결과가 인덱스 생성 전(`SCAN maintenance`, 전체 훑기), 마지막 결과가 생성 후(`SEARCH ... USING INDEX ...`, 인덱스 탐색)다. 실행 계획의 `detail` 열은 표 폭에 맞춰 줄여 표시되며, 원본 전체 문구는 `results/Q15.txt`에 있다.
