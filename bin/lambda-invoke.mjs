#!/usr/bin/env node
/**
 * `bin/lambda-invoke.mjs`
 * - invoke the deployed Lambda (`<service>-<stage>-<function>`) with a generated test event.
 * - usage: `npm run lambda:invoke -- --stage dev --profile <name> --path /hello/0`
 */
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
    parseArgs,
    resolveAws,
    functionName,
    printHelp,
    fail,
    checkStage,
    tryServiceName,
    parseMaxBytes,
    outputFilter,
    maskHeaders,
    resolveIdentity,
    HarnessError,
    DEFAULT_REGION,
} from './lib/common.mjs';
import { webEvent, readValue, checkWebOptions, eventLabel } from './lib/event.mjs';
import { createClient, invokeLambda } from './lib/invoke.mjs';

// help text for `--help`.
const HELP = [
    'Invoke the deployed Lambda with a generated event.',
    '',
    'usage: node bin/lambda-invoke.mjs [options]',
    '       npm run lambda:invoke -- [options]',
    '',
    'target:',
    '  --stage <stage>         deploy stage (default: dev)',
    '  --confirm-stage <stage> required for any stage other than dev (same value as the stage)',
    '  --function, --fn <fn>   lambda | backend (default: lambda)',
    '  --name <name>           full function name (overrides <service>-<stage>-<fn>)',
    `  --region <region>       AWS region (default: $AWS_REGION or ${DEFAULT_REGION})`,
    '  --profile <name>        named profile from ~/.aws (default: SDK default chain; AWS_PROFILE also works)',
    '',
    'event:',
    '  --event <kind>          web | cron | sns | sqs | raw (default: web)',
    '  --method <METHOD>       HTTP method for web (default: GET)',
    '  --path <path>           HTTP path for web (default: /); `?a=1` is moved into the query',
    '  --query k=v             query parameter for web (repeatable)',
    '  --header k:v            header for web (repeatable)',
    '  --internal              web: no Host header, like a direct invoke (lemon-core treats it as internal)',
    '  --identity <json>       web: x-lemon-identity header, sent verbatim (honoured on internal calls only)',
    '  --body <json>|@file     body for web, SNS Message, or SQS body',
    '  --subject <text>        SNS Subject (default: lambda-invoke)',
    '  --cron-name <name>      cron.name for cron (default: 1MIN)',
    '  --file <event.json>|-   event JSON for raw (`-` reads stdin)',
    '',
    'run:',
    '  --dry                   print the target and event JSON, do not call AWS',
    '  --tail                  request the last 4 KB of the log and print it',
    '  --async                 InvocationType=Event (no payload returned)',
    '  --json                  print the raw response payload only',
    '  --raw                   do not redact the output (control stripping and the size cap stay)',
    '  --max-bytes <n>         cap for one printed body / log (default: 65536; 0 = no cap)',
    '  --help                  show this help',
    '',
    'exit codes: 0 = StatusCode 2xx and no FunctionError, 1 = otherwise, 2 = bad arguments.',
];

// flags that never take a value.
const BOOLEANS = ['internal', 'dry', 'tail', 'async', 'json', 'raw', 'help'];

// every accepted option (aliases resolve to these).
const KNOWN = [
    'stage',
    'confirm-stage',
    'function',
    'name',
    'region',
    'profile',
    'event',
    'method',
    'path',
    'query',
    'header',
    'identity',
    'body',
    'subject',
    'cron-name',
    'file',
    'max-bytes',
    ...BOOLEANS,
];

// output filter for this run (redacting by default until the options are parsed).
let out = outputFilter();

// CloudWatch schedule input (same shape as `input:` in serverless.yml).
const cronEvent = (opts, stage) => ({ cron: { name: opts['cron-name'] || '1MIN', stage } });

// SNS event with one record (no ARNs).
const snsEvent = opts => ({
    Records: [
        {
            EventSource: 'aws:sns',
            EventVersion: '1.0',
            EventSubscriptionArn: '',
            Sns: {
                Type: 'Notification',
                MessageId: randomUUID(),
                TopicArn: '',
                Subject: opts.subject || 'lambda-invoke',
                Message: readValue(opts.body) ?? '{}',
                Timestamp: new Date().toISOString(),
                MessageAttributes: {},
            },
        },
    ],
});

// SQS event with one record (no ARNs).
const sqsEvent = (opts, stage, region) => ({
    Records: [
        {
            eventSource: 'aws:sqs',
            messageId: randomUUID(),
            receiptHandle: '',
            body: readValue(opts.body) ?? '{}',
            attributes: { ApproximateReceiveCount: '1', SentTimestamp: `${Date.now()}` },
            messageAttributes: {},
            eventSourceARN: '',
            awsRegion: region,
        },
    ],
});

