# B6-1 정보를 깔끔하게 정리하는 디지털 서랍장 만들기

코딧세이 AI 올인원 본과정 B6-1 미션 저장소입니다.

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

스키마와 실제 데이터베이스 파일은 미션에서 작성합니다.

## 준비 상태
SQLite 3.53.4 CLI로 메모리 데이터베이스 연결을 확인했습니다. 스키마·샘플 데이터·조회 쿼리와 실행 결과는 실습 과정에서 직접 작성합니다.
