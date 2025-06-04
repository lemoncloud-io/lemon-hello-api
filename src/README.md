**UPGRADE GUIDE: lemon-core V3 to V4**

---

### 1. Node.js 버전 업그레이드

* 목표: Node.js 22
* 명령:

  ```bash
  nvm install 22
  nvm use 22
  ```
* `.nvmrc` 파일 업데이트: `22`

---

### 2. AWS SDK v2 \u2192 v3 마이그레이션

1. **자격 증명 설정**

   * 기존 `credentials` 방식 대신 `lemon-core` 의 `asyncCredentials()` 사용
   * 예시:

     ```ts
     import { asyncCredentials } from 'lemon-core';

       const credentials = await asyncCredentials(PROFILE);
     ```

2. **클라이언트 초기화 방식**

   * v3 클라이언트는 `awsConfig($engine, region)` 를 사용하여 초기화
   * 예시:

     ```ts
     import { SQSClient } from '@aws-sdk/client-sqs';
     import $engine from 'lemon-core';

     async function createSqsClient() {
       const region = 'ap-northeast-2';
       return new SQSClient(awsConfig($engine, region));
     }
     ```

3. **기존 v2 코드 제거 시점**

   * v3 마이그레이션 완료 후 `import AWS from 'aws-sdk'` 등 v2 전용 코드를 모두 삭제 후 마이그레이션

---

### 3. `lemon-devkit` 설치

* `devDependencies`에 추가:

  ```bash
  npm install --save-dev lemon-devkit
  ```

---

### package.json 예시 (주요 변경점)

```diff
 {
   "engines": {
-    "node": ">=14",
+    "node": ">=22"
   },
   "dependencies": {
-    "aws-sdk": "^2.x",
+    "@aws-sdk/client-s3": "^3.x",
+    "@aws-sdk/client-dynamodb": "^3.x",
+    "@aws-sdk/lib-dynamodb": "^3.x",
+    "@aws-sdk/client-sns": "^3.x",
+    "@aws-sdk/client-sqs": "^3.x",ㄴ
     "lemon-core": "^4.x",
   },
   "devDependencies": {
+    "lemon-devkit": "^0.0.3",
     "typescript": "^4.x",
     "jest": "^29.x"
   }
 }
```

---

### 한눈에 할 일 체크리스트

* [ ] **Node.js 22로 업그레이드**

  * `nvm` 버전 변경, `.nvmrc` 수정

* [ ] **AWS SDK v3 모듈 교체 & 설정**

  * S3 / DynamoDB / SNS / SQS 등을 `@aws-sdk/...` 모듈로 변경
  * **자격 증명**: 기존 `credentials` 코드를 `asyncCredentials()` 호출로 교체
  * **클라이언트 초기화**: `awsConfig($engine, region)` 사용
  * **v2 코드 제거**: `import AWS from 'aws-sdk'` 등 기존 v2 코드를 모두 삭제

* [ ] **lemon-devkit 설치** (devDependency)

* [ ] **CI/CD 환경 점검**

  * serverless.yml, Dockerfile 등 전부 Node.js 22 적용 여부 확인

* [ ] **테스트 코드 / Mock 설정 점검**

  * SDK 변경에 따른 Mock 라이브러리 설정 확인

* [ ] **레거시 `aws-sdk` v2 코드 제거 완료**

---
