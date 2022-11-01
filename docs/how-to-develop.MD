# how-to-develop

# 1. AWS Profile Registration

**AWS** 명령줄 인터페이스(**CLI**)는 **AWS** 서비스를 관리하는 통합 도구입니다. <br>
CLI를 통해 여러 **AWS** 서비스를 명령줄에서 제어하고 스크립트를 통해 자동화할 수 있습니다.

- STEP.1 - 설치
    
    ```bash
    $ brew install awscli
    ```
    
- STEP.2 - 인증 정보 설정
AWS IAM에서 발급 받은 credential 파일에서 `Access Key ID`와 `Secret Access Key`를 <br>
해당 command를 이용하여 등록합니다.
    
    ```bash
    $ aws configure --profile <name>
    AWS Access Key ID [None]: <your_access_key>
    AWS Secret Access Key [None]: <your_secret_key>
    Default region name [None]: <your_region>
    Default output format [None]: 
    ```
    
- STEP.3 - Default로 설정하기
    
    ```bash
    $ export AWS_DEFAULT_PROFILE=<name>
    ```
    
- STEP.4 - 등록 정보 확인하기
설정한 인증 정보를 확인하기 위해서는 `aws configure list` command를 사용합니다.<br>
결과는 테이블 형태로  출력이 되는데, 보안을 위해서 설정값들은 뒤 4자리만 보여줍니다.
    
    ```bash
    # Both are available
    $ aws configure list
    $ aws configure list --profile <name>
    ```
    

---

# 2. How to Build

- **STEP.1 - package 설치하기**
    
    ```bash
    $ npm ci
    ```
    
- **STEP.2 - ~~test 환경에서 DynamoDB 연결을 위해 clone 후 환경 변수에 table을 추가해주어야 한다.~~**<br>
(2022.11.1 기준 default로 설정됨)
    
    ```yaml
    // lemon.yml
    #-----------------------------------
    # local development configuration.
    local:
        <<: *default_env
        STAGE: 'local'
        MY_DYNAMO_TABLE: LemonHelloTest // 요놈 추가
    
    #-----------------------------------
    ```
    
- **STEP.3 - slack webhook kms encrypt 및 등록**<br>
slack 내 public 채널 외 다른 채널에 연결하기 위해서는 `webhook URL`을 등록해야합니다.<br>
webhook URL은 외부에 노출되면 안되므로, `kms`를 통해 암호화 합니다.
    
    ```bash
    // profile = lemon
    # create initial master-key in KMS (example)
    $ aws kms create-key --profile <profile> --description 'hello master key'
    {
        "KeyMetadata": {
            "KeyId": "0039d20d-112233445566-387b887b4783",
        }
    }
    # create Alias as `lemon-hello-api`
    $ aws kms create-alias --profile <profile> --alias-name alias/lemon-hello-api --target-key-id <KeyId>
    
    # run encrypt
    $ aws kms encrypt --profile <profile> --key-id alias/lemon-hello-api --cli-binary-format raw-in-base64-out --plaintext "암호화 할 text" --query CiphertextBlob --output text
    ```
    
    → encrypt한 키를 `lemon.yml` 파일에 KEY:VALUE 형태로 저장해줍니다.
    
    ```yaml
    # lemon.yml
    ---
    #-----------------------------------
    # Lemon Basic Environment Variables.
    #-----------------------------------
    # default
    default_env: &default_env
        LS: 0 # log silence.
        LC: 1 # line-coloring
        TS: 1 # time-stamp in line
        NAME: 'lemon' # profile name.
        BACKBONE_API: '' # NO USE BACKBONE
    		# Basic Form example
        SLACK_EXAMPLE: 'AQICAH~=='
    ```
    
- **STEP.4 - Build**
    
    ```bash
    $ npm run express.lemon
    ```
    
- **STEP.5 - API Request Test**<br>
build 및 server 구동에 성공했다면, api 요청을 통해 동작을 확인할 수 있습니다.
api의 기본 형태는 `/type/id/cmd`
    
    ```bash
    # http 통신을 위한 라이브러리 설치
    $ npm install httpie
    
    # server 구동 후, api 날려보기.. (hello-api.ts 참고)
    $ http ':8888/hello'
    
    # 원하는 slack 채널로 테스트 메시지 보내기
    echo '{"text":"hello lemon"}' | http ':8888/hello/<보낼 채널>/slack'
    ```
    
