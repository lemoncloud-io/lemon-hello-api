# lemon-hello-api

Basic Serverless Lambda API Example


# Quick Start

- run API sever in local

```bash
$ npm install
# by use serverless-offline
$ npm run server.lemon
# by use express.
$ npm run express.lemon
# call API
$ http ':8888/hello/'
```


# Deploy to AWS

- by profile + stage, use different configuration

```bash
# deploy profile lemon
$ npm run deploy.lemon
# show sls deploy info of lemon profile
$ npm run info.lemon
# show CloudWatch logs of lemon/hello function.
$ npm run logs.lemon hello
# un-deploy(remove) profile lemon
$ npm run remove.lemon
```

----------------
# VERSION INFO #

Version History

| Version   | Description
|--         |--
| 1.0.0     | initial version with full deploy by profile+stage