// raw event JSON from `--file` (or stdin with `--file -`).
const rawEvent = opts => {
    if (typeof opts.file !== 'string') fail('--event raw needs --file <event.json> (or --file - for stdin)', 2);
    let text = '';
    try {
        text = readFileSync(opts.file === '-' ? 0 : opts.file, 'utf8');
    } catch (e) {
        fail(`cannot read ${opts.file}: ${e.message}`, 2);
    }
    try {
        return JSON.parse(text);
    } catch (e) {
        return fail(`invalid JSON in ${opts.file}: ${e.message}`, 2);
    }
};

// event builders by kind.
const BUILDERS = { web: webEvent, cron: cronEvent, sns: snsEvent, sqs: sqsEvent, raw: rawEvent };

// parse a JSON text, or return undefined.
const tryJson = text => {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
};

// print a body: pretty JSON when it parses, else text; redacted, then the printed text is capped once.
const printBody = body => {
    const parsed = typeof body === 'string' ? tryJson(body) : undefined;
    if (parsed !== undefined) return console.log(out.cap(JSON.stringify(out.json(parsed, { cap: false }), null, 2)));
    console.log(out.text(body ?? ''));
};

// print the payload; for web responses print `http <code>` and the (pretty) body.
const printPayload = (kind, text) => {
    const payload = text ? tryJson(text) ?? null : null;
    // non-JSON or empty payload: print as text.
    if (payload === null) return text && console.log(out.text(text));
    if (kind === 'web' && payload && typeof payload === 'object' && 'statusCode' in payload) {
        console.log(`http ${payload.statusCode}`);
        return printBody(payload.body);
    }
    console.log(out.cap(JSON.stringify(out.json(payload, { cap: false }), null, 2)));
};

// print the raw payload for `--json`: string leaves redacted and capped, structure kept.
const printJson = text => {
    const payload = tryJson(text);
    console.log(payload === undefined ? out.text(text) : JSON.stringify(out.json(payload)));
};

// entry point.
const main = async () => {
    const opts = parseArgs(process.argv.slice(2), {
        booleans: BOOLEANS,
        aliases: { fn: 'function' },
        known: KNOWN,
        maxPositional: 0,
    });
    if (opts.help) return printHelp(HELP);
    out = outputFilter({ raw: !!opts.raw, maxBytes: parseMaxBytes(opts['max-bytes']) });
    const kind = `${opts.event || 'web'}`;
    if (!BUILDERS[kind]) fail(`--event must be one of ${Object.keys(BUILDERS).join('|')} (got: ${kind})`, 2);
    // web-only options (`--internal`, `--identity`): errors exit 2, warnings go to stderr.
    for (const w of checkWebOptions(kind, opts)) console.error(w);
    // stage guard before anything else touches the target.
    const hasName = typeof opts.name === 'string' && opts.name;
    checkStage({
        stage: opts.stage,
        confirm: opts['confirm-stage'],
        name: hasName ? opts.name : undefined,
        service: hasName ? tryServiceName() : null,
    });
    const stage = typeof opts.stage === 'string' && opts.stage ? opts.stage : 'dev';
    const aws = resolveAws(opts);
    const name = functionName(opts);
    const event = BUILDERS[kind](opts, stage, aws.region);
    const route = kind === 'web' ? ` ${event.httpMethod} ${event.path}` : '';
    const label = eventLabel(kind, opts);

    // --dry: show the target and event (sensitive headers masked), never call AWS.
    if (opts.dry) {
        console.log(`invoke ${name} event=${label}${route} region=${aws.region} (dry)`);
        console.log(JSON.stringify(maskHeaders(event), null, 2));
        return;
    }
    if (opts.tail && opts.async) console.error('WARN: --tail is ignored with --async');

    // identity banner first; an STS failure stops before Lambda is called.
    console.error(await resolveIdentity(aws, opts, name));

    // the call itself is shared with `perf-lambda.mjs` (`lib/invoke.mjs`).
    const resp = await invokeLambda(createClient(aws), { name, event, async: !!opts.async, tail: !!opts.tail });
    const { text, took } = resp;
    const ok = resp.statusCode >= 200 && resp.statusCode < 300 && !resp.functionError;

    // --json: raw payload only (redacted string values).
    if (opts.json) {
        if (text) printJson(text);
    } else {
        console.log(`invoke ${name} event=${label}${route}`);
        console.log(`status=${resp.statusCode} function-error=${resp.functionError || 'none'} took=${took}ms`);
        printPayload(kind, text);
        // decoded log tail (base64 in LogResult), control-stripped and redacted.
        if (resp.logResult) {
            console.log('--- log tail ---');
            console.log(out.log(Buffer.from(resp.logResult, 'base64').toString('utf8').replace(/\n+$/, '')));
        }
    }
    process.exitCode = ok ? 0 : 1;
};

// run; harness errors keep their exit code, SDK errors are redacted and exit 1 (no stack trace).
main().catch(e => {
    if (e instanceof HarnessError) return fail(e.message, e.code);
    fail(out.log(`${e.name || 'Error'}: ${e.message}`), 1);
});
