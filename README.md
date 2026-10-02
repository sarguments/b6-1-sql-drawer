# B6-1 정보를 깔끔하게 정리하는 디지털 서랍장 만들기

코딧세이 AI 올인원 본과정 B6-1 미션 저장소입니다.

## 소재
스마트팩토리·로봇을 소재로 삼는다. 설비 카탈로그와 정비 이력을 담는 서랍장을 만든다. 설비·부품·정비 기록의 관계를 다룬다.
미션 요구사항과 제약은 원문을 그대로 따르고, 소재는 데이터·예시·문구 범위에서만 바꾼다.

## 범위
SQL 실습·테이블 4개+·1:N 관계 2개+·CREATE/INSERT 스크립트·쿼리 15개·인덱스

## 개발 환경
로컬 DB와 SQL 실행 도구를 사용하는 실습입니다. 최소 준비안은 SQLite와 sqlite3 CLI이며, 착수 시 사용할 DB를 확정합니다.
백엔드 프레임워크는 사용하지 않습니다.

### 새 환경에서 준비

Git을 설치한 뒤 새 기기에서 저장소를 받습니다.

```bash
git clone https://github.com/sarguments/b6-1-sql-drawer.git
cd b6-1-sql-drawer
```

SQLite 명령줄 도구를 설치한 뒤, 저장소 루트에서 메모리 데이터베이스 연결을 확인합니다.

```bash
sqlite3 --version
sqlite3 :memory: "SELECT sqlite_version();"
```

## 파일 구성

| 파일 | 내용 |
| --- | --- |
| `schema.sql` | 테이블 5개 생성(`CREATE TABLE`) — PK·FK·제약조건·타입 주석 |
| `seed.sql` | 샘플 데이터 입력(`INSERT`) — 테이블당 10행 이상 |
| `queries.sql` | 핵심 쿼리 15개 + 각 쿼리 한 줄 설명 |
| `results/` | 쿼리별 실행 결과 텍스트(`Q01`~`Q15`)·요약·보너스 2건 |
| `scripts/capture_results.py` | 스키마·샘플 데이터를 새로 채우고 결과를 다시 만드는 스크립트 |

## 실행 방법

결과를 다시 만들려면 스키마·샘플 데이터부터 새 데이터베이스에 채워야 합니다. `queries.sql` 뒤쪽에 값을 바꾸는 `UPDATE`·`DELETE`가 있어서, 이미 바뀐 데이터에 다시 실행하면 결과가 달라지기 때문입니다.

```bash
python3 scripts/capture_results.py      # 결과 일괄 재생성 (권장)
```

손으로 한 단계씩 확인하려면 같은 일을 이렇게 합니다.

```bash
rm -f b6-1.sqlite3
sqlite3 b6-1.sqlite3 < schema.sql
sqlite3 b6-1.sqlite3 < seed.sql
sqlite3 b6-1.sqlite3 < queries.sql
```

## 데이터 설계

- 테이블 5개: `equipment`(설비), `technician`(정비 담당), `component`(부품), `maintenance`(정비 이력), `alarm_log`(알람 로그).
- 1:N 관계 4개: 설비→부품, 설비→정비 이력, 담당자→정비 이력, 설비→알람 로그.
- 제약조건: `asset_code`·`employee_no`에 `UNIQUE`, 주요 컬럼에 `NOT NULL`, `status`·`cert_level`·`kind`·`result`에 `CHECK`(정해진 값만 저장), 부품 수량 `CHECK (quantity > 0)`.
- 타입: 날짜만 필요하면 `DATE`, 시각까지 필요하면 `DATETIME`, 값·식별자는 `TEXT`, 개수·시간은 `INTEGER`. 근거는 각 컬럼 옆 주석에 적었다.
- 외래 키: `schema.sql` 첫 줄의 `PRAGMA foreign_keys = ON`이 있어야 실제로 막힌다(SQLite 기본값은 꺼짐). 확인 결과는 `results/bonus2-fk-violation.txt`에 있다.
- 인덱스 1개: `idx_maintenance_equipment_started` — `maintenance (equipment_id, started_at)`. 설비 하나의 기간별 정비 이력 조회가 가장 잦아, 설비로 먼저 좁히고 그 안에서 기간을 자르게 했다. 이유와 전후 실행 계획은 `queries.sql`의 Q15에 있다.

