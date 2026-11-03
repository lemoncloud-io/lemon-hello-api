# Dev migration and code deployment (lemon-hello-api / dev)

`npm run lambda:migrate` moves the Serverless dev stack **`lemon-hello-api-dev`** to the deploy service, one reviewed phase at a time.
`npm run lambda:deploy:dev` then updates the code of the two migrated dev functions from a verified pack.
Both are lemon-core bins (`lemon-lambda-migrate`, `lemon-lambda-deploy-dev`). lemon-hello-api / dev / `lemon-hello-api-dev` is a reviewed target since lemon-core 5.0.16.

The contract is documented once, in the lemon-core repository (`v5` branch; the npm package does not ship `docs/`):

-   [`docs/v5/B19-bin-deploy.md`](https://github.com/lemoncloud-io/lemon-core/blob/v5/docs/v5/B19-bin-deploy.md) — config keys, phases, consent flags, checkout checks, receipts, exit codes.
-   [`docs/v5/B24-migration-targets.md`](https://github.com/lemoncloud-io/lemon-core/blob/v5/docs/v5/B24-migration-targets.md) — the reviewed target registry, hello's entry and state-file names, and why bootstrap mode is wrong for hello.

The lemon-templates-api `docs/lambda-migrate.md` is the longer worked example of the same tools.
This page keeps only what is specific to this service. prod is not a reviewed target: see [serverless.md](serverless.md).

## Never use bootstrap mode for hello

Do not run `lambda:deploy` in `bootstrap` mode for this service, at any stage.
Bootstrap ensures a table named by the lemon rule. hello's table is named outside that rule (`LemonHelloTest` for dev).
Bootstrap would create a new, empty table, point the functions at it, and split the channel settings between two tables.
Use `lambda:migrate` (it keeps the existing table and bucket), then `code` mode only.

## Prepare

Needs Node 24, Git, and a checkout of `lemoncloud-io/eureka-deploy-api` at the pinned revision `66d1e91a60a240765d44dedfdab73a92af6abd51` with a clean tracked tree.
The wrapper checks origin, exact HEAD and the entry file bytes, even for an offline plan. It never updates that checkout.
Execution also needs that checkout's locked dependencies, AWS CLI v2 and a named AWS profile that resolves on its own.

```sh
# real configs live only under .artifacts/ (git-ignored); never commit them
mkdir -p .artifacts
# migration config: replace account, region, profile, endpoint and artifactBucket
cp migration.config.example.json .artifacts/migration.dev.json
# dev code-deploy config: the same installation values
cp deploy.dev.config.example.json .artifacts/deploy.dev.json
```

-   Every value in the two example files is a placeholder. A placeholder config plans offline but cannot execute.
-   `migrationRepo` resolves relative to the config file. `../../eureka-deploy-api` fits a sibling checkout and a config in `.artifacts/`. From a worktree, set the absolute path of the checkout in the `.artifacts/` copy.
-   `project`, `stage`, `stack` and `migrationRevision` are fixed by the reviewed target. Another value stops with `TARGET_MISMATCH` or `REVISION_MISMATCH` (exit 2).
-   The wrapper reads neither `env/` nor `serverless.yml`. It reads the live stack.

### Runtime

The example has no `runtime` key, so the migration keeps the live runtime.
`lambda:deploy:dev` later needs both live functions on Node 24 / x86_64 (the pack targets `nodejs24.x`).
If the live dev functions are on an older runtime, add `"runtime": "nodejs24.x"` to the `.artifacts/` copy only, as an explicit, reviewed runtime change.
The offline plan prints it as `runtimeOverride`. The pinned verifier does not compare runtime, so a verified receipt does not prove runtime compatibility.

## Phases

Each command without `--execute` prints an offline plan and runs nothing. There is no all-phases command.
Run the phases in order. Read each result before the next one.

| Phase    | Execute suffix (human only)                     | Effect                                                                                                                  |
| -------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `plan`   | `--execute --allow-sensitive-backup`            | Read live resources, download the deployed ZIPs, save a private environment and before snapshot.                        |
| `retain` | `--execute`                                     | Set CloudFormation retain policies on the resources to keep (table, bucket, API).                                       |
| `remove` | `--execute --confirm-stack lemon-hello-api-dev` | Empty the Serverless deployment bucket and delete the stack. Kept resources survive. Downtime starts.                   |
| `tag`    | `--execute`                                     | Add the deploy-service management tags to the kept resources.                                                           |
| `apply`  | `--execute`                                     | Recreate functions, role, mappings, subscription and routes through the deploy service with the **old backed-up code**. |
| `verify` | `--execute`                                     | Take the after snapshot. Compare selected identities and settings, and probe HTTP.                                      |

```sh
# offline plans (no AWS, no migration command)
npm run lambda:migrate -- plan --config .artifacts/migration.dev.json
npm run lambda:migrate -- remove --config .artifacts/migration.dev.json
# execution, one phase per explicit human instruction
npm run lambda:migrate -- plan --config .artifacts/migration.dev.json --execute --allow-sensitive-backup
npm run lambda:migrate -- remove --config .artifacts/migration.dev.json --execute --confirm-stack lemon-hello-api-dev
```

-   Before any canonical command the wrapper confirms the configured account with STS on the explicit profile.
-   Run state stays in the checkout under `scripts/migrate/runs/lemon-hello-api-dev/` (`migrate-receipt.json`, `migrate-owner.json`, `migrate.lock`). It holds sensitive backups. Keep it private.
-   After `remove`, do not run `sls deploy` or `sls remove` for dev. The functions belong to the deploy service after `apply`.

## Deploy a new pack to dev

After `verify` is accepted, pack a release and deploy its code to the two dev functions (`lemon-hello-api-dev-lambda`, `lemon-hello-api-dev-backend`).

```sh
# verified ZIP into a new directory (Docker, no AWS)
npm run lambda:pack -- --output .artifacts/lambda/release-candidate
# offline plan of the dev code deploy
npm run lambda:deploy:dev -- --config .artifacts/deploy.dev.json --artifact .artifacts/lambda/release-candidate
# optional stricter gate: a completed, unaltered migration receipt
npm run lambda:deploy:dev -- --config .artifacts/deploy.dev.json --artifact .artifacts/lambda/release-candidate --migration-receipt <checkout>/scripts/migrate/runs/lemon-hello-api-dev/migrate-receipt.json
```

-   After reviewing that exact artifact and config, a human adds `--apply` to the same command.
-   `code` mode changes code only: no environment, runtime, handler, memory, timeout, IAM, route or wiring change.
-   The wrapper rejects prod, bootstrap and other projects.

## Offline check (2026-10-31, lemon-core 5.0.16)

-   `lambda:migrate` with a copy of `migration.config.example.json` (placeholders unchanged, `migrationRepo` set to a clean checkout at the pinned revision): all six phases exit 0, `execution: offline-plan`, target `lemon-hello-api-dev`, `runtimeOverride: null`. `remove` requires `--execute` and `--confirm-stack lemon-hello-api-dev`.
-   `lambda:deploy:dev` with a copy of `deploy.dev.config.example.json` and a fresh pack: exit 0, `mode: code`, `execution: offline-plan`, `handler.lambda`, steps end with `existing functions ×2 code + verification`.
-   No phase was executed and no AWS call was made. This checks local preparation only, not live permissions, resource state or a successful migration.

## Dev migration result (2026-10-31)

The owner authorized the dev migration. It ran once with lemon-core 5.0.16 and the pinned migration checkout, with `"runtime": "nodejs24.x"` in the private config. The live functions were on `nodejs18.x`, and `lambda:deploy:dev` needs Node 24.

| Phase                       | Result                                  | Time  |
| --------------------------- | --------------------------------------- | ----- |
| `plan`                      | ready, 0 warnings                       | 29 s  |
| `retain`                    | ready, 8 kept resources set to `Retain` | 34 s  |
| `remove`                    | ready, stack removed                    | 64 s  |
| `tag`                       | ready                                   | 5 s   |
| `apply`                     | ready, old code on Node 24              | 130 s |
| `verify`                    | exit 3 (`unknown`), see below           | 7 s   |
| `lambda:deploy:dev --apply` | completed, new code from `2bb6162`      | 21 s  |

-   **API downtime** was at most about 3 min 40 s, from the start of `remove` to the end of `apply`. Before and after, `GET /`, `/hello` and `/hello/0` returned 200 and an unknown path 403.
-   **Why `verify` stopped.** The verifier compares log groups including retention. The old 7-day retention was set outside the stack template by a Serverless plugin, so the plan had no value and `apply` used the deploy service default of 14 days. Both log groups therefore showed a difference. Every other row was the same: table identity and item count, queue, topic subscriptions, bucket, function code, handler, memory, timeout and environment keys, API identity, routes and stage, and the HTTP probes.
-   **Expected difference:** runtime `nodejs18.x` → `nodejs24.x`, excluded from the comparison by design.
-   **State left as is.** The private receipt is `unknown` and its lock remains, as this tool requires. Do not delete the lock or rerun a phase. `lambda:deploy:dev` was run without `--migration-receipt`.
-   **After the new code:** both functions run Node 24 / x86_64 with the new ZIP and the same 20 environment keys. The function logs had no error lines in the next 10 minutes. The API banner reports `lemon-core/5.0.16`.

## Channel settings migration (before prod)

v5 reads channel settings from one place only: the `test` record `@<channel>`, field `meta$` (`SlackChannelModel` in `src/service/slack-types.ts`, read and saved in `src/service/hello-service.ts`).
The `develop` line kept them in other records: type `channel` (`ChannelModel`, looked up by channel name) and type `target` (`TargetModel`).
v5 does not read those records, and there is no compatibility reader on purpose. Which old records matter, and their values, need the prod table and an owner decision.
lemon dev already runs v5 (2026-10-31). The open item is the existing prod table before prod moves to v5.

What still works without a migration:

-   **Endpoint fallback.** `SlackService.default()` uses config `SLACK_<CHANNEL>` when `@<channel>` has no `endpoint`, and every send has `public` as its parent. Keeping `SLACK_<CH>` in the stage's env file keeps delivery going. The env values are the owner's.
-   **Not covered by the fallback:** `rules`, `useS3`, `stereo` and `token`. Routing rules of an old `channel` record are lost until `@<ch>` is saved.
-   **Encrypted env values.** The old code KMS-decrypted any `SLACK_*` value that did not start with `http`. lemon-core v5 config decrypts only values that start with `*`. Check the form of the prod values before relying on the fallback.

Steps (human, per channel, `public` first):

1. Read the old `channel` record of the channel from the prod table (fields in the table below). Do not paste values into code, docs, logs or PRs.
2. Save it as `@<ch>`: `POST /hello/{ch}/channel` (`aws_iam`, README "HTTP 라우트" table) with `endpoint`, `rules`, and `name`/`channel`/`useS3`/`stereo` if set. The write is a merge, so `rules` can come later. `endpoint` must be an allowed host (`hooks.slack.com`, `CHANNEL_ENDPOINT_HOSTS`, or the host already stored for that channel while the env is unset). A save without `endpoint` stores the current `SLACK_<CH>` fallback endpoint as well.
3. Check with `GET /hello/{ch}/channel`: the response is masked (`endpoint` first 12 chars, `token` last 4). Compare `rules` with the old record.
4. Remove `SLACK_<CH>` from the env file only after every channel that uses it reads back from `@<ch>`.

Schema map (old `develop` → v5 `@<ch>.meta$`):

| Old (`develop`)                            | v5                                                             | Note                                                                                  |
| ------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `channel` record `id`                      | record id `@<ch>`                                              | `meta$.id` is not set by `POST`                                                       |
| `ChannelModel.channel`                     | `meta$.channel`                                                | same meaning (slack channel to redirect to)                                           |
| `ChannelModel.name`                        | `meta$.name`                                                   |                                                                                       |
| `ChannelModel.endpoint`                    | `meta$.endpoint`                                               | allow-list on write                                                                   |
| `ChannelModel.rules[]` (`RouteRule`)       | `meta$.rules[]` (`RouteRule`)                                  | `pattern`, `copyTo`, `moveTo`, `color` kept; `pattern` 200 chars max and must compile |
| `RouteRule.forward` (id of a `target`)     | not saved by `POST`                                            | used for routing in neither version                                                   |
| `ChannelModel.useS3` (number)              | `meta$.useS3` (boolean)                                        | `POST` turns it into a boolean                                                        |
| `Model.stereo` (any string)                | `meta$.stereo`                                                 | `''`, `slack` or `chatic` only                                                        |
| (none)                                     | `meta$.token`                                                  | new, for `chatic` channels                                                            |
| `target` record (`TargetModel`, `id` only) | (none)                                                         | nothing to migrate                                                                    |
| env `SLACK_<CH>`, then `SLACK_PUBLIC`      | config `SLACK_<CH>`, then `@public` / `SLACK_PUBLIC` as parent | see the fallback above                                                                |
