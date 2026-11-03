/**
 * `protocol-guard.spec.ts`
 * - hello drops protocol messages (`x-protocol-service`) on SNS/SQS outside local mode. (H-2)
 * - no AWS, no network: `handleProtocol()` and `execute()` are spies.
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2026-10-30 initial version (security review H-2)
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved. (https://eureka.codes)
 */
import $cores, { expect2, LambdaHandler, LambdaSNSHandler, LambdaSQSHandler } from 'lemon-core';
import { guardProtocol, isGuarded, isProtocolRecord, PROTOCOL_SUBJECT } from './protocol-guard';
import { $sns as $engineSns, $sqs as $engineSqs } from '../engine';

//* one SNS record; `callback` attribute like a protocol caller sets it.
const snsEvent = (Subject: string, message: any, callback?: string) => ({
    Records: [
        {
            EventSource: 'aws:sns',
            EventVersion: '1.0',
            EventSubscriptionArn: '',
            Sns: {
                Type: 'Notification',
                MessageId: 'm-0001',
                TopicArn: '',
                Subject,
                Message: typeof message === 'string' ? message : JSON.stringify(message),
                Timestamp: '2026-10-30T00:00:00.000Z',
                MessageAttributes: callback ? { callback: { Type: 'String', Value: callback } } : {},
            },
        },
    ],
});

//* one SQS record; the protocol subject is a message attribute.
const sqsEvent = (subject: string, body: any) => ({
    Records: [
        {
            messageId: 'q-0001',
            receiptHandle: 'r',
            body: JSON.stringify(body),
            attributes: {},
            messageAttributes: subject ? { Subject: { dataType: 'String', stringValue: subject } } : {},
            md5OfBody: '',
            eventSource: 'aws:sqs',
            eventSourceARN: '',
            awsRegion: 'ap-northeast-2',
        },
    ],
});

//* a protocol message to `hello` with a callback to another service.
const PROTOCOL_MESSAGE = { service: 'lemon-hello-api', type: 'hello', mode: 'GET', id: '0', context: {} };
const CALLBACK = 'api://other-admin-api/admin/0/run';

//* build our own lambda + sns/sqs handlers (not the engine ones), with spies on the protocol path.
const instance = () => {
    const lambda = new LambdaHandler();
    const $sns = new LambdaSNSHandler(lambda, true);
    const $sqs = new LambdaSQSHandler(lambda, true);
    const listened: string[] = [];
    $sns.addListener(async (id, param) => listened.push(`sns:${param?.subject ?? ''}`) && 'ok');
    $sqs.addListener(async () => listened.push('sqs') && 'ok');
    const handleProtocol = jest.spyOn(lambda, 'handleProtocol').mockImplementation(async () => ({ ok: 1 }));
    const execute = jest.spyOn($cores.cores.protocol.service, 'execute').mockImplementation(async () => ({}));
    return { lambda, $sns, $sqs, listened, handleProtocol, execute };
};

