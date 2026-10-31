# Lambda tools (`lemon-*` commands of lemon-core)

Since lemon-core 5.0.13 (v5 B19) the Lambda tools that were copied into this repository's `bin/` ship with lemon-core as npm bins.
This service runs them through the same `npm run` scripts, so the commands are unchanged.
`npm run <script> -- --help` prints the usage of each tool.

Options, output, credentials, safety rules (strict options, stage guard, identity line, redaction, size cap) and exit codes are documented once, in lemon-core:

-   `HOW_TO_UPGRADE_V5.md` § 19 — script mapping and optional peers.
-   `docs/v5/B19-bin-tools.md` — `lemon-lambda-invoke`, `lemon-lambda-logs`, `lemon-lambda-perf`.
-   `docs/v5/B19-bin-deploy.md` — `lemon-lambda-pack`, `lemon-lambda-deploy`, `lemon-lambda-migrate`, `lemon-lambda-deploy-dev`.
-   `docs/v5/B24-migration-targets.md` — the reviewed migration targets (this service's dev stack is one since 5.0.16).

This page keeps only what is specific to this service. The tests of the tools are in lemon-core (`npm test` there); this repository has no `lambda:test` script any more.

## Scripts

| Script              | lemon-core bin            | Does                                                                                               |
| ------------------- | ------------------------- | -------------------------------------------------------------------------------------------------- |
| `lambda:invoke`     | `lemon-lambda-invoke`     | Invoke the deployed function with a generated event (web, cron, SNS, SQS, raw).                    |
| `lambda:logs`       | `lemon-lambda-logs`       | Print or follow the function's CloudWatch logs.                                                    |
| `perf:lambda`       | `lemon-lambda-perf`       | Invoke several times and summarize cold / warm timings.                                            |
| `lambda:pack`       | `lemon-lambda-pack`       | Build a verified Lambda ZIP in Docker into `.artifacts/lambda/`. No AWS access.                    |
| `lambda:deploy`     | `lemon-lambda-deploy`     | Verify a pack output and print the offline deploy plan. No AWS access.                             |
| `lambda:migrate`    | `lemon-lambda-migrate`    | Move the dev Serverless stack to the deploy service, one phase at a time. Offline plan by default. |
| `lambda:deploy:dev` | `lemon-lambda-deploy-dev` | Dev-only `code` deploy of a pack to the migrated dev functions. Offline plan by default.           |

The Serverless Framework is not installed and no script calls `sls` ([serverless.md](serverless.md)).
dev moves to the deploy service with `lambda:migrate`, then takes code with `lambda:deploy:dev` ([lambda-migrate.md](lambda-migrate.md)).
prod is still a Serverless stack and is not a reviewed migration target yet.

## What the tools read in this repository

The tools run from the service root (`process.cwd()`; npm runs a script from the package root). They also take `--cwd <dir>`.

-   `serverless.yml`: only the top-level `service:` line (`lemon-hello-api`). The function name is `<service>-<stage>-<fn>` and the log group `/aws/lambda/<name>`.
-   `lambda:migrate` and `lambda:deploy:dev` read only their `--config` file (and the pack output). The migration reads the live stack, not `serverless.yml`.

Nothing reads `env/*.yml`, `env/config.js`, or the `custom:` / `environment:` blocks of `serverless.yml`.
The local server (lemon-core `buildExpress()`, not a `lemon-*` tool) reads the `http` events of `serverless.yml` for its routes. That is why the file stays.

lemon-core is a runtime dependency, so its `bin/` files are part of `node_modules/lemon-core` in the deployed package. They are never loaded by `handler.js`.

## Functions

| `--fn`             | Events                                                    |
| ------------------ | --------------------------------------------------------- |
| `lambda` (default) | API Gateway (`http` events of `serverless.yml`)           |
| `backend`          | SNS (error reports, slack messages), SQS, DynamoDB stream |

## Accounts and stages

This repository has no deploy-profile scripts any more. Without `--profile`, the shell's AWS credentials pick the account.
Pick the account with `--profile <name>` and check the identity line (account last 4 digits) before you read anything.
A `prod` target needs `--stage prod --confirm-stage prod`, and only on an explicit human instruction.
The migration and dev deploy configs carry their own `account` and `profile`; the wrapper checks the account with STS before it runs a phase.

## AWS SDK packages

The AWS SDK packages are optional peers of lemon-core. `--help` and `--dry` need none of them; a call that needs a missing one stops with an `npm i -D <package>` hint.

| Package                           | Declared here in  | Needed by                           |
| --------------------------------- | ----------------- | ----------------------------------- |
| `@aws-sdk/client-lambda`          | `dependencies`    | `lambda:invoke`, `perf:lambda`      |
| `@aws-sdk/client-sts`             | `dependencies`    | the identity line                   |
| `@aws-sdk/credential-providers`   | `dependencies`    | `--profile <name>`                  |
| `@aws-sdk/client-cloudwatch-logs` | `devDependencies` | `lambda:logs`, `perf:lambda --logs` |

## Pack and offline deploy plan

The two tools prepare a deploy through the deploy service. Without `--apply` they deploy nothing.

| File                             | Committed | Does                                                                                            |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------- |
| `pack.config.json`               | yes       | Pack adapter: source allowlist, runtime paths (`handler.js`, `dist`, `data`), `handler.lambda`. |
| `deploy.config.example.json`     | yes       | `code` mode example. Every value is a placeholder.                                              |
| `deploy.dev.config.example.json` | yes       | `lambda:deploy:dev` example (`code`, dev, with `profile`). Every value is a placeholder.        |
| `migration.config.example.json`  | yes       | `lambda:migrate` example (hello dev target, pinned revision). Every value is a placeholder.     |
| `.artifacts/`                    | no        | Pack outputs and real deploy configs. Git-ignored.                                              |

### Pack

```sh
npm run lambda:pack                     # new directory under .artifacts/lambda/
npm run lambda:pack -- --output .artifacts/lambda/release-candidate
```

-   Needs Node 24, Git and Docker. Needs no AWS credentials. Uploads nothing.
-   It builds from a source snapshot in the Lambda image (`npm ci`, `npm run build`, production install). Host `node_modules` and `dist` are not used.
-   The output directory has `lambda.zip` and `manifest.json`. Check `unzip -t` and the manifest `validation` block before you use the ZIP.
-   The dev-only stand-in `scripts/deepmerge-safe/` is a local link in `package-lock.json`. Since lemon-core 5.0.16 (v5 B24-b) the pack accepts such an in-repository, dev-only link and keeps it out of the ZIP.
-   Measured 2026-10-31 with lemon-core 5.0.16: ZIP 11,332,408 bytes, 9,213 files, `unzip -t` clean, no `deepmerge` and no `scripts/` in the ZIP, `validation` all passed (lockfile, runtime, ZIP round trip, handler export smoke).

### Offline deploy plan

```sh
mkdir -p .artifacts
cp deploy.config.example.json .artifacts/deploy.code.json
# replace the placeholders in .artifacts/deploy.code.json (account, region, endpoint, artifactBucket); add "profile" there if needed
npm run lambda:deploy -- --config .artifacts/deploy.code.json --artifact .artifacts/lambda/release-candidate
```

-   Without `--apply` it verifies the manifest, the ZIP hash and the file list, and prints the plan JSON. It reads no credentials and calls no network. Exit 0 = plan printed. Exit 2 = invalid local input.
-   `code` mode only: it updates the code of the two existing functions `lambda` and `backend`. It does not change environment, runtime, handler, memory, timeout, IAM, routes or event wiring.
-   Do not use `bootstrap` mode for this service. Bootstrap converges its own table, queue, topic and routes with template defaults. It does not know this service's table name, www bucket or S3 bucket policy. It would create new resources next to the existing stack and split the data between two tables.
-   Checked 2026-10-31 with a copy of the example (placeholders unchanged) and the probe ZIP: exit 0, `execution: offline-plan`, `handler.lambda`, steps end with `existing functions ×2 code + verification`.

### `--apply` only after the migration

In `code` mode the preflight needs both functions to exist **and** to be managed by the deploy service.
The functions are owned by the Serverless stack `lemon-hello-api-<stage>` until that stack is migrated.
For dev: run the `lambda:migrate` phases through `verify` first, then deploy with `lambda:deploy:dev` ([lambda-migrate.md](lambda-migrate.md)). `--apply` is human only.
For prod: no migration target yet. Do not pass `--apply`. See [serverless.md](serverless.md).

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