- **STEP.6 - 새로운 API를 작성하는 방법**<br>
slack에 대해 새로운 기능을 구현한 api를 작성하고 싶다면,
`hello-api.ts` 의 `HelloAPIController` 내부에서 `/type/id/cmd` 양식에 <br>맞추어 함수를 정의해줍니다. 외부의 http 요청은
`lambda-web-handler.ts`의 `handleProtocol`에 의해 decode되어, 이에 맞는 api를 찾게됩니다.
    
    ```tsx
    /*
     * request 예시
     * echo {"text":"test msg"} | http ':8888/hello/test/slack'
     * - type : hello
     * - id(channel) : test
     * - cmd : slack
     */ 
    
    public postHelloSlack() => {
    	...
    }
    ```
    

---

# 3. Code Convention

Contribute를 위해서는 다음과 같은 Code convention을 따라야 합니다.

- **In case of Comment on the function**<br>
    
    ```tsx
    /* Comment */
    ```
    
- **In case of Server log**<br>
    
    로그를 생성하기 위해 `_log()` 함수를 사용해야 합니다.
    
    ```tsx
    _log(NS, `Message`);
    ```
    
- **In case of Exception (error)**<br>
    
    convention에 따라 에러 메시지를 작성해야 합니다.
    오류 메시지는 `mxNextFailure()` (in lambda-web-handler.ts)에 의해 처리됩니다.
    
    변수 또는 속성으로 인해 발생하는 에러에는 다음이 포함되어야 합니다.
    
    > variable : `@`<br>
    > properties : `.`<br>
    > statusCode : `404 NOT FOUND` , `400 NOT SUPPORT` etc.
    > 
    
    ```tsx
    // example
    public postHello: NextHandler = async (id, $param, $body, $ctx) => {
            _log(NS, `postHello(${id})....`);
            _log(NS, `> $body=`, $body);
            const i = $U.N(id, 0);
            if (id == 'echo') return { id: '!', cmd: 'echo', param: $param, body: $body, context: $ctx };
            if (i) throw new Error(`@id[${id}] (number) is invalid!`); // variable
            if (!$body || !$body.name) throw new Error('.name (string) is required!'); // property
            this.NODES.push({ ...$body });
            return this.NODES.length - 1; // returns the last-index.
    ```
    
- **In case of Transform data-types**<br>
`lemon-engine`에서 제공하는 `$T`는 데이터 유형을 변환하는 데 유용한 기능입니다. 
필요에 따라 찾아 사용하세요
    
    > - transform to string w/ trim()
    > - transform to number(integer).
    > - transform to number(float)
    > - transform to Date formatted string
    > - merge simple-set from $org to $new
    > - compare object, and extract the only diff properties.
    > etc.
    
    ```tsx
    // example
    public checkImageKeyword = (body: any): ImageInfo => {
    		// const keyword = body.keyword ? body.keyword : 'cat';
    		const keyword = $T.S(body?.keyword, 'cat'); // recommend
    		...
    };
    ```
    

---

# 4. How to Development

> - TDD (Test-Driven-Development) 방법론을 통해 개발하는 것을 권장합니다.
> - Test coverage, Branch coverage 등을 고려하여 작성할 것을 권장합니다.
> - dummy-service를 작성하여, slack 서버로 요청을 보내지 않고, test code로 검증하는 방식을 권장합니다.
> - 함수 작성은 최소한의 기능 단위로 나눌 것을 권장합니다.
> 
- **run Test**
    
    ```bash
    $ npm run test.lemon
    ```
    
