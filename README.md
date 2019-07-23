[![travis](https://travis-ci.org/lemoncloud-io/lemon-hello-api.svg?branch=master)](https://travis-ci.org/lemoncloud-io/lemon-hello-api)
[![codecov](https://codecov.io/gh/lemoncloud-io/lemon-hello-api/branch/master/graph/badge.svg)](https://codecov.io/gh/lemoncloud-io/lemon-hello-api)
[![npm version](https://badge.fury.io/js/lemon-hello-api.svg)](https://badge.fury.io/js/lemon-hello-api)
[![GitHub version](https://badge.fury.io/gh/lemoncloud-io%2Flemon-hello-api.svg)](https://badge.fury.io/gh/lemoncloud-io%2Flemon-hello-api)

# lemon-hello-api

Basic Serverless Hello API with `Lambda` + `API Gateway` + `Web Socket` + `SNS` + `SQS` + `KMS`

- Hello Nodejs DevOps Project with `babel` + `eslint` + `jest` + `supertest` + `codecov` + `travis`

- Integrate with `Slack` + `CloudWatch Alarm`


## 설명 (Description)

- `Nodejs` 기반 오픈소스 표준 개발 환경 구성안.
- AWS CloudWatch 의 내용을 `lemon-hello-sns`으로 수신 함 -> 이후 슬랙으로 전달
- 슬랙 webhook를 이용하여, 해당 슬랙 채널에 메세지를 보냄


## 사용법 (Usage)

- Nodejs 에서 모듈로 이용 (for sending message to api)

    ```bash
    # npm 으로 패키지 설치.
    $ npm install lemon-hello-api --save
    ```

- **case1** 에러 발생시 `SNS`로 정보 보내기.

    ```js
    const payload = {...};
    try {
        ...
    } catch (e){
        const hello = require('lemon-hello-api');
        // `LS=1` means 'log silence'
        const sns = hello.lemon({ LS: '1' })('sns');
        const msgId = await $sns.reportError(e, payload);
    }
    ```

- 슬랙으로 에러 정보 표시.

    ![SlackError](assets/sns.report-error.png)



## 설치하기 (Installation)

**[전체 순서]**

1. KMS 로 슬랙채널 WebHook 암호화 시키기.
1. `npm run deploy` 으로 AWS 클라우드에 올리기
1. 그리곤, 즐기자~~

### STEP.1 KMS로 설정 내용 암호화 하기

- KMS 마스터 키ID 생성하기 (최초 생성)

    ```bash
    # 최초의 사용자 키 생성히기..
    $ aws kms create-key --profile <profile> --description 'hello master key'
    {
        "KeyMetadata": {
            "KeyId": "0039d20d-.....-387b887b4783",
        }
    }
    # Alias 생성하기 ('0039d20d-.....-387b887b4783'은 앞에서 생성된 KeyId 항목으로 변경)
    $ aws kms create-alias --profile <profile> --alias-name alias/lemon-hello-api --target-key-id 0039d20d-.....-387b887b4783
    ```

- (참고) 암호화 테스트 하기.

    ```sh
    # 'hello lemon' 를 <kms-key-id>로 암호화하기...
    $ aws kms encrypt --profile <profile> --key-id alias/lemon-hello-api --plaintext "hello lemon" --query CiphertextBlob --output text

    # 또는 서버실행후, 아래 요청으로 확인.
    $ http ':8888/hello/0/test-encrypt'
    ```

### STEP.2 AWS 클라우드에 배포

- AWS Lambda 에 배포

    ```bash
    # npm 명령어 실행. (profile <lemon>)
    $ npm run deploy.lemon
    ```

## 개발 (Development)

- 로컬에서 API 서버로 실행 (for local development)

    ```bash
    # express API 서버 올리기 (profile <lemon>)
    $ npm run express.lemon

    # httpie 로 요청하기 
    $ http ':8888/hello/'
    ```


## 기여하기 (Contribution)

누구나 어느내용이든 참여가능하며, 수정 요청시 PR 로 요청 주세요.


## 라이센스 (License)

[MIT](http://opensource.org/licenses/MIT)


----------------
# VERSION INFO #

Version History

| Version   | Description
|--         |--
| 1.0.0     | initial version with full deploy by profile+stage
| 1.0.1     | support `SNS` with CloudWatch Event, and post to `Slack`
| 1.0.2     | support `WSS` with API Gateway + WebSocket.
| 1.0.3     | support `SQS` with handling SQS message.
| 1.1.0     | support release version.

