# Serverless Framework — 쓰지 않음, 권장 구성 기록

2026-10-31부터 이 저장소는 Serverless Framework 패키지를 설치하지 않는다. `sls`·`serverless`를 부르는 스크립트도 없다(dev·prod 모두).
호출·로그·패키징·배포 계획·dev 이관은 lemon-core의 `lemon-*` 명령이 맡는다([lambda-tools.md](lambda-tools.md), [lambda-migrate.md](lambda-migrate.md)).

## 남겨 둔 파일

| 파일                        | 왜 남기나                                                                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serverless.yml`            | 로컬 서버가 쓴다. lemon-core `buildExpress()`의 로컬 API Gateway가 이 파일의 `http` 이벤트로 라우트를 만든다(lemon-core 5.0.16 `loadRouteTable`). `lemon-*` 도구는 `service:` 줄을 읽는다. 기존 스택의 기록이다. |
| `swagger/documentation.yml` | `serverless-aws-documentation` 플러그인 설정. 기존 스택의 기록이다.                                                                                                                                              |
| `env/`                      | 프로필 설정. 에이전트는 열지 않는다.                                                                                                                                                                             |

-   `serverless.yml`의 `plugins:` 목록도 그대로다. 패키지가 없으면 `sls` 명령만 동작하지 않는다.
-   dev 이관 도구(`lemon-lambda-migrate`)는 이 파일을 읽지 않는다. 배포된 실제 스택을 읽는다.
-   라우트를 바꾸면 `serverless.yml`을 고친다. 로컬 서버가 그 라우트를 따른다. 이관된 dev의 라우트는 배포 서비스가 관리한다.

## 지금 상태

| 스테이지 | 스택                   | 소유                                        | 배포 경로                                                                             |
| -------- | ---------------------- | ------------------------------------------- | ------------------------------------------------------------------------------------- |
| dev      | `lemon-hello-api-dev`  | Serverless → 배포 서비스로 이관 예정        | `lambda:migrate` 6단계 → `lambda:deploy:dev` ([lambda-migrate.md](lambda-migrate.md)) |
| prod     | `lemon-hello-api-prod` | Serverless (이관 전, 검토된 이관 대상 아님) | 아래 `npx` 구성. 사람만 실행한다.                                                     |

prod 이관 전에는 이 저장소에 prod 배포 스크립트가 없다. 오너가 받아들인 상태다(2026-10-31).

## Serverless로 직접 실행해야 하면 (`npx`, devDependency 없음)

아래는 지울 때의 구성이다. 이 저장소에서 마지막으로 설치된 조합이다. `devDependencies`에 다시 넣지 않는다.

| 패키지                               | 선언 범위 | 마지막 설치판 |
| ------------------------------------ | --------- | ------------- |
| `serverless`                         | `^3.19.0` | 3.40.0        |
| `serverless-aws-documentation`       | `^0.8.0`  | 0.8.0         |
| `serverless-plugin-log-retention`    | `^2.1.0`  | 2.1.0         |
| `serverless-prune-plugin`            | `^2.0.1`  | 2.0.1         |
| `@cruglobal/serverless-merge-config` | `^1.1.0`  | 1.1.0         |

`serverless.yml`의 플러그인은 서비스 폴더의 `node_modules`에서 찾는다. 그래서 플러그인은 저장하지 않고 설치하고, CLI만 `npx`로 부른다.

```sh
# plugins into node_modules only; package.json and package-lock.json stay unchanged
npm i --no-save serverless-aws-documentation@0.8.0 serverless-plugin-log-retention@2.1.0 serverless-prune-plugin@2.0.1 @cruglobal/serverless-merge-config@1.1.0
# build first, as the removed deploy scripts did
npm run build
# the CLI through npx (example: prod deploy; human only, explicit profile)
npx -y serverless@3.40.0 deploy --param='profile=<profile>' --stage prod --aws-profile <aws-profile>
# return node_modules to the lock afterwards
npm ci
```

-   이 절차는 기록이다. 2026-10-31 변경에서 돌려 보지 않았다(에이전트는 AWS를 부르지 않는다).
-   Serverless Framework 3.x 기준이다. 4.x는 로그인·라이선스 방식이 달라 검증하지 않았다.
-   `serverless-offline`은 Node 22 이상에서 실패해 이미 꺼져 있다(`serverless.yml` 주석). 로컬 실행은 `npm run express`다.
-   `deploy`·`remove`는 사람만 실행한다. 에이전트는 사람이 명시적으로 시킬 때만 돌린다. prod는 특히 그렇다.
-   dev 스택을 이관한 뒤에는 dev에 `sls deploy`·`sls remove`를 쓰지 않는다. 함수가 배포 서비스 소유가 된다.

## 지운 것

| 지운 스크립트 (`<profile>`: 이름 있는 배포 프로필 판)                | 하던 일                      | 지금                                                                             |
| -------------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `deploy`, `deploy.prod`, `deploy.<profile>`, `deploy.<profile>.prod` | `sls deploy` (dev·prod)      | dev: `lambda:migrate` → `lambda:deploy:dev`. prod: 위 `npx` 구성                 |
| `pack`, `pack.prod`, `pack.<profile>`                                | `sls package`                | `npm run lambda:pack` (`lemon-lambda-pack`)                                      |
| `info`, `info.prod`, `info.<profile>`                                | `sls info`                   | 대응 명령 없음. 필요하면 위 `npx` 구성                                           |
| `logs`, `logs.prod`, `logs.<profile>`                                | `sls logs -f lambda`         | `npm run lambda:logs` (`lemon-lambda-logs`, `--fn backend`도 된다)               |
| `remove`, `remove.prod`, `remove.<profile>`                          | `sls remove` (테이블도 지움) | 대응 명령 없음. dev 스택 삭제는 이관 `remove` 단계만(retain 뒤, 테이블은 남는다) |

지운 devDependencies는 위 패키지 표의 다섯 개다. 그 효과(2026-10-31 실측):

-   `npm audit`(전체) 52 → 34건. 남은 34건은 모두 moderate이고 권고 하나(`minimatch` GHSA-g3hv-75wg-m249, eslint·jest·nodemon 체인)에서 온다. high·critical은 0이다.
-   `npm audit --omit=dev`는 그대로 0이다.
-   `node_modules` 473 MB → 275 MB. lock에서 427개 항목이 빠졌다. 바뀐 버전은 `lemon-core` 5.0.15 → 5.0.16뿐이다.
