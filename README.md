# lemon-hello-api

Basic Serverless Lambda API Example

# Basic Usage (기본 사용법)

## Quick Start

- run API sever in local

```bash
$ npm install

# by use serverless-offline
$ npm run server

# call API
$ http ':8888/hello/'
```

## Deploy to AWS

- by profile + stage, use different configuration

```bash
# deploy profile lemon
$ npm run deploy
```


# Functions (기능들)

## Post Message to Slack Channel (슬랙 채널에 메세지 보내기)

Send "hello" text message to slack's public channel.

`$ echo '{"text":"hello"}' | http ':8888/hello/public/slack'`

- config `SLACK_PUBLIC` environment to override webhook address.





----------------
# VERSION INFO #

Version History

| Version   | Description
|--         |--
| 1.0.0     | initial version with full deploy by profile+stage
| 1.0.1     | support `SNS` with CloudWatch Event, and post to `Slack`
| 1.0.2     | support `WSS` with API Gateway + WebSocket.

