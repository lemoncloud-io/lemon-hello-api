# lemon-hello-api

Basic Serverless Hello API with `Lambda` + `API Gateway` + `Web Socket` + `SNS` + `SQS` + `KMS`

- Hello Nodejs DevOps Project with `babel` + `eslint` + `jest` + `supertest` + `codecov` + `travis`

- Integrate with `Slack` + `CloudWatch Alarm`


## 설명 (Description)

- `Nodejs` 기반 오픈소스 표준 개발 환경 구성안.
- AWS CloudWatch 의 내용을 `lemon-hello-sns`으로 수신 함 -> 이후 슬랙으로 전달
- 슬랙 webhook를 이용하여, 해당 슬랙 채널에 메세지를 보냄


## 사용법 (Usage)

로컬에서 바로 실행

    ```bash
    $ npm install
    $ npm run express
    ```

### 준비. KMS로 설정내용 암호화 하기

1. KMS 마스터 키ID 생성하기 (최초 생성)

    ```bash
    # 최초의 사용자 키 생성히기..
    $ aws kms create-key --profile <profile> --description 'hello master key'
    {
        "KeyMetadata": {
            "AWSAccountId": "000000000000",
            "KeyId": "0039d20d-.....-387b887b4783",
            "Arn": "arn:aws:kms:ap-northeast-2:000000000000:key/0039d20d-.....-387b887b4783",
            "CreationDate": 0,
            "Enabled": true,
            "Description": "hello master key",
            "KeyUsage": "ENCRYPT_DECRYPT",
            "KeyState": "Enabled",
            "Origin": "AWS_KMS",
            "KeyManager": "CUSTOMER"
        }
    }
    # Alias 생성하기 ('0039d20d-.....-387b887b4783'은 앞에서 생성된 KeyId 항목으로 변경)
    $ aws kms create-alias --profile <profile> --alias-name alias/lemon-hello-api --target-key-id 0039d20d-.....-387b887b4783
    ```

1. 암호화 테스트 하기.

    ```sh
    # 'hello lemon' 를 <kms-key-id>로 암호화하기...
    $ aws kms encrypt --profile <profile> --key-id alias/lemon-hello-api --plaintext "hello lemon" --query CiphertextBlob --output text

    # 또는 서버실행후, 아래 요청으로 확인.
    $ http ':8888/hello/0/test-encrypt'
    ```


## 설치하기 (Installation)

AWS Lambda 에 배포됨.

    ```bash
    $ npm run deploy
    ```


## 기여하기 (Contribution)

누구나 어느내용이든 참여가능하며, 수정 요청시 PR 로 요청 주세요.


## 라이센스 (License)

MIT License


----------------
# VERSION INFO #

Version History

| Version   | Description
|--         |--
| 1.0.0     | initial version with full deploy by profile+stage
| 1.0.1     | support `SNS` with CloudWatch Event, and post to `Slack`
| 1.0.2     | support `WSS` with API Gateway + WebSocket.
| 1.0.3     | support `SQS` with handling SQS message.