describe('protocol-guard (H-2)', () => {
    const $org = { mode: process.env.LOCAL_MODE, fn: process.env.AWS_LAMBDA_FUNCTION_NAME };
    const $rep = [LambdaHandler.REPORT_ERROR, LambdaSNSHandler.REPORT_ERROR, LambdaSQSHandler.REPORT_ERROR];
    //* Lambda mode: not local. never publish a report while testing.
    beforeEach(() => {
        delete process.env.LOCAL_MODE;
        process.env.AWS_LAMBDA_FUNCTION_NAME = 'lemon-hello-api-dev-backend';
        LambdaHandler.REPORT_ERROR = LambdaSNSHandler.REPORT_ERROR = LambdaSQSHandler.REPORT_ERROR = false;
    });
    //* restore the env and spies.
    afterEach(() => {
        jest.restoreAllMocks();
        if ($org.mode === undefined) delete process.env.LOCAL_MODE;
        else process.env.LOCAL_MODE = $org.mode;
        if ($org.fn === undefined) delete process.env.AWS_LAMBDA_FUNCTION_NAME;
        else process.env.AWS_LAMBDA_FUNCTION_NAME = $org.fn;
        [LambdaHandler.REPORT_ERROR, LambdaSNSHandler.REPORT_ERROR, LambdaSQSHandler.REPORT_ERROR] = $rep;
    });

    it('detects protocol records of SNS and SQS', async () => {
        expect2(() => PROTOCOL_SUBJECT).toEqual('x-protocol-service');
        expect2(() => isProtocolRecord(snsEvent(PROTOCOL_SUBJECT, {}).Records[0])).toEqual(true);
        expect2(() => isProtocolRecord(snsEvent('error', {}).Records[0])).toEqual(false);
        expect2(() => isProtocolRecord(sqsEvent(PROTOCOL_SUBJECT, {}).Records[0])).toEqual(true);
        expect2(() => isProtocolRecord(sqsEvent('', {}).Records[0])).toEqual(false);
        expect2(() => isProtocolRecord(null)).toEqual(false);
    });

    it('(control) w/o the guard, a protocol SNS record reaches `handleProtocol()` and `execute(callback)`', async () => {
        const { lambda, handleProtocol, execute } = instance();
        await lambda.handle(snsEvent(PROTOCOL_SUBJECT, PROTOCOL_MESSAGE, CALLBACK) as any, null);
        expect2(() => handleProtocol.mock.calls.length).toEqual(1);
        expect2(() => execute.mock.calls.length).toEqual(1);
    });

    it('drops a protocol SNS record w/ `callback` (no handler, no execute), a normal `error` still routes', async () => {
        const { lambda, $sns, listened, handleProtocol, execute } = instance();
        guardProtocol($sns, 'sns');
        expect2(await lambda.handle(snsEvent(PROTOCOL_SUBJECT, PROTOCOL_MESSAGE, CALLBACK) as any, null)).toEqual(
            undefined,
        );
        expect2(() => handleProtocol.mock.calls.length).toEqual(0);
        expect2(() => execute.mock.calls.length).toEqual(0);
        expect2(() => listened).toEqual([]);

        //* a normal subject goes to the listeners.
        await lambda.handle(snsEvent('error', { message: 'hi' }) as any, null);
        expect2(() => listened).toEqual(['sns:error']);
        expect2(() => handleProtocol.mock.calls.length).toEqual(0);
    });

    it('drops a protocol SQS record w/o a batch failure (no redelivery), a normal one still routes', async () => {
        const { lambda, $sqs, listened, handleProtocol, execute } = instance();
        guardProtocol($sqs, 'sqs');
        const res = await lambda.handle(sqsEvent(PROTOCOL_SUBJECT, PROTOCOL_MESSAGE) as any, null);
        expect2(() => res).toEqual({ batchItemFailures: [] });
        expect2(() => handleProtocol.mock.calls.length).toEqual(0);
        expect2(() => execute.mock.calls.length).toEqual(0);
        expect2(() => listened).toEqual([]);

        //* a normal record goes to the listeners.
        expect2(await lambda.handle(sqsEvent('', { a: 1 }) as any, null)).toEqual({ batchItemFailures: [] });
        expect2(() => listened).toEqual(['sqs']);
    });

    it('keeps protocol records in local mode (local transport self-test)', async () => {
        const { lambda, $sns, handleProtocol } = instance();
        guardProtocol($sns, 'sns');
        process.env.LOCAL_MODE = '1';
        delete process.env.AWS_LAMBDA_FUNCTION_NAME;
        await lambda.handle(snsEvent(PROTOCOL_SUBJECT, PROTOCOL_MESSAGE) as any, null);
        expect2(() => handleProtocol.mock.calls.length).toEqual(1);
    });

    it('is applied to the engine SNS and SQS handlers', async () => {
        expect2(() => [isGuarded($engineSns), isGuarded($engineSqs)]).toEqual([true, true]);
    });

    it('wraps a handler only once', async () => {
        const { $sns } = instance();
        const once = guardProtocol($sns, 'sns').handle;
        expect2(() => guardProtocol($sns, 'sns').handle === once).toEqual(true);
    });
});
