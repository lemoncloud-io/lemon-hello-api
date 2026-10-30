# bin/ — invoke the deployed Lambda, watch its logs, and measure cold / warm timings

Small Node scripts for test-env and prod verification after `sls deploy`.
They call AWS directly with the SDK (no `sls`), so they work on any machine with AWS credentials.
Copied from the lemon-templates-api v5 harness (`fields-admin` and `loop-check` are not here: this service has no model CRUD route with `fields/admin` and no loop-test route).

- `lambda-invoke.mjs` — invoke the deployed function with a generated event (web, cron, SNS, SQS, or a raw JSON file).
- `lambda-logs.mjs` — print or follow the function's CloudWatch logs (polling `FilterLogEvents`).
- `perf-lambda.mjs` — invoke the deployed function several times and summarize cold / warm timings from the log tail, or from the full CloudWatch log with `--logs`. See [perf:lambda](#perflambda).

The Lambda call itself (`lambda:Invoke`) is shared in `lib/invoke.mjs` by `lambda-invoke.mjs` and `perf-lambda.mjs`.
The paged `FilterLogEvents` read is shared in `lib/logs.mjs` by `lambda-logs.mjs` and `perf-lambda.mjs --logs`.

The target function name is `<service>-<stage>-<function>` (Serverless default).
`service` is read from the `service:` line of `serverless.yml` (`lemon-hello-api`).
The two functions are `lambda` (http) and `backend` (SNS error reports, SQS, DynamoDB stream).
The log group is `/aws/lambda/<function name>`.

Nothing here reads `env/*.yml`, `env/config.js`, or the `custom:` / `environment:` blocks of `serverless.yml`.
`bin/` is not packaged into the Lambda zip (`package.include` lists only `handler.js`, `package.json`, `dist/**`, `data/**`).

## Accounts

This service is deployed per AWS account (`package.json` scripts `*.ssocio`, `*.muzly`, `*.epyt`, and the default profile).
Pick the account with `--profile <name>` and check the identity line (account last 4 digits) before you read anything.
Stages per account follow the `package.json` scripts: `ssocio` has `prod` only; `muzly` and `epyt` have `dev` and `prod` (`info.epyt` and `logs.epyt` read `prod`). A `prod` target needs `--stage prod --confirm-stage prod`, and only on an explicit human instruction.

## Credentials

- `--profile <name>` uses that named profile from `~/.aws`.
- Without `--profile`, the AWS SDK default chain applies: `AWS_PROFILE`, `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, SSO, instance role.
- Region: `--region`, else `AWS_REGION`, else `ap-northeast-2`.

## lambda:invoke

```sh
npm run lambda:invoke -- [options]
```

| Option | Default | Meaning |
|---|---|---|
| `--stage <stage>` | `dev` | Deploy stage. Any stage other than `dev` needs `--confirm-stage`. |
| `--confirm-stage <stage>` | | The same value as the stage. Required for any stage other than `dev`. See [Safety](#safety). |
| `--function`, `--fn <fn>` | `lambda` | `lambda` or `backend`. |
| `--name <name>` | | Full function name. Overrides `<service>-<stage>-<fn>`. Goes through the stage guard. |
| `--region <region>` | `AWS_REGION` or `ap-northeast-2` | AWS region. |
| `--profile <name>` | SDK default chain | Named profile. |
| `--event <kind>` | `web` | `web`, `cron`, `sns`, `sqs`, or `raw`. |
| `--method <METHOD>` | `GET` | HTTP method (web). |
| `--path <path>` | `/` | HTTP path (web). A `?a=1` part goes into the query. |
| `--query k=v` | | Query parameter (web). Repeatable. |
| `--header k:v` | | Header (web). Repeatable. |
| `--internal` | | Web only. Send no `Host` header (removed from `headers` and `multiValueHeaders`, also one given by `--header`) and no `requestContext.domainName`, like a direct `lambda:Invoke`. lemon-core then treats the call as internal. The banner shows `event=web(internal)`. With any other `--event`: exit 2. |
| `--identity <json>` | | Web only. Sets the `x-lemon-identity` header to the JSON text as given (wins over `--header x-lemon-identity:…`). lemon-core reads it on internal calls only, so without `--internal` a warning goes to stderr. Invalid JSON or another `--event`: exit 2. `--dry` prints it as `<redacted>`. |
| `--body <json>` or `--body @file.json` | | Body (web), SNS `Message`, or SQS `body`. SNS/SQS default to `{}`. |
| `--subject <text>` | `lambda-invoke` | SNS `Subject`. |
| `--cron-name <name>` | `1MIN` | `cron.name` (cron). |
| `--file <event.json>` or `--file -` | | Event JSON (raw). `-` reads stdin. |
| `--dry` | | Print the target and the event JSON. Do not call AWS (no STS call either). Sensitive header values print as `<redacted>`. |
| `--tail` | | Request the log tail (last 4 KB) and print it after the response. |
| `--async` | | `InvocationType=Event`. No payload comes back. |
| `--json` | | Print the raw response payload only. String values are redacted; the JSON structure is kept. |
| `--raw` | | Do not redact the output. Control stripping and the size cap stay. |
| `--max-bytes <n>` | `65536` | Cap for one printed body or log tail. `0` means no cap. |
| `--help` | | Show help. |

Web events are API Gateway REST (v1) proxy events.
`resource` and `pathParameters` follow the `/{type}/{id}/{cmd}` routes of `serverless.yml`:
`/hello/0` becomes `resource=/hello/{id}`, `pathParameters={ id: '0' }`.
Default headers are `Host: localhost`, `Accept: application/json`, `User-Agent: lambda-invoke`, and `Content-Type: application/json` when a body is given.
The `Host` header makes the call look like an external API Gateway request; `--internal` removes it.
`--header` overrides any default.

Examples:

```sh
# web GET /hello/0 with the log tail
npm run lambda:invoke -- --stage dev --profile <name> --path /hello/0 --tail

# internal web call (no Host header, like a direct invoke); the channel view stays masked (unmasked only in local mode)
npm run lambda:invoke -- --stage dev --internal --path /hello/public/channel

# web POST with a JSON body, a query and a header
npm run lambda:invoke -- --stage dev --profile <name> --method POST --path /hello/0/echo --body '{"x":1}' --query a=1 --header x-test:1

# SNS error report into the backend function (the same path as a lemon-core `doReportError()`); this sends to the real channels
npm run lambda:invoke -- --stage dev --profile <name> --fn backend --event sns --subject error --body @sample/error-1.json --dry

# SNS slack message into the backend function
npm run lambda:invoke -- --stage dev --profile <name> --fn backend --event sns --subject slack --body @sample/slack-1.json --dry

# any event from a file (check it first with --dry)
npm run lambda:invoke -- --stage dev --profile <name> --event raw --file event.json --dry
```

Before the call, one identity line goes to stderr (see [Safety](#safety)).
Output: a header line `invoke <name> event=<kind> [<METHOD> <path>]` (`event=web(internal)` with `--internal`), then `status=<StatusCode> function-error=<FunctionError|none> took=<ms>ms`.
For web events with a `statusCode` in the payload, it prints `http <statusCode>` and the body (pretty JSON when it parses).
For other events it prints the payload.
With `--tail`, the decoded log follows a `--- log tail ---` line.
Everything printed from AWS is redacted and capped (see [Safety](#safety)).

## lambda:logs

```sh
npm run lambda:logs -- [options]
```

| Option | Default | Meaning |
|---|---|---|
| `--stage`, `--confirm-stage`, `--function`/`--fn`, `--name`, `--region`, `--profile` | | Same as `lambda:invoke`. |
| `--group <log-group>` | `/aws/lambda/<name>` | Log group override. Goes through the stage guard by the function name in `/aws/lambda/<name>`. |
| `--since <t>` | `5m` | `30s`, `5m`, `2h`, `1d`, or an ISO date. |
| `--follow`, `-f` | | Keep polling until Ctrl-C. |
| `--interval <sec>` | `2` | Poll interval with `--follow`. |
| `--filter <pattern>` | | CloudWatch filter pattern (server side). |
| `--grep <regex>` | | Case-insensitive regex on the message (client side). |
| `--perf` | | Shortcut for `--grep 'PERF:'`. |
| `--json` | | One JSON object per line: `{ ts, stream, message }`. |
| `--raw` | | Do not redact messages. Control stripping and the size cap stay. |
| `--max-bytes <n>` | `65536` | Cap for one message. `0` means no cap. |
| `--help` | | Show help. |

Each line is `YYYY-MM-DD HH:mm:ss.SSS  <last 8 chars of the stream>  <message>` in local time.
The identity line and a header line `logs <group> since=<iso> follow=<bool>` go to stderr.
Each message is control-stripped, redacted, and capped (see [Safety](#safety)).
In follow mode each poll re-scans the last 10 seconds and skips event ids it has already printed, so late events from other streams are not lost.

Examples:

```sh
# last 30 minutes
npm run lambda:logs -- --stage dev --profile <name> --since 30m

# follow, PERF lines only
npm run lambda:logs -- --stage dev --profile <name> --follow --perf

# server-side filter on the backend function
npm run lambda:logs -- --stage dev --profile <name> --fn backend --since 1h --filter '"ERROR"'

# machine-readable, since a fixed time
npm run lambda:logs -- --stage prod --confirm-stage prod --profile <name> --since 2026-10-28T09:00:00+09:00 --json
```

## perf:lambda

```sh
npm run perf:lambda -- [options]
```

Invokes the deployed function `--runs` times with a web event and the log tail (`LogType=Tail`, like `lambda:invoke --tail`).
Each tail is parsed for the Lambda `REPORT` line and the lemon-core `PERF: >` lines, and the runs are summarized per phase (cold / warm).
With `--logs`, each run also reads its full CloudWatch log by request id and parses that instead of the 4 KB tail (see [Full log](#full-log---logs)).

| Option | Default | Meaning |
|---|---|---|
| `--stage`, `--confirm-stage`, `--function`/`--fn`, `--name`, `--region`, `--profile` | | Same as `lambda:invoke`, with the same stage guard and identity line. |
| `--path <path>` | `/hello/0` | HTTP path. A `?a=1` part goes into the query. |
| `--method <METHOD>` | `GET` | HTTP method. |
| `--query k=v`, `--header k:v` | | Same as `lambda:invoke`. Repeatable. |
| `--internal` | | Same as `lambda:invoke`: no `Host` header. The banner shows `event=web(internal)`. |
| `--runs <n>` | `5` | Number of invokes, one after another. `1`–`100`, else exit 2. |
| `--interval <ms>` | `0` | Pause between invokes. `0`–`60000`, else exit 2. |
| `--logs` | | After each invoke, read the full CloudWatch log of that request (by request id) and parse it instead of the tail. Needs `logs:FilterLogEvents`. See [Full log](#full-log---logs). |
| `--logs-wait <ms>` | `20000` | Longest wait per run for the request's `REPORT` line to arrive in CloudWatch. `1000`–`120000`, else exit 2 (checked with or without `--logs`). |
| `--dry` | | Print the target, the runs, and the event JSON of the first run. Do not call AWS (no STS call either). With `--logs`, no log is read either. |
| `--json` | | Print `{ target: { name, stage, fn, path, method, runs, logs }, runs: [...], summary }` only. String values are redacted; the structure is kept. With `--logs`, each run has `logs: { complete, events, took[, error] }` and `summary` has `logs: { n, complete, wait }`. |
| `--raw`, `--max-bytes <n>` | | Same as `lambda:invoke`. |
| `--help` | | Show help. |

Each run sends a fresh event (new `requestId`). `--event`, `--body`, `--identity`, `--tail`, and `--async` are not accepted (exit 2).

### What is parsed

| Source line | Fields |
|---|---|
| `REPORT RequestId: …` | `Duration` → `duration`, `Billed Duration` → `billed`, `Memory Size` → `memSize`, `Max Memory Used` → `memUsed`, `Init Duration` → `init` (cold only) |
| `PERF: > loaded lemon-core <ms> ms` | `loadedLemonCore` (lemon-core module loaded) |
| `PERF: > loaded engine <ms> ms` | `loadedEngine` (`src/engine.ts` with every controller loaded) |
| `PERF: > initialize <ms> ms` | `initialize` (lemon-core engine initialized) |
| `PERF: > handle <ms> ms type=<t> cold=<0\|1>` | `handle` |
| `PERF: > request <ms> ms mode=… type=… [cmd=…] status=… context=… param=… handler=… response=… cold=<0\|1>` | `request` and its parts |

The CloudWatch prefix (timestamp, request id, level) and ANSI color codes are ignored. If a kind appears more than once in one tail, the last line wins.
`loaded …` and `initialize` are process times (`process.uptime()`), printed once per container. The other values are durations.
The `loaded engine` line comes from `src/engine.ts` (last line); like every engine log line, it is silent with `LS=1`.
Other lines (`START`, `END`, `INIT_START`, `INIT_REPORT`, app lines) are skipped, so the same parser reads a tail or a full log.

### Full log (`--logs`)

The 4 KB tail often loses the early lines of a cold run. `--logs` reads the whole log of each request instead:

1. The request id comes from the invoke response (`x-amzn-RequestId`, the same id as the function's `awsRequestId`). If it is missing, it is read from the `END RequestId:` line of the tail.
2. `FilterLogEvents` on `/aws/lambda/<name>` with the filter `"<request id>"`, from 60 seconds before the invoke. This returns the `START`, app, `END`, and `REPORT` lines of that request. CloudWatch gets them a few seconds after the invoke, so the query repeats every second until the `REPORT` line is there or `--logs-wait` has passed.
3. Cold run only (`Init Duration` in `REPORT`): the `loaded lemon-core` and `loaded engine` lines are printed in the INIT phase, before `START`, and carry no request id. A second query reads them from the same log stream with the filter `"PERF:" "loaded"` (two terms — the INIT lines carry ANSI color codes, so a one-phrase filter does not match), up to the `START` line. They go in front of the request lines.
4. The joined text goes through the same parser as the tail.

If the `REPORT` line did not arrive in time (`complete=false`), each item missing from the log is taken from the tail of the same run; items found in the log win.
If the Logs call fails (for example no `logs:FilterLogEvents` permission), a `WARN:` line with the error name goes to stderr and that run uses its tail only. The run itself does not fail.

### Output

The identity line goes to stderr first (see [Safety](#safety)). Then:

```text
perf <name> event=web GET /hello/0 runs=5 logs=false
run  phase  http  error  took  duration  billed    init  loadedCore  loadedEngine  initialize  handle  request  handler  memUsed
#1   cold    200      -  1100   1037.05    1556  518.53         n/a           n/a       998.9    12.3      4.2      2.6      117
#2   warm    200      -    40      4.42       5     n/a         n/a           n/a         n/a     3.1      1.6      1.1      118
#3   warm    200      -    30       3.2       4     n/a         n/a           n/a         n/a     2.9      1.4      1.1      118
#4   warm    200      -    50      6.75       7     n/a         n/a           n/a         n/a       5      2.8      1.1      118
#5   warm    200      -    36       3.9       4     n/a         n/a           n/a         n/a     n/a      n/a      n/a      118
--- summary (ms; memUsed in MB) ---
runs=5 cold=1 warm=4
metric           cold.n   median      p95      max  warm.n  median   p95   max
took                  1     1100     1100     1100       4      38    50    50
duration              1  1037.05  1037.05  1037.05       4    4.16  6.75  6.75
billed                1     1556     1556     1556       4     4.5     7     7
init                  1   518.53   518.53   518.53       0     n/a   n/a   n/a
loadedLemonCore       0      n/a      n/a      n/a       0     n/a   n/a   n/a
loadedEngine          0      n/a      n/a      n/a       0     n/a   n/a   n/a
initialize            1    998.9    998.9    998.9       0     n/a   n/a   n/a
handle                1     12.3     12.3     12.3       3     3.1     5     5
request               1      4.2      4.2      4.2       3     1.6   2.8   2.8
context               1      0.8      0.8      0.8       3     0.2   0.2   0.2
param                 1      0.3      0.3      0.3       3     0.1   0.1   0.1
handler               1      2.6      2.6      2.6       3     1.1   1.1   1.1
response              1      0.1      0.1      0.1       3     0.1   0.1   0.1
memUsed               1      117      117      117       4     118   118   118
```

Run #1 above lost its `loaded …` lines to the 4 KB cut, and run #5 has only its `REPORT` line in the tail (no `PERF` lines). Those `PERF` columns are `n/a`, and the runs drop out of those summary rows.
The run table shows `loaded lemon-core` as `loadedCore`.
The summary has one row per metric (`took`, `duration`, `billed`, `init`, `loadedLemonCore`, `loadedEngine`, `initialize`, `handle`, `request`, `context`, `param`, `handler`, `response`, `memUsed`) with `n`, median, p95, and max for each phase.
`took` is the client-side round trip of the invoke. `context`, `param`, `handler`, and `response` are the parts of `request`.
`n` counts only the runs that have the value; a metric with no value prints `n/a`.
The median of an even count is the mean of the two middle values. p95 uses the nearest-rank method (`ceil(0.95 × n)`-th smallest value).
The tables are redacted and capped like the other scripts.

With `--logs`, the same runs read from the full log, and one more line follows the summary: how many runs got their `REPORT` line in time, and the median wait for the log.

```text
perf <name> event=web GET /hello/0 runs=5 logs=true
run  phase  http  error  took  duration  billed    init  loadedCore  loadedEngine  initialize  handle  request  handler  memUsed
#1   cold    200      -  1100   1037.05    1556  518.53       420.5         980.2       998.9    12.3      4.2      2.6      117
#2   warm    200      -    40      4.42       5     n/a         n/a           n/a         n/a     3.1      1.6      1.1      118
#3   warm    200      -    30       3.2       4     n/a         n/a           n/a         n/a     2.9      1.4      1.1      118
#4   warm    200      -    50      6.75       7     n/a         n/a           n/a         n/a       5      2.8      1.1      118
#5   warm    200      -    36       3.9       4     n/a         n/a           n/a         n/a       3      1.5      1.1      118
--- summary (ms; memUsed in MB) ---
runs=5 cold=1 warm=4
metric           cold.n   median      p95      max  warm.n  median   p95   max
took                  1     1100     1100     1100       4      38    50    50
duration              1  1037.05  1037.05  1037.05       4    4.16  6.75  6.75
billed                1     1556     1556     1556       4     4.5     7     7
init                  1   518.53   518.53   518.53       0     n/a   n/a   n/a
loadedLemonCore       1    420.5    420.5    420.5       0     n/a   n/a   n/a
loadedEngine          1    980.2    980.2    980.2       0     n/a   n/a   n/a
initialize            1    998.9    998.9    998.9       0     n/a   n/a   n/a
handle                1     12.3     12.3     12.3       4    3.05     5     5
request               1      4.2      4.2      4.2       4    1.55   2.8   2.8
context               1      0.8      0.8      0.8       4     0.2   0.2   0.2
param                 1      0.3      0.3      0.3       4     0.1   0.1   0.1
handler               1      2.6      2.6      2.6       4     1.1   1.1   1.1
response              1      0.1      0.1      0.1       4     0.1   0.1   0.1
memUsed               1      117      117      117       4     118   118   118
logs: complete=5/5 wait=2810ms
```

### Limits

- **Tail is 4 KB.** Lambda returns only the last 4 KB of the log. On a cold run with long startup logs, the early lines (`loaded lemon-core`, `loaded engine`, sometimes `initialize`) can be cut. Those runs drop out of that metric (`n` shrinks); they still count for the `REPORT` metrics. `--logs` solves this by reading the full log. The cost: CloudWatch delivers the log a few seconds late, so each run waits for it, and the caller needs `logs:FilterLogEvents` on the log group.
- **Cold detection.** A run is cold when its `REPORT` line has `Init Duration`. If the `REPORT` line has none (or is missing), the `cold=1` flag of the lemon-core `handle` / `request` line also marks it cold. Everything else is warm.
- **Forcing cold starts.** The script does not change the function. Back-to-back runs usually reuse one container, so a run of 5 is typically 1 cold + 4 warm (or 0 cold when the container was already warm).
- **Errors.** An AWS error in any run stops the script (exit 1) and prints no tables.

Examples:

```sh
# 5 runs of GET /hello/0 on dev
npm run perf:lambda -- --stage dev --profile <name>

# 20 internal runs, 1 second apart, machine-readable
npm run perf:lambda -- --stage dev --profile <name> --internal --path /hello/0 --runs 20 --interval 1000 --json

# 5 runs with the full CloudWatch log of each run (cold-start loaded lines included)
npm run perf:lambda -- --stage dev --profile <name> --logs

# show the target and the event first, no AWS call
npm run perf:lambda -- --stage dev --runs 3 --dry
```

## Safety

All scripts apply these rules (rule 7 applies to `perf:lambda --internal` too).

1. **Strict options.** An option that is not in the table above (and not an alias) stops the run: `ERROR: unknown option --foo (see --help)`, exit 2. An extra positional argument stops it the same way (`unknown argument <arg>`). `--help` still works with any other argument.
2. **Stage guard.** Only `dev` (the default) runs without confirmation. Any other stage needs `--confirm-stage <stage>` with the exact same value: `ERROR: stage "prod" needs --confirm-stage prod`, exit 2. A `--confirm-stage` that differs from the stage is also an error. `--name` (and `--group /aws/lambda/<name>` for `lambda:logs`) gives the stage when the name has the shape `<service>-<stage>-<fn>`. If the stage cannot be derived (another service, or another log group), the run needs both `--stage <stage>` and `--confirm-stage <stage>`. The guard runs before `--dry`.
3. **Identity line.** Before any invoke or log fetch, STS `GetCallerIdentity` runs and one line goes to stderr: `account=****<last4> region=<region> credentials=<profile:<name>|env|default-chain> function=<name>`. The account id shows only its last 4 digits. The ARN is never printed. If STS fails, the run prints `ERROR: cannot resolve AWS identity (<error name>)` and exits 1 before Lambda or Logs is called. `--dry` does not call STS.
4. **Redaction (on by default, `--raw` turns it off).** Everything printed from AWS is redacted: the response body, the `--json` payload, the `--tail` log, log lines, and SDK error messages. For JSON, string values are redacted one by one and the structure is kept. The rules run in this order:
   - 12-digit account ids → `<acct>`. `arn:aws…` up to a blank or a quote → `<arn>`.
   - Access key ids `AKIA…` / `ASIA…` → `<aws-key>`.
   - Values of `authorization`, `x-lemon-identity`, `x-api-key`, `cookie`, `set-cookie` (any case; `key: value`, `"key":"value"`, `key=value`) → `<redacted>`. `Bearer <token>` → `Bearer <redacted>`.
   - JWT-looking tokens (`eyJ….….…`) → `<jwt>`.
   - Values of keys whose name contains `secret`, `password`, `passwd`, `token`, `private_key`, `apikey`, `api_key`, or `access_key` (any case) → `<redacted>`.
   - IPv4 addresses → `<ip>`. URLs keep the scheme and host and lose the path and query: `https://host/<path>`. Emails → `<email>`.
   The `--tail` log and `lambda:logs` messages are also stripped of ANSI escapes and control characters (tab and newline stay). Stripping is always on, also with `--raw`.
5. **Size cap.** A printed response body, a log tail, or a single log message longer than 64 KB is cut and ends with `…[truncated N bytes]`. With `--json`, each string value is cut instead, so the JSON stays valid. `--raw` does not lift the cap. `--max-bytes <n>` sets it; `--max-bytes 0` removes it.
6. **Header echo.** `--dry` prints `<redacted>` for the values of the sensitive headers in rule 4 (`headers` and `multiValueHeaders`). Other headers print as given. The event sent to Lambda keeps the real values. This covers `--identity` (`x-lemon-identity`).
7. **Internal events.** `--internal` only changes the shape of the web event (no `Host` header). It does not bypass the stage guard or the identity line.
8. **Tests.** `npm run lambda:test` runs the offline unit tests in `bin/lib/*.test.mjs` (`node:test`). They cover rules 1, 2, 4, 5, 6, and 7, the identity line format, the web event builder (`--internal`, `--identity`), the shared invoke call, `perf:lambda` (the log-tail parser with cold, warm, failed, and cut tails, the summary statistics, the tables, the exit code, and the CLI with `--dry`, `--help`, and bad arguments), and `perf:lambda --logs` (`lib/logs.mjs` with a fake `fetch` and a fake clock). They need no AWS access and no server; the scripts run with `--dry` or `--help` only.

## Exit codes

| Code | `lambda:invoke` | `lambda:logs` |
|---|---|---|
| 0 | `StatusCode` 2xx and no `FunctionError` (also `--dry`, `--help`) | OK (also Ctrl-C in follow mode) |
| 1 | Non-2xx `StatusCode`, a `FunctionError`, an AWS error, or no AWS identity (STS) | AWS error, or no AWS identity (STS) |
| 2 | Bad arguments, an unknown option, or the stage guard | Bad arguments, an unknown option, the stage guard, or the log group does not exist |

`lambda:invoke` exit codes reflect the Lambda call only. An `http 4xx/5xx` from the web handler still exits 0; check the printed `http` line.

`perf:lambda` exit codes: 0 = every run answered `http` 2xx with no `FunctionError` (also `--dry`, `--help`); 1 = any run did not, or an AWS error, or no AWS identity (STS); 2 = bad arguments (also `--runs` outside 1–100, `--interval` outside 0–60000, or `--logs-wait` outside 1000–120000), an unknown option, or the stage guard. With `--logs`, a Logs error or a log that does not arrive in time does not change the exit code (the run falls back to its tail).
