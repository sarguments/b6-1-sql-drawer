# B6-1 정보를 깔끔하게 정리하는 디지털 서랍장 만들기

코딧세이 AI 올인원 본과정 B6-1 미션 저장소입니다.

## 소재
스마트팩토리·로봇을 소재로 삼는다. 설비 카탈로그와 정비 이력을 담는 서랍장을 만든다. 설비·부품·정비 기록의 관계를 다룬다.

## 범위
SQL 실습·테이블 4개+·1:N 관계 2개+·CREATE/INSERT 스크립트·쿼리 15개·인덱스

## 개발 환경
SQLite와 `sqlite3` CLI를 사용한다. 백엔드 프레임워크는 쓰지 않는다.

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
| [`schema.sql`](schema.sql) | 테이블 5개 생성(`CREATE TABLE`) — PK·FK·제약조건·타입 주석 |
| [`seed.sql`](seed.sql) | 샘플 데이터 입력(`INSERT`) — 테이블당 10행 이상 |
| [`queries.sql`](queries.sql) | 핵심 쿼리 15개 + 각 쿼리 한 줄 설명 + 인덱스 |
| [`QUERIES.md`](QUERIES.md) | 쿼리 15개를 한 쿼리마다 설명·SQL 전문·실행 결과 전체로 정리한 문서 |
| [`results/`](results) | 쿼리별 실행 결과 텍스트(`Q01`~`Q15`)·요약·보너스 3건 |
| [`erd.svg`](erd.svg) · [`erd.dot`](erd.dot) | 테이블 관계도(ERD) 이미지와 생성 원본 |
| [`scripts/capture_results.py`](scripts/capture_results.py) | 스키마·샘플 데이터를 새로 채우고 결과를 다시 만드는 스크립트 |
| [`showcase/drawer-light.html`](showcase/drawer-light.html) · [`drawer.html`](showcase/drawer.html) | 설비·정비 데이터 한눈에 보기 — 쿼리·행 선택을 지원하는 오프라인 시연판 |
| [`showcase/`](showcase) | 시연판 빌드·결과 추출 소스, 데이터, 포함 라이브러리와 라이선스 |

## 실행 방법

결과를 다시 만들려면 스키마·샘플 데이터부터 새 데이터베이스에 채워야 합니다. `queries.sql` 뒤쪽에 값을 바꾸는 `UPDATE`·`DELETE`가 있어서, 이미 바뀐 데이터에 다시 실행하면 결과가 달라지기 때문입니다.

```bash
python3 scripts/capture_results.py      # 결과 일괄 재생성 (권장)
```

손으로 한 단계씩 확인하려면 같은 일을 이렇게 합니다. 먼저 기존 `b6-1.sqlite3`가 있으면 다른 이름으로 복사해 두고(덮어쓰면 되돌릴 수 없다), 아래를 실행합니다.

```bash
rm -f b6-1.sqlite3
sqlite3 -cmd 'PRAGMA foreign_keys = ON' b6-1.sqlite3 < schema.sql
sqlite3 -cmd 'PRAGMA foreign_keys = ON' b6-1.sqlite3 < seed.sql
sqlite3 -cmd 'PRAGMA foreign_keys = ON' b6-1.sqlite3 < queries.sql
```

`sqlite3` CLI는 호출마다 별도 프로세스라 `PRAGMA foreign_keys` 같은 연결 설정이 다음 호출로 이어지지 않습니다. 그래서 스크립트 안에 `PRAGMA foreign_keys = ON`이 있는 `seed.sql`까지 포함해 모든 호출에 `-cmd 'PRAGMA foreign_keys = ON'`을 붙여, 어느 단계에서도 외래 키 검사가 켜진 상태로 실행되게 했습니다. 나중에 `sqlite3 b6-1.sqlite3`로 DB를 직접 열 때도 같은 옵션을 붙여야 검사가 켜집니다. `scripts/capture_results.py`는 Python `sqlite3` 연결에서 `PRAGMA`를 실행하므로 이 옵션 없이 그대로 쓰면 됩니다.

`queries.sql`은 표준 SQL 범위로 썼습니다. SQLite 고유 문법을 쓴 곳은 두 군데뿐이고, 해당 위치에 주석으로 표시했습니다.

- `schema.sql`의 `AUTOINCREMENT`(자동 증가 키), `PRAGMA foreign_keys = ON`(외래 키 검사 켜기)
- `queries.sql` Q15의 `EXPLAIN QUERY PLAN`(실행 계획 출력)

