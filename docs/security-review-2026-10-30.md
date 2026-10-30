# 보안 리뷰 2026-10-30 — 결과와 이번 변경

이 문서는 2026-10-30 보안 리뷰의 결과를 적는다. 대상은 v5 라인(`lemon-core` `^5.0.11`)이다.
이번 변경은 깨지지 않는 수정만 담는다(오너 결정). 사람 결정이 필요한 항목은 고치지 않았다.
값(endpoint, token, 계정 번호, 실제 주소)은 적지 않는다.

## 결과표

상태 값:

- **수정** — 이번 변경에서 고쳤다.
- **부분 수정** — 이번 범위만 고쳤다. 나머지는 표의 비고에 있다.
- **오너 결정** — 사람이 정해야 한다. 코드를 바꾸지 않았다.
- **후속** — 이번 변경 밖이다. 따로 작업한다.

| id | 심각도 | 내용 | 상태 | 비고 |
|---|---|---|---|---|
| C-1 | Critical | 공개 `GET /hello/{id}/{cmd}`의 `doGetDynamo`가 원본 레코드를 돌려준다. `GET /hello/@error/dynamo`가 채널 `meta$`(endpoint, token)를 드러낸다. | 수정 | `dynamo` 읽기·쓰기는 로컬 모드만. `@` id는 거부(`404`). |
| C-1 (인증) | Critical | `GET /hello/{id}/{cmd}`에 `authorizer: aws_iam`을 붙인다. | 오너 결정 | 운영자가 `GET /hello/{ch}/channel`을 인증 없이 부른다. |
| H-1 | High | `doPostChannel` 응답이 `meta$`를 마스킹하지 않는다. endpoint 호스트를 검사하지 않는다. `rules`를 검사하지 않는다. | 부분 수정 | 응답 마스킹, 허용 호스트(쓰기·발송 두 시점), `rules` 검사. 발송 때 전체 적용은 `CHANNEL_ENDPOINT_HOSTS`를 넣을 때 켜진다. |
| H-2 | High | hello가 자기 토픽·큐의 protocol 메시지를 받는다. `callback` 속성으로 다른 서비스를 대신 부른다(confused deputy). | 수정 | Lambda에서 protocol 메시지를 버린다. `sqs`·`sns` 자가 시험 라우트는 로컬 모드만. |
| M-1 | Medium | S3 버킷이 공개 읽기다. | 오너 결정 | 비공개 버킷·presigned URL 여부. |
| M-2 | Medium | subject별 채널 허용 목록이 없다. `<!channel>`을 지우지 않는다. | 오너 결정 | |
| M-3 | Medium | `POST /hello/subscribe`에 잘못된 JSON을 보내면 에러 리포트에 공격자 글이 들어간다. | 후속 | 아래 "고치지 못한 것" 참고. |
| L-1 | Low | `postMessage()`에 시간 제한이 없다. | 수정 | 10초 뒤 끊는다(`504 TIMEOUT`). 요청 오류는 reject 한다. |
| L-2 | Low | 라우팅 정규식이 `substring(1, len-2)`로 잘린다. 잘못된 패턴이 throw 한다. | 수정 | `/.../` 정확히 자름, 한 번 컴파일, 200자 상한, 쓰기 때 거부, 매칭 때 throw 없음. |
| L-3 | Low | 데모 메모리 버퍼(`BUFF`)에 상한이 없다. | 수정 | 100개(오래된 것부터 지움), `name` 200자. 라우트는 그대로 둔다. |
| L-4 | Low | 로그에 `token`·전체 `endpoint`·리포터 헤더가 찍힌다. | 수정 | `log-mask.ts`의 `maskSecrets()`. |
| L-5 | Low | 역할에 `lambda:InvokeFunction`과 `SNS:GetEndpointAttributes "*"`가 있다. | 수정 | 둘 다 지웠다. 함수별 역할 분리는 후속이다. |
| L-6 | Low | 로컬 express가 모든 인터페이스에 붙는다(lemon-devkit). | 오너 결정 | `127.0.0.1` 바인딩 여부. |

## 이번 변경

### C-1 — 원본 레코드 노출

- `doGetDynamo`·`doPostDynamo`는 `$U.isLocalMode()`일 때만 돈다. 그 밖에는 `404 NOT FOUND`다. 저장소를 부르지 않는다.
- `readFromDynamo`·`saveToDynamo`도 같은 검사를 한다(이중 방어).
- `@`로 시작하는 id는 예약 레코드다. `dynamo`·`channel`·`slack` 라우트가 `404 NOT FOUND - id:@… is reserved`를 준다.
- `404`를 쓰는 이유: lemon-core는 `404`를 에러 리포트로 보내지 않는다. 레코드가 있는지도 알리지 않는다.
- 공용 함수는 `src/service/hello-service.ts`의 `assertLocalOnly()`·`assertNotReserved()`다.

### H-1 — 채널 설정 쓰기

