# lemon-hello-api

Basic Serverless Lambda API Example


# Quick Start

- run API sever in local

```bash
$ npm install

# by use serverless-offline
$ npm run server

# call API
$ http ':8888/hello/'
```


# Deploy to AWS

- by profile + stage, use different configuration

```bash
# deploy profile lemon
$ npm run deploy
```

----------------
# VERSION INFO #

Version History

| Version   | Description
|--         |--
| 1.0.0     | initial version with full deploy by profile+stage
| 1.0.1     | support `SNS` with CloudWatch Event, and post to `Slack`

