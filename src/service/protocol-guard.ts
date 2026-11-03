/**
 * `protocol-guard.ts`
 * - hello takes no protocol message (`Subject: x-protocol-service`) on SNS/SQS outside local mode. (H-2)
 * - why: the `callback` attribute of a protocol message makes lemon-core call `execute()` on any service
 *   with an internal admin relay (confused deputy). hello has no protocol client to serve.
 * - local mode keeps them: the local transport (`LOCAL_TRANSPORT=mock`) uses them for `/hello/0/sqs`·`/sns`.
 * - lemon-core 5.0.11 has no switch to turn the protocol branch off, so the sub-handler `handle()` is wrapped.
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2026-10-30 initial version (security review H-2)
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved. (https://eureka.codes)
 */
import { $U, _inf } from 'lemon-core';
const NS = $U.NS('GURD', 'red'); // NAMESPACE TO BE PRINTED.

/** the subject of a lemon-core protocol message (SNS `Subject`, SQS attribute `Subject`). */
export const PROTOCOL_SUBJECT = 'x-protocol-service';

/** kind of the sub-handler to guard. */
export type GuardKind = 'sns' | 'sqs';

/** a lemon-core sub-handler with `handle(event, context)`. */
interface Handleable {
    handle: (event: any, context: any) => Promise<any>;
}

//* marker of a wrapped `handle()` (wrap once).
const GUARDED = Symbol('protocol-guard');

/**
 * true if `handler.handle()` is already wrapped by `guardProtocol()`.
 */
export const isGuarded = (handler: { handle?: any }): boolean => !!(handler?.handle as any)?.[GUARDED];

/**
 * true if the record is a protocol message. (the same checks as lemon-core SNS/SQS handlers)
 */
export const isProtocolRecord = (record: any): boolean => {
    if (!record || typeof record !== 'object') return false;
    if (record.Sns) return record.Sns.Subject == PROTOCOL_SUBJECT;
    return record.messageAttributes?.Subject?.stringValue == PROTOCOL_SUBJECT;
};

/**
 * wrap `handler.handle()`: outside local mode, drop protocol records (one warn line each) before lemon-core sees them.
 * - SQS: a dropped record is not a batch failure, so it is not delivered again.
 *
 * @param handler   `$lambda.sns` or `$lambda.sqs`.
 * @param kind      for the log line.
 * @param isLocal   (optional) local mode check (default `$U.isLocalMode()`).
 */
export const guardProtocol = <T extends Handleable>(
    handler: T,
    kind: GuardKind,
    isLocal: () => boolean = () => $U.isLocalMode(),
): T => {
    if (!handler || isGuarded(handler)) return handler;
    const $org = handler.handle;
    //* the guarded handle: filter the records, then call the original.
    const guarded = async (event: any, context: any) => {
        const records: any[] = Array.isArray(event?.Records) ? event.Records : [];
        if (isLocal() || !records.some(isProtocolRecord)) return $org(event, context);
        const kept = records.filter((record, i) => {
            if (!isProtocolRecord(record)) return true;
            const id = `${record?.Sns?.MessageId ?? record?.messageId ?? ''}`;
            _inf(NS, `WARN! drop protocol message - ${kind}[${i}] id:${id} (hello takes no protocol message)`);
            return false;
        });
        return $org({ ...event, Records: kept }, context);
    };
    (guarded as any)[GUARDED] = true;
    handler.handle = guarded;
    return handler;
};