- `POST /hello/{id}/channel` 응답을 읽기와 같이 마스킹한다(로컬 모드가 아닐 때). `endpoint`는 앞 12자, `token`은 끝 4자다. `meta$`는 응답에 넣지 않는다.
- 허용 호스트는 `https:`와 정확한 호스트 일치로 판정한다. URL 안의 계정 정보는 거부한다.
- 허용 호스트 = `hooks.slack.com` + env `CHANNEL_ENDPOINT_HOSTS`(쉼표 목록)다. 코드에 있는 호스트는 `hooks.slack.com`뿐이다. chatic 호스트는 env에만 있다.
- `http:`, 깨진 URL, URL 안의 계정 정보는 언제나 거부한다.
- 이번 라운드는 깨지는 변경을 하지 않는다. 그래서 env가 없을 때 규칙이 다르다.

| 시점 | `CHANNEL_ENDPOINT_HOSTS` 있음 | `CHANNEL_ENDPOINT_HOSTS` 없음 |
|---|---|---|
| 쓰기(`POST /hello/{id}/channel`) | 목록 안 호스트만. 그 밖에는 `400 INVALID ENDPOINT`. | `hooks.slack.com`, 또는 그 채널에 이미 저장된 endpoint와 같은 호스트만. 그 밖에는 `400`. |
| 발송(`send()`) | 목록 안 호스트만. 그 밖에는 POST 하지 않는다(`statusCode: 400`). | 목록 밖 `https:` 호스트도 보낸다. 경고 로그 한 줄을 남긴다. |

- 쓰기 때 거부는 저장 전에 한다. 같은 호스트 비교가 필요할 때만 저장된 채널을 한 번 읽는다(env 없음, 목록 밖 호스트).
- 같은 호스트 규칙의 목적: 운영자가 env 없이도 기존 chatic 채널의 `rules`·`token`을 고칠 수 있다.
- 발송 때 검사는 저장된 endpoint와 설정(`SLACK_<채널>`) endpoint 모두에 한다.
- 경고 로그: `WARN! endpoint host not in allow-list (CHANNEL_ENDPOINT_HOSTS unset) = https://<호스트>/***`. 경로·쿼리·토큰은 없다.
- 오류 메시지에 endpoint를 넣지 않는다.
- 규칙은 `src/service/channel-policy.ts`에 있다.

### H-2 — protocol 메시지 거부

- lemon-core 5.0.11에는 SNS·SQS protocol 분기를 끄는 설정이 없다. 그래서 `src/engine.ts`가 `$lambda.sns`·`$lambda.sqs`의 `handle()`을 감싼다(`src/service/protocol-guard.ts`).
- 로컬 모드가 아니면 subject `x-protocol-service` 레코드를 lemon-core에 넘기기 전에 버린다. 레코드마다 경고 로그 한 줄을 남긴다.
- SQS: 버린 레코드는 `batchItemFailures`에 넣지 않는다. 다시 오지 않는다.
- 다른 subject(`error`, `slack`)는 그대로 리스너로 간다.
- 로컬 모드에서는 버리지 않는다. 로컬 전송(`LOCAL_TRANSPORT=mock`)이 `/hello/0/sqs`·`/sns` 자가 시험에 쓴다.
- `doPostSqs`·`doPostSns`는 로컬 모드만 돈다. 그 밖에는 `404`다. Lambda에서는 자기에게 보낸 protocol 메시지를 어차피 버리기 때문이다.
- 보조 수단: lemon-core v5의 서명 검사(`PROTOCOL_VERIFY=enforce`)도 있다. 이번 변경은 그것에 기대지 않는다.

### L-1 — 발송 시간 제한

- `postMessage()`는 10초(`POST_TIMEOUT_MS`) 뒤 요청을 끊는다. 결과는 `504 TIMEOUT - postMessage(<호스트>) after 10000 ms`다.
- 요청 오류(`error` 이벤트)는 reject 한다. 전에는 처리하는 곳이 없었다.

### L-2 — 라우팅 패턴

- `/.../` 패턴은 앞뒤 `/` 한 글자씩만 뗀다. 전에는 끝 두 글자를 뗐다(`/error/` → `erro`).
- 패턴은 한 번만 컴파일한다. `g` 플래그를 쓰지 않는다. 그래서 `test()`가 상태를 갖지 않는다.
- 패턴은 200자 이하다. 쓰기 때 컴파일이 실패하면 `400 INVALID RULE`이다.
- 매칭 때 잘못된 패턴은 매칭 없음으로 본다. throw 하지 않는다.

### L-3 — 데모 버퍼

- `BUFF`는 최대 100개다. 가득 차면 가장 오래된 것부터 지운다. `POST /hello/subscribe`는 계속 성공한다(헬스 체크 용도 유지).
- `name`은 200자에서 자른다. `PUT /hello/{id}`는 `name`만 받는다.

### L-4 — 로그 마스킹

