/**
 * `chatic-transformer.ts`
 * - pure conversion from `SlackMessage` to `chatic` webhook payload.
 *
 *
 * @author      Aiden <aiden@lemoncloud.io>
 * @date        2026-08-12 initial version
 *
 * @copyright (C) lemoncloud.io 2026 - All Rights Reserved.
 */
import { onlyDefined } from 'lemon-core';
import type { SlackMessage } from './slack-service';
import type { ChaticWebhookMeta } from './slack-types';

/** max length to keep a `text` inline — longer details are delegated to `sourceUrl`. */
const TEXT_LIMIT = 500;

/**
 * keep only a short string text — non-string(object) or long details are dropped.
 * - chat shows key lines only; the full payload is available via `sourceUrl`.
 */
export const asShortText = (text: any): string | undefined =>
    typeof text === 'string' && text.length > 0 && text.length <= TEXT_LIMIT ? text : undefined;

/**
 * compose summary content (notification preview) from a slack message.
 * - the first attachment's `title` -> `pretext` lines in order; detail rendering is delegated to `meta` (app).
 * - a plain message (no attachments) falls back to a short `.text`.
 */
export const asChaticContent = (body: SlackMessage): string => {
    const attachment = (body?.attachments || [])[0];
    const summary = attachment ? [attachment.title, attachment.pretext].filter(N => !!N).join('\n') : '';
    return summary || asShortText(attachment?.text ?? body?.text) || '';
};

/**
 * extract structured meta from a slack message.
 * - pretext/title/color/fields/footer come from the first attachment (representative, same convention as `saveMessageToS3()`).
 * - text falls back to `body.text` since a plain message (no attachments) only carries `.text`.
 */
export const asChaticMeta = (body: SlackMessage): Omit<ChaticWebhookMeta, 'sourceUrl'> => {
    const attachment = (body?.attachments || [])[0];
    const fields = (attachment?.fields || [])
        .filter(({ value }) => value !== undefined && value !== null)
        .map(({ title, value }) => onlyDefined({ title: title || undefined, value }));
    return onlyDefined({
        pretext: attachment?.pretext,
        title: attachment?.title,
        text: asShortText(attachment?.text ?? body?.text),
        fields: fields.length > 0 ? fields : undefined,
        color: attachment?.color,
        username: attachment?.username,
        ts: attachment?.ts,
        footer: attachment?.footer,
    });
};

/**
 * build the payload of `chatic` channel from a slack message.
 * - see `POST /hello/chat-send` of `chatic-socials-api`.
 * - the target channel is resolved by the receiver from the endpoint url. (ex: `?channelId=...`)
 * - the service `token` is carried in the body (not a header), since the receiving handler cannot read custom headers.
 *
 * @param body      slack message to convert.
 * @param options.sourceUrl (optional) S3 url of the full original payload, carried in `meta.sourceUrl` only (app renders the link).
 * @param options.token     (optional) service token to authenticate the request. (omitted if not given)
 */
export const asChaticPayload = (
    body: SlackMessage,
    options?: { sourceUrl?: string; token?: string },
): { content: string; stereo: string; token?: string; meta?: ChaticWebhookMeta } => {
    const sourceUrl = options?.sourceUrl;
    const content = asChaticContent(body);
    const meta = onlyDefined({ ...asChaticMeta(body), sourceUrl });
    return onlyDefined({
        content,
        stereo: 'webhook',
        token: options?.token,
        meta: Object.keys(meta || {}).length > 0 ? (meta as ChaticWebhookMeta) : undefined,
    });
};