## 데이터 설계

- 테이블 5개: `equipment`(설비), `technician`(정비 담당), `component`(부품), `maintenance`(정비 이력), `alarm_log`(알람 로그).
- 1:N 관계 4개: 설비→부품, 설비→정비 이력, 담당자→정비 이력, 설비→알람 로그.
- 제약조건: `asset_code`·`employee_no`에 `UNIQUE`, 주요 컬럼에 `NOT NULL`, `status`·`cert_level`·`kind`·`result`에 `CHECK`(정해진 값만 저장), 부품 수량 `CHECK (quantity > 0)`.
- 타입: 날짜만 필요하면 `DATE`, 시각까지 필요하면 `DATETIME`, 값·식별자는 `TEXT`, 개수·시간은 `INTEGER`로 의도를 나타냈다. SQLite의 `DATE`·`DATETIME`은 전용 날짜 저장 타입이나 형식 검증이 아니라 NUMERIC 타입 친화도 선언이다. 현재 시드의 날짜 값은 `YYYY-MM-DD`와 `YYYY-MM-DD HH:MM:SS` 형식의 TEXT로 저장되어, 같은 형식끼리의 문자열 비교가 날짜 순서와 일치한다. 날짜가 아닌 문자열도 저장될 수 있으므로 날짜 유효성 검증을 보장하지 않는다. 일반 `INTEGER` 컬럼 역시 타입 친화도이며, 정수만 저장하도록 강제하는 선언과는 다르다.
- 외래 키: `schema.sql` 첫 줄의 `PRAGMA foreign_keys = ON`이 있어야 실제로 막힌다(SQLite 기본값은 꺼짐). 이 검사는 연결마다 켜야 하므로 CLI에서는 `-cmd 'PRAGMA foreign_keys = ON'`을 함께 준다. 검사가 켜진 상태에서 없는 부모를 거부한 1건은 `results/bonus2-fk-violation.txt`에 있다.
- 인덱스 1개: `idx_maintenance_equipment_started` — `maintenance (equipment_id, started_at)`. 설비 하나의 기간별 정비 이력 조회가 가장 잦아, 설비로 먼저 좁히고 그 안에서 기간을 자르게 했다. 이유와 전후 실행 계획은 `queries.sql`의 Q15에 있다.

## 엑셀·파일 대신 데이터베이스를 쓴 이유

같은 표를 엑셀 파일로도 만들 수 있다. 그래도 여기서는 테이블로 나눠 저장했고, 그 차이는 아래 지점에서 드러난다.

- **관계를 값으로 잇는다**: 엑셀도 참조 함수와 분리된 시트로 중복을 줄일 수 있다. 이 구현에서는 설비 이름을 `equipment` 한 행에만 두고 `maintenance.equipment_id`가 그 행의 번호를 참조한다. 이름을 한 번 고치면 조인 결과에도 새 이름이 나온다.
- **참조 무결성을 스키마로 검사한다**: 엑셀도 유효성 검사로 입력을 제한할 수 있지만, 이는 DB의 테이블 간 FK 제약과 같은 기능은 아니다. 이 구현은 연결별로 FK 검사를 켠 상태에서 없는 설비 번호를 참조하는 입력을 거부한다(`results/bonus2-fk-violation.txt`).
- **누락·중복·범위를 제약조건으로 검사한다**: `NOT NULL`·`UNIQUE`·`CHECK`가 값의 누락·중복·허용 범위를 저장 단계에서 검사한다. 엑셀 유효성 검사는 복사·붙여넣기 등 입력 경로에 따른 제한이 있어 DB 제약조건과 보장 범위를 구분해야 한다.
- **동시 접근 방식이 다르다**: 파일 사본을 각자 수정한 뒤 같은 경로에 덮어쓰는 방식과 OneDrive·SharePoint의 Excel 공동 편집은 다르다. 공동 편집은 여러 사람의 변경을 반영하므로 단순한 파일 덮어쓰기로 일반화할 수 없다. SQLite는 여러 연결이 읽을 수 있지만 쓰기는 한 번에 하나로 직렬화한다. 트랜잭션은 묶인 변경을 함께 확정하거나 취소하는 데 쓴다.
- **관계와 규칙을 쿼리에서 재사용한다**: 엑셀도 참조 함수·피벗으로 비슷한 조회·집계를 할 수 있다. 이 미션의 초점은 엑셀에 같은 결과를 만들 기능이 없다는 것이 아니라, 관계와 무결성 규칙을 스키마로 관리하고 SQL로 조회·집계한다는 점이다.