- lemon-core의 `maskHeaders()`는 내부 전용이다(export 안 됨). 그래서 같은 형식(`[masked:<길이>]`)의 로컬 함수를 만들었다.
- 가리는 키: `token`, `authorization`, `cookie`, `set-cookie`, `x-lemon-identity`, `x-protocol-context`, `x-protocol-signature`, `password`, `secret`. `endpoint`는 `<scheme>//<host>/***`만 남긴다.
- 적용한 로그: `postMessage()`, `send()`, `doPostChannel()`, `doPostEvent()`, `doPostSlack()`, 에러·슬랙 변환기.

### L-5 — IAM

- `serverless.yml`에서 `lambda:InvokeFunction`을 지웠다. H-2 뒤에는 Lambda를 부르는 코드 경로가 없다.
- lemon-core JWT 검사 중 `iss: api/<서비스>`는 protocol `execute()`를 쓴다. 이 권한이 없으면 실패한다. 실패는 `valid: false`로 끝난다. hello는 사용자 신원을 쓰지 않는다.
- `SNS:GetEndpointAttributes`를 지웠다. 코드와 lemon-core 어디에도 쓰지 않는다.
- SNS publish·SQS 권한은 자기 리소스로 둔다. 바꾸지 않았다.

## 배포 전에 할 일 (사람)

1. env 없이 배포해도 된다. chatic 발송은 멈추지 않는다. 목록 밖 호스트마다 경고 로그가 남는다.
2. 저장된 채널 중 `http://` endpoint가 있는지 본다. 그런 채널은 env와 관계없이 발송이 멈춘다. 로그 `endpoint not allowed:<채널>` 줄로 찾는다.
3. 배포 뒤 `backend` 로그에서 `endpoint host not in allow-list` 줄의 호스트를 모은다.
4. 권장: 그 호스트를 env 파일의 스테이지마다 `CHANNEL_ENDPOINT_HOSTS`에 넣고 다시 배포한다. 이때부터 허용 목록이 전체 적용된다.
5. 배포 뒤 opt-in E2E(`hello-service.spec.ts`, `ENV=<프로필>`)는 `dynamo`·`sqs`·`sns`에 `404`를 기대한다. 배포 전에는 이 시험이 실패한다.

## 검증

에이전트가 로컬에서 돌렸다. AWS·네트워크를 쓰지 않았다.
환경: `AWS_CONFIG_FILE=/dev/null`, `AWS_SHARED_CREDENTIALS_FILE=/dev/null`, `AWS_EC2_METADATA_DISABLED=true`, `AWS_PROFILE` 없음.

| 명령 | 결과 |
|---|---|
| `npx tsc --noEmit` | 출력 없음, exit 0 |
| `npm test` | `Test Suites: 7 passed, 7 total`, `Tests: 49 passed, 49 total` |
| `npm run lambda:test` | `tests 80`, `pass 80`, `fail 0` |
| `npm run build` | exit 0 |

TDD 순서: 동작마다 spec을 먼저 썼다. 구현 전에 spec이 실패하는 것을 확인했다.
대조 시험: `protocol-guard.spec.ts`의 control 시험은 guard 없이 protocol 레코드가 `handleProtocol()`과 `execute(callback)`에 닿는 것을 보인다.

| spec | 다루는 항목 |
|---|---|
| `src/service/protocol-guard.spec.ts` | H-2 |
| `src/service/channel-policy.spec.ts` | H-1, L-2 |
| `src/service/log-mask.spec.ts` | L-4 |
| `src/service/slack-service.spec.ts` | H-1(발송 때), L-1, L-2(매칭) |
| `src/api/hello-api.spec.ts` | C-1, H-1(쓰기 때·응답), H-2(`sqs`·`sns`), L-3 |

## 고치지 못한 것

- **M-3**: 잘못된 JSON은 lemon-core가 컨트롤러 전에 파싱한다(`@body[<원문>] is not valid JSON`). 이 메시지는 `@`로 시작한다. 그래서 `400`이고 리포트 대상이다. 리포트하지 않는 형식은 `404 NOT FOUND`, `400 SIGNATURE`, 301·302뿐이다. 앱 코드가 이 경로를 바꿀 방법이 없다. lemon-core 수정(원문을 메시지에 넣지 않기 또는 리포트 제외)이 필요하다.

## 후속

- 함수별 IAM 역할 분리(`backend`·`lambda`).
- M-3 lemon-core 수정.
- 공개 `POST /hello/subscribe`의 `400`(`.name (string) is required`)도 리포트된다. 리포트 폭주 가능성을 본다.
- 정규식 패턴의 역추적(ReDoS)은 길이 상한만으로 막지 못한다. 패턴은 `aws_iam` 쓰기만 받는다.
- 리포트 본문을 슬랙·S3로 보낼 때(`asText(data)`, 문맥 첨부)는 마스킹하지 않는다. 이번 마스킹은 로그만이다.
