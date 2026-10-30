/**
 * `bin/lib/invoke.mjs`
 * - one synchronous (or async) `lambda:Invoke` call, shared by `bin/lambda-invoke.mjs` and `bin/perf-lambda.mjs`.
 * - no printing and no `process.exit`; SDK errors are thrown as they are.
 */
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// Lambda client for the resolved SDK config (`resolveAws()`).
export const createClient = aws => new LambdaClient(aws);

// the request id from a decoded log tail (`END RequestId: <id>`, else `REPORT RequestId: <id>`), or null.
export const requestIdOf = logText => {
    const text = `${logText ?? ''}`;
    const m = text.match(/\bEND RequestId:\s*([\w-]+)/) || text.match(/\bREPORT RequestId:\s*([\w-]+)/);
    return m ? m[1] : null;
};

// invoke `name` with `event`; returns `{ statusCode, functionError, text, logResult, requestId, took }`.
export const invokeLambda = async (client, { name, event, async = false, tail = false }) => {
    const cmd = new InvokeCommand({
        FunctionName: name,
        InvocationType: async ? 'Event' : 'RequestResponse',
        LogType: tail && !async ? 'Tail' : 'None',
        Payload: Buffer.from(JSON.stringify(event)),
    });
    const t0 = Date.now();
    const resp = await client.send(cmd);
    const took = Date.now() - t0;
    // payload bytes as text ('' when none, e.g. async).
    const text = resp.Payload ? new TextDecoder().decode(resp.Payload) : '';
    // request id: the `x-amzn-RequestId` of the call (= the function's awsRequestId), else from the log tail.
    const tailText = resp.LogResult ? Buffer.from(resp.LogResult, 'base64').toString('utf8') : '';
    const requestId = resp.$metadata?.requestId || requestIdOf(tailText) || null;
    return {
        statusCode: resp.StatusCode,
        functionError: resp.FunctionError,
        text,
        logResult: resp.LogResult,
        requestId,
        took,
    };
};
