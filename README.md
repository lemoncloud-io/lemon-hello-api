# eureka-hello-api

Simple MicroService over Serverless Cloud with [lemon-core](https://github.com/lemoncloud-io/lemon-core).
Nothing to manage at all, just run and go.

## Description

- Sample boilerplate to develop the servlesss API based on `Nodejs` + `Typescript`
- Use `DynamoDB` as the main storage.

## Usage

- Pre requirements (or installations) before starting.

    1. [aws-cli](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) with api-key
    2. [git](https://git-scm.com/book/en/v2/Getting-Started-Installing-Git)
    3. [nodejs18](https://nodejs.org/en/blog/release/v18.12.0)
    4. (optional) [httpie](https://httpie.io/docs/cli/installation)

- Fork(or clone), develop and deploy the serverless api.

    ```bash
    # clone the sample code.
    $ git clone https://github.com/lemoncloud-io/eureka-hello-api.git

    # STEP.1 install the dependecies.
    $ npm ci

    # STEP.2 run the server locally.
    $ npm run express

    # STEP.3 make request and develop locally.
    $ http :8000/hello

    # STEP.4 deploy into your AWS cloud (`AWS-Key` is required).
    $ npm run deploy

    # (example) use AWS authorized call.
    $ http --auth-type aws4 https://7s91yrozci.execute-api.ap-northeast-2.amazonaws.com/dev/hello/0 name=world

    # STEP.5 check the deploy info
    $ npm run info

    # STEP.6 remove(or uninstall)
    $ npm run remove
    ```

## LICENSE

[MIT](http://opensource.org/licenses/MIT)

------------------

## VERSION INFO ##

Version History

| Version   | Description
|--         |--
| 0.24.511  | optimized with `lemon-core#3.2.15`.
| 0.24.1127 | initial version with `lemon-core#3.2.10`.