공식 근거: SQLite의 [데이터 타입](https://www.sqlite.org/datatype3.html)·[외래 키](https://www.sqlite.org/foreignkeys.html)·[트랜잭션 격리](https://www.sqlite.org/isolation.html), Microsoft의 [Excel 공동 편집](https://support.microsoft.com/en-us/excel/get-started/collaborate-on-excel-workbooks-at-the-same-time-with-co-authoring).

## 핵심 개념 정리

- **PK vs FK**: PK(Primary Key)는 그 행 하나를 가리키는 고유 이름표다. `equipment.id`처럼 행마다 다르고 비어 있을 수 없다. FK(Foreign Key)는 다른 표의 PK를 가리키는 연결 고리다. `maintenance.equipment_id`가 `equipment.id`를 가리키는 식이다. PK는 "이 행은 누구인가", FK는 "이 행은 누구와 이어져 있나"를 담당한다.
- **1:N 관계**: 한 부모 행에 여러 자식 행이 붙는 관계다. 설비 한 대에 정비 이력이 여러 건 붙는 것이 그 예다. 자식 쪽(`maintenance`)이 부모의 id(`equipment_id`)를 값으로 들고 있어, 이 값으로 둘을 이어 붙인다.
- **INNER JOIN vs LEFT JOIN**: `INNER JOIN`은 양쪽에 짝이 있는 행만 남긴다. `LEFT JOIN`은 왼쪽 표의 행을 모두 남기고, 오른쪽에 짝이 없으면 그 자리를 `NULL`로 채운다. Q07에서 정비 이력이 없는 설비(`EQ-AG-001`)를 0건으로 남기는 데 `LEFT JOIN`을 썼다.
- **GROUP BY와 집계 함수**: `GROUP BY`로 행을 기준별로 묶고, 묶음마다 `COUNT`(건수)·`SUM`(합계)·`AVG`(평균)를 계산한다. Q09는 담당자별로 묶어 총 정비 시간을, Q10은 설비별로 묶어 평균·최대 시간을 구한다. 묶은 뒤의 조건은 `WHERE`가 아니라 `HAVING`으로 건다(Q10의 `HAVING COUNT(m.id) >= 2`).
- **SELECT / INSERT / UPDATE / DELETE**: `SELECT`는 조회, `INSERT`는 새 행 입력, `UPDATE`는 기존 값 변경, `DELETE`는 행 삭제다. 데이터를 바꾸는 쿼리(Q13·Q14)는 조회(Q01~Q12) 뒤에 둔다.
- **인덱스**: 특정 컬럼 기준으로 찾을 때 표 전체를 훑지 않도록 미리 정렬해 둔 색인이다. 자주 조건으로 쓰는 컬럼에 붙인다. Q15는 `maintenance (equipment_id, started_at)`에 붙여, 실행 계획이 전체 훑기(`SCAN`)에서 인덱스 탐색(`SEARCH ... USING INDEX`)으로 바뀌는 것을 보여준다.

## 쿼리 15개

> [!TIP]
> 쿼리별 한 줄 설명·SQL 전문·실행 결과 전체는 **[`QUERIES.md`](QUERIES.md)** 에 모아 두었다.

쿼리 본문은 [`queries.sql`](queries.sql)에, 각 쿼리의 실행 결과는 `results/`의 `Q01.txt`~`Q15.txt`에 있다.

- 기본 조회: [Q01](results/Q01.txt) · [Q02](results/Q02.txt) · [Q03](results/Q03.txt) · [Q04](results/Q04.txt)
- 조인: [Q05](results/Q05.txt) · [Q06](results/Q06.txt) · [Q07](results/Q07.txt) · [Q08](results/Q08.txt)
- 집계: [Q09](results/Q09.txt) · [Q10](results/Q10.txt) · [Q11](results/Q11.txt)
- 서브쿼리: [Q12](results/Q12.txt)
- 수정·삭제: [Q13](results/Q13.txt) · [Q14](results/Q14.txt)
- 인덱스: [Q15](results/Q15.txt)

범주 분포는 기본 조회 4, 조인 4(`INNER` 2·`LEFT` 2), 집계 3(`COUNT`·`SUM`·`AVG`), 서브쿼리 1, 수정·삭제 2, 인덱스 1이다.

## 대화형 시연판

저장소를 받은 뒤 `showcase/drawer-light.html`을 Chrome에서 엽니다. 어두운 화면은 `showcase/drawer.html`이며 화면 안에서도 전환할 수 있습니다. GitHub의 HTML 파일 미리보기는 실행 화면이 아니므로 파일을 내려받거나 저장소를 복제한 뒤 로컬에서 엽니다. 서버·npm 설치·인터넷 연결은 필요 없습니다.

- 쿼리를 고르면 짧은 설명·SQL·실행 결과와 표의 강조가 바뀝니다. SQL에는 구문 강조가 적용됩니다.
- 자식 표의 id를 누르면 실제 부모 행으로 향하는 실선이 표시됩니다. 관계별 색과 R1~R4 번호, 점선·실선과 화살표로 구분합니다.
- 표 머리글을 누르면 100%로 확대됩니다. **확대 전으로 (Esc)** 버튼이나 **Esc**로 이전 배율·스크롤로 돌아오며 쿼리와 선택 행은 유지됩니다. 선택박스에서는 Esc 본래 동작을 유지합니다.
- 표는 ELK가 자동 배치하며 직접 끌어 옮기지 않습니다. 보드의 빈 곳을 끌어 이동하거나 확대·축소할 수 있습니다. 작은 화면에서는 전체 보기의 글자가 작으므로 개별 표를 확대해 확인합니다.

시연판은 원본 SQL을 메모리 SQLite에서 실행해 저장한 결과를 재생합니다. 브라우저 안에서 SQL을 다시 실행하거나 저장소의 실제 DB를 수정하지 않습니다. 데이터까지 다시 만들려면 저장소 루트에서 다음을 실행합니다.

```bash
python3 showcase/export-evidence.py .
node showcase/build-drawer.mjs
node showcase/build-drawer.mjs --dark
```

Python은 표준 라이브러리만 사용합니다. HTML 재생성에는 Node.js가 필요하며, 화면 코드만 바꾸었다면 뒤의 두 명령만 실행합니다. 실행 환경·추출 시각·SQL 해시는 `showcase/evidence.json`에 기록됩니다.

포함 라이브러리는 ELK.js 0.12.0(EPL-2.0)과 Prism.js 1.30.0(MIT)의 핵심·SQL 문법입니다. 원본·라이선스는 `showcase/vendor/`에 보관하고 HTML에도 라이선스를 포함했습니다. 시연판·짧은 쿼리 설명·화면 보조 도구의 수정 모델은 `openai-codex/gpt-6.1-sol`이며, 최신 UI 변경은 보조 에이전트 없이 직접 수정하고 Chrome에서 조작·화면 크기·구문 강조·확대 복귀를 확인했습니다. 미션 SQL 3개는 수정하지 않았습니다.

![설비·정비 데이터 시연판](showcase/shots/drawer-current-light.png)

## 실행 화면

주요 쿼리 5개를 실제로 실행해 생성한 `results/`의 텍스트 원문을 브라우저에 표시한 이미지다. 터미널 자체를 촬영한 이미지는 아니며, Q15도 `queries.sql`의 설비 5번·2026-07-01 이후 조건을 실행한 결과다.

![Q01 가동 중 설비](screenshots/q01-running.png)
![Q07 설비별 정비 건수](screenshots/q07-leftjoin.png)
![Q09 담당자별 총 정비 시간](screenshots/q09-groupby.png)
![Q12 정비 이력 없는 설비](screenshots/q12-notexists.png)
![Q15 인덱스 탐색](screenshots/q15-index.png)

## 보너스

세 과제를 모두 [`scripts/capture_results.py`](scripts/capture_results.py)에서 재현하고 결과를 남겼다.

- [보너스 1 — 같은 요구를 `JOIN`과 서브쿼리 두 방식으로](results/bonus1-join-vs-subquery.txt): "정비 이력이 있는 설비"를 `INNER JOIN`과 `EXISTS`로 각각 뽑아 결과가 같음을 확인하고, 언제 어느 쪽을 쓰는지 비교했다.
- [보너스 2 — 데이터 정합성 깨뜨려 보기](results/bonus2-fk-violation.txt): 검사가 켜진 상태에서 없는 부모 값(`equipment_id = 999`)을 넣어 `FOREIGN KEY constraint failed`로 막히는 것과 고치는 방법을 기록했다. 꺼진 상태와의 비교 실행은 이 파일에 담지 않았다.
- [보너스 3 — 핵심 지표 미니 리포트](results/bonus3-mini-report.txt): 이 DB로 뽑는 핵심 지표 3개(설비별 총 정비 시간 상위, 라인별 고장 정비 건수, 정비 담당자별 평균 처리 시간)와 각 지표 SQL을 정리했다.

## 테이블 관계 (ERD)

![테이블 관계도](erd.svg)

- `equipment`(설비) 1 : N `component`(부품)
- `equipment`(설비) 1 : N `maintenance`(정비 이력)
- `technician`(정비 담당) 1 : N `maintenance`(정비 이력)
- `equipment`(설비) 1 : N `alarm_log`(알람 로그)

## 작업 중 겪은 문제와 해결

- `queries.sql` 뒤쪽 `UPDATE`·`DELETE` 때문에 같은 파일을 다시 돌리면 결과가 달라졌다. 스키마·샘플 데이터부터 새로 채우는 `scripts/capture_results.py`로 재생성 순서를 고정해 해결했다.
- SQLite는 `PRAGMA foreign_keys = ON`이 꺼져 있으면 FK 위반을 막지 않는다. 그래서 `schema.sql` 첫 줄에 켜는 문장을 두고, CLI 호출마다 `-cmd 'PRAGMA foreign_keys = ON'`을 붙여 연결별로 다시 켜지게 했다. `results/bonus2-fk-violation.txt`에는 검사가 켜진 상태에서 없는 부모 값(`equipment_id = 999`)을 넣어 거부된 1건만 기록했다. 꺼진 상태의 비교 실행은 이 파일에 담지 않았다.
- `maintenance` 기간 조회가 전체 훑기(`SCAN`)로 나왔다. `(equipment_id, started_at)` 복합 인덱스를 붙여 인덱스 탐색(`SEARCH ... USING INDEX`)으로 바뀌는 것을 `Q15` 실행 계획으로 확인했다.
- `scripts/capture_results.py`가 값을 바꾸는 `UPDATE`·`DELETE`·`CREATE INDEX`의 결과를 확정(`commit`)하지 않고 연결을 닫았다. 그래서 다시 연 DB는 되돌려진 상태였고, `results/`의 캡처와 어긋났다. 실행 끝에 `commit`을 넣어 캡처와 DB가 같은 최종 상태를 갖도록 고쳤다.
- 같은 스크립트가 결과 표의 `detail` 값을 40자로 잘라 `results/Q15.txt`에도 잘린 실행 계획이 들어갔다. 자르기를 없애 실행 계획 원문이 그대로 남게 했고, 인덱스 생성처럼 행 수를 세지 않는 문장은 `rowcount`의 `-1`을 `-1행`으로 쓰지 않고 "행 수 미적용"으로 구분해 적게 했다.

## 자료 검증과 보조 도구 수정 방식

보조 도구 수정의 메인 모델은 `openai-codex/gpt-6.1-sol`이다. 이번 경계 수정은 보조 에이전트 2개가 시연판 소스와 제출 설명을 나눠 맡았고, 메인이 통합·격리 DB·실제 브라우저·색 대비 검증을 담당했다. 보조 에이전트의 개별 모델 ID는 확인되지 않았다. 미션 SQL 3개는 변경하지 않았다.

추가 재검토에서는 연결별 FK 활성화, FK 거부 기록의 실제 범위, Q13의 이력 0건 포함 조건, SQLite 날짜 타입의 한계, 엑셀 공동 편집과 SQLite 단일 쓰기 직렬화를 정정했다. 근거는 위 공식 문서에 연결했다.

격리 DB에서 수동 명령 3개를 각각 새 연결로 실행하고, 추가 연결에서도 `foreign_keys=1`과 없는 부모 참조 거부를 확인했다. Q13은 현재 시드에서 변경 0행이며, 별도 입력에서 이력 0건·모두 DONE은 가동 상태로 바뀌고 REWORK가 있으면 바뀌지 않았다. 날짜가 아닌 문자열도 DATE 컬럼에 TEXT로 저장됨을 확인했다. 이 반례들은 검증용 DB에서만 실행했으며 미션 SQL·시드·제출 결과 데이터에는 추가하지 않았다.
