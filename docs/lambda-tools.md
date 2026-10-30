# Lambda tools (`lemon-*` commands of lemon-core)

Since lemon-core 5.0.13 (v5 B19) the Lambda tools that were copied into this repository's `bin/` ship with lemon-core as npm bins.
This service runs them through the same `npm run` scripts, so the commands are unchanged.
`npm run <script> -- --help` prints the usage of each tool.

Options, output, credentials, safety rules (strict options, stage guard, identity line, redaction, size cap) and exit codes are documented once, in lemon-core:

-   `HOW_TO_UPGRADE_V5.md` § 19 — script mapping and optional peers.
-   `docs/v5/B19-bin-tools.md` — `lemon-lambda-invoke`, `lemon-lambda-logs`, `lemon-lambda-perf`.

This page keeps only what is specific to this service. The tests of the tools are in lemon-core (`npm test` there); this repository has no `lambda:test` script any more.

## Scripts

| Script          | lemon-core bin        | Does                                                                            |
| --------------- | --------------------- | ------------------------------------------------------------------------------- |
| `lambda:invoke` | `lemon-lambda-invoke` | Invoke the deployed function with a generated event (web, cron, SNS, SQS, raw). |
| `lambda:logs`   | `lemon-lambda-logs`   | Print or follow the function's CloudWatch logs.                                 |
| `perf:lambda`   | `lemon-lambda-perf`   | Invoke several times and summarize cold / warm timings.                         |

This service is deployed with the Serverless Framework (`sls` scripts in `package.json`). The lemon-core pack / deploy tools (`lemon-lambda-pack`, `lemon-lambda-deploy`) are not wired here.

## What the tools read in this repository

The tools run from the service root (`process.cwd()`; npm runs a script from the package root). They also take `--cwd <dir>`.

-   `serverless.yml`: only the top-level `service:` line (`lemon-hello-api`). The function name is `<service>-<stage>-<fn>` and the log group `/aws/lambda/<name>`.

Nothing reads `env/*.yml`, `env/config.js`, or the `custom:` / `environment:` blocks of `serverless.yml`.

lemon-core is a runtime dependency, so its `bin/` files are part of `node_modules/lemon-core` in the deployed package. They are never loaded by `handler.js`.

## Functions

| `--fn`             | Events                                                    |
| ------------------ | --------------------------------------------------------- |
| `lambda` (default) | API Gateway (`http` events of `serverless.yml`)           |
| `backend`          | SNS (error reports, slack messages), SQS, DynamoDB stream |

## Accounts and stages

The `package.json` deploy scripts use two deploy profiles: the default one (`deploy`, `info`, `logs`, … — no `--aws-profile`, so the shell's AWS credentials pick the account) and the `*.lemon` scripts (with an explicit `--aws-profile`).
Pick the account with `--profile <name>` and check the identity line (account last 4 digits) before you read anything.
Both profiles have `dev` and `prod` deploy scripts. A `prod` target needs `--stage prod --confirm-stage prod`, and only on an explicit human instruction.

## AWS SDK packages

The AWS SDK packages are optional peers of lemon-core. `--help` and `--dry` need none of them; a call that needs a missing one stops with an `npm i -D <package>` hint.

| Package                           | Declared here in  | Needed by                           |
| --------------------------------- | ----------------- | ----------------------------------- |
| `@aws-sdk/client-lambda`          | `dependencies`    | `lambda:invoke`, `perf:lambda`      |
| `@aws-sdk/client-sts`             | `dependencies`    | the identity line                   |
| `@aws-sdk/credential-providers`   | `dependencies`    | `--profile <name>`                  |
| `@aws-sdk/client-cloudwatch-logs` | `devDependencies` | `lambda:logs`, `perf:lambda --logs` |

## Examples

```sh
# web GET /hello/0 with the log tail
npm run lambda:invoke -- --stage dev --profile <name> --path /hello/0 --tail

# internal web call (no Host header, like a direct invoke); the channel view stays masked (unmasked only in local mode)
npm run lambda:invoke -- --stage dev --internal --path /hello/public/channel

# SNS error report into the backend function (the same path as a lemon-core `doReportError()`); this sends to the real channels
npm run lambda:invoke -- --stage dev --profile <name> --fn backend --event sns --subject error --body @sample/error-1.json --dry

# SNS slack message into the backend function
npm run lambda:invoke -- --stage dev --profile <name> --fn backend --event sns --subject slack --body @sample/slack-1.json --dry

# follow the backend logs (SNS notifications)
npm run lambda:logs -- --stage dev --profile <name> --fn backend --follow

# 5 runs of GET /hello/0 on dev, with the full CloudWatch log of each run
npm run perf:lambda -- --stage dev --profile <name> --logs
```

`--raw` turns off the redaction of accounts, ARNs and tokens: do not use it in shared logs.