- **코드 작성 예시**
    - 해당 파트는 `hello-api.ts` 및 `hello-service.ts`를 대상으로 하고 있음.
        1. *spec.ts 파일을 생성하고*, *dummy instance를 생성한다.*
        본문에서는 HelloService에 대해 테스트를 수행하기 때문에 `DummyHelloService` 혹은 `HelloService` 타입을 이용한다.
            
            ```tsx
            // hello-service.spec.ts
            //! create service instance.
            export const instance = (type = 'dummy', current?: number) => {
                current = current ?? new Date().getTime();
                const service: DummyHelloService = type == 'dummy' ? new DummyHelloService() : new HelloService();
                service.setCurrent(current);
                return { service, current };
            };
            ```
            
        2. *만들고자 하는 기능의 unit test를 위한 test code를 작성한다.*
            
            ```tsx
            it('should pass getSubscriptionConfirmation()', async () => {
                    const { service } = instance('dummy');
                    expect2(() => service.hello()).toEqual('hello-mocks-service');
                    /* eslint-disable prettier/prettier */
                    expect2(await service.getSubscriptionConfirmation({snsMessageType:'', subscribeURL:''})).toEqual('PASS');
                    expect2(await service.getSubscriptionConfirmation({snsMessageType:'SubscriptionConfirmation', subscribeURL:''})).toEqual('PASS');
                    expect2(await service.getSubscriptionConfirmation({snsMessageType:'SubscriptionConfirmation', subscribeURL:'http://lemoncloud.io'})).toEqual('OK');
             });
            ```
            
        3. *test code를 통과하기 위한 코드를 작성한다.*
            
            ```tsx
            // hello-api.ts
            /**
             * process the request of subscription-confirmation     
             */
            public getSubscriptionConfirmation = async (param: { snsMessageType: string; subscribeURL: string }) => {
                _log(NS, `getSubscriptionConfirmation()...`);
                // Send HTTP GET to subscribe URL in request for subscription confirmation
                if (param?.snsMessageType === 'SubscriptionConfirmation' && param.subscribeURL) {
                    const uri = new URL(param.subscribeURL);
                    const path = `${uri.pathname || ''}`;
                    const search = `${uri.search || ''}`;
                    const api = new APIService('web', `${uri.origin}${path == '/' ? '' : path}`);
                    const res = await api.doGet(null, null, search.startsWith('?') ? search.substring(1) : search);
                    _log(NS, `> subscribe =`, $U.json(res));
                    return 'OK';
                }
                return 'PASS';
            };
            ```
            
        4. *실제 서버와 통신하는 것이 아닌, dummy service를 작성한다. 실제로 입력이 들어왔을 때와 같은 값을 리턴 하도록 구현해야 한다.*
            
            ```tsx
            // hello-dummies.ts
            public getSubscriptionConfirmation = async (param: { snsMessageType: string; subscribeURL: string }) => {
                    _log(NS, `getSubscriptionConfirmation()...`);
                    // Send HTTP GET to subscribe URL in request for subscription confirmation
                    if (param.snsMessageType == 'SubscriptionConfirmation' && param.subscribeURL) {
                        const res = { subscribe: true };
                        _log(NS, `> subscribe =`, $U.json(res));
                        return 'OK';
                    }
                    return 'PASS';
             };
            ```
            
        5. *여러 기능단위로 나누어 하나의 api 작성을 완료했다면, 최종적으로 api로 요청을 보내 통합 테스트를 할 수 있다.*
        이를 위해 supertest의 `request`를 사용한다.
            
            ```tsx
            it('should pass express route: GET /', async done => {
                    const res = await request(app).get('/');
                    expect2(() => ({ ...res, text: res.text.split('\n')[0] })).toMatchObject({
                        status: 200,
                        text: `${$pack.name}/${$pack.version}`,
                    });
                    done();
                });
            ```
            
- **부록**
    - **Expect2**<br>
    expect2로 비동기 처리를 할 경우 await을 통해 처리할 수 있다.
        
        ```tsx
        it ('should pass hello()', async done => {
        	...
        	expect2(() => service.syncHello()).toEqual('hello'); // sync
        	expect2(await service.asyncHello()).toEqual('hello'); // async
        	// expect2(() => service.asyncHello()).toEqual('hello'); // No recommend
        	...
        })
        ```
        
    - **Async done callback**<br>
    비동기 함수를 테스트할 때 사용하는 async done ⇒ { … done();}의 경우
    이전 버전의 경우 done Callback을 해주어야 했지만, 최신 버전에서는 Callback 처리를 해주지 
    않아도 된다.
        
        ```tsx
        // legacy
        it ('should pass hello()', async done => {
        	...
        	// end of code
        	done();
        })
        
        // new version
        it ('should pass hello()', async done => {
        	...
        	// end of code
        })
        ```