## 쿼리 15개

| 번호 | 범주 | 무엇을 확인하는가 |
| --- | --- | --- |
| Q01 | 기본 조회 | 가동 중 설비 목록 (`WHERE` + `ORDER BY`) |
| Q02 | 기본 조회 | 최근 정비 5건 (`ORDER BY` + `LIMIT`) |
| Q03 | 기본 조회 | 고장 정비 이력만 (`WHERE` 값 비교) |
| Q04 | 기본 조회 | 2026-09-01 이후 설치 설비 (`DATE` 범위 비교) |
| Q05 | 조인 | 정비 이력 + 설비 + 담당자 (`INNER JOIN` 2개) |
| Q06 | 조인 | 설비별 부품 목록 (`INNER JOIN`) |
| Q07 | 조인 | 설비별 정비 건수 (`LEFT JOIN` + `COUNT`) |
| Q08 | 조인 | 설비별 알람 (`LEFT JOIN`) |
| Q09 | 집계 | 담당자별 총 정비 시간 (`SUM` + `GROUP BY`) |
| Q10 | 집계 | 정비 2건 이상 설비의 평균·최대 시간 (`AVG` + `GROUP BY` + `HAVING`) |
| Q11 | 집계 | 라인별 알람 건수 (`COUNT` + `GROUP BY`) |
| Q12 | 서브쿼리 | 정비 이력이 없는 설비 찾기 (`NOT EXISTS`) |
| Q13 | 수정 | 정비 완료 설비를 가동 상태로 되돌리기 (`UPDATE`) |
| Q14 | 삭제 | 처리 완료된 오래된 `WARN` 알람 지우기 (`DELETE`) |
| Q15 | 인덱스 | 정비 이력 조회 인덱스 생성 + 적용 이유 |

요구 범주 대비: 기본 조회 4, 조인 4(`INNER` 2·`LEFT` 2), 집계 3(`COUNT`·`SUM`·`AVG`), 서브쿼리 1, 수정·삭제 2, 인덱스 1.

## 보너스

- `results/bonus1-join-vs-subquery.txt` — "정비 이력이 있는 설비"를 `JOIN`과 `EXISTS` 두 방식으로 풀어 비교.
- `results/bonus2-fk-violation.txt` — 없는 부모 값(`equipment_id = 999`)을 넣어 FK가 막는 것과 고치는 방법 기록.

## 실행 확인 결과 (2026-10-02, 이 기기)

- `python3 scripts/capture_results.py` 정상 종료(exit 0). 전체 재현은 `pristine` 데이터베이스에서 실행된다.
- 테이블 행 수: 설비 12 · 담당 10 · 부품 24 · 정비 이력 30 · 알람 18 (모두 10행 이상).
- `PRAGMA foreign_key_check` 문제 없음.
- `queries.sql` Q15의 실행 계획이 인덱스 생성 전 `SCAN maintenance` → 생성 후 `SEARCH maintenance USING INDEX idx_maintenance_equipment_started`로 바뀌는 것을 확인.
- SQLite 라이브러리 3.40.1(Python 3.10.11 내장), macOS 기본 `sqlite3` CLI 3.37.0에서 확인. 쿼리는 표준 SQL 범위로 썼고 SQLite 전용 문법은 쓰지 않았다.

## 남은 일

- 로컬 작업 사본은 아직 커밋하지 않았다(커밋·푸시는 별도 확인 뒤 진행).
- (선택) ERD 이미지 추가.
