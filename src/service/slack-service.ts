/**
 * `slack-service.ts`
 * - common service for `slack` messaging
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2025-10-24 optimized from `lemon-hello-api`
 * @date        2026-10-30 v5: `postMessage()` uses WHATWG `URL` (Node 24).
 * @date        2026-10-30 security review: endpoint allow-list at send (H-1), `postMessage()` timeout (L-1),
 *                          regex rules compiled once (L-2), masked log lines (L-4).
 *
 * @copyright (C) lemoncloud.io 2025 - All Rights Reserved. (https://eureka.codes)
 */
import $cores, { $info, $T, $U, _err, _inf, _log, GETERR, NextContext } from 'lemon-core';
import { AWSS3Service, SlackAttachment, SlackPostBody } from 'lemon-core';
import { asChaticPayload } from './chatic-transformer';
import { checkSendEndpoint, compilePattern, isRegexForm } from './channel-policy';
import { maskEndpoint, maskSecrets } from './log-mask';
import { RouteRule, SlackChannelModel, SlackResponse, StorageSupportable } from './slack-types';
const NS = $U.NS('slack', 'blue'); // NAMESPACE TO BE PRINTED.

//* import dependency
import https from 'https';

/** timeout of one outbound POST (ms). the request is aborted after this. (L-1) */
export const POST_TIMEOUT_MS = 10000;

/**
 * interface: `SlackMessage`
 * - slack message interface
 */
export interface SlackMessage extends Omit<SlackPostBody, 'attachments'> {
    /**
     * the target channel name to be posted.
     * - if null, then send to default channel which was created in Slack App.
     * - if specified, then send message to this channel.
     */
    channel?: string;

    /**
     * (optional) attachments in slack message
     */
    attachments?: SlackAttachment[];
}
export { SlackResponse };

/**
 * record-data
 */
export interface RecordData<T = any, U = any> {
    subject?: string;
    data?: T;
    context?: NextContext<U>;
}

/**
 * bind-param-of-slack
 */
export interface BindParamOfSlack {
    pretext?: string;
    title?: string;
    text?: string;
    fields?: string[];
    color?: string;
    username?: string;
}

/**
 * param-to-slack
 */
export interface ParamToSlack {
    /**
     * (optional) target channel to send in force.
     */
    channel?: string;
    /**
     * slack message body.
     */
    body?: SlackPostBody;
}

/**
 * payload of message from SNS.
 * see `doReportSlack()` in `lemon-core`.
 */
export interface PayloadOfReportSlack {
    channel: string;
    service: string;
    // eslint-disable-next-line @typescript-eslint/ban-types
    param: {};
    body: SlackPostBody;
    context: {
        stage: string;
        apiId: string;
        resourcePath: string;
        identity: string;
        domainPrefix: string;
    };
}

/**
 * interface: `SlackHandler`
 * - slack message handler function
 */
export interface SlackTransformer<T = any> {
    ({ subject, data, context }: RecordData<T>): ParamToSlack | Promise<ParamToSlack>;
}

/**
 * extract only the defined attribute.
 * ex) `{ a:1, b: undefined }` -> `{ a:1 }`
 */
export const onlyDefined = <T>(N: T, def: T = null) =>
    N && typeof N === 'object'
        ? Object.entries(N).reduce<T>((N, [k, v]) => {
              if (v !== undefined) N[k as keyof T] = v;
              return N;
          }, {} as T)
        : def;

/**
 * class: `SlackService`
 * - common service for `slack` messaging
 */
export class SlackService {
    /**
     * default constructor.
     *
     * @param $channel storage supportable for slack channel model.
     */
    public constructor(
        public readonly $channel: StorageSupportable<SlackChannelModel>,
        public readonly options?: {
            /** current time for testing */
            current?: number;
            /** (optional) S3 service for message storage */
            $s3s?: AWSS3Service;
        },
    ) {
        if (!$channel) throw new Error(`$channel (StorageSupportable<SlackChannelModel>) is required - SlackService()`);
    }

    /**
     * hello.
     */
    public hello = () => `slack-service:${this.$channel?.hello() ?? '-'}`;

    /**
     * log one warn line (overridable in tests).
     */
    public logWarn = (line: string): void => {
        _inf(NS, line);
    };

    /**
     * get channel by id
     * - can return null if not found.
     */
    public async channel(id: string, $def?: SlackChannelModel): Promise<SlackChannelModel | null> {
        const errScope = `slack.channel(${id ?? ''})`;
        if (!id) throw new Error(`@id (channel) is required - ${errScope}`);
        const $org = await this.$channel?.read(id);
        if (!$org && $def) {
            return await this.$channel?.save(id, $def);
        }
        return $org;
    }

    /**
     * load the default channel model (no auto create)
     * 1. try to load channel by id
     * 2. make sure `endpoint` is filled by env variable if not exist.
     */
    public async default(id?: string): Promise<SlackChannelModel> {
        const channel = `${id || 'public'}`;
        const $model = await this.channel(channel);
        const envName = `SLACK_${channel.toUpperCase()}`;
        const endpoint = $model?.endpoint ?? $cores.cores.config.config.get(envName)?.trim();
        return onlyDefined<SlackChannelModel>({ ...$model, channel: $model?.channel ?? channel, endpoint });
    }

    /**
     * route the slack body to target
     *
     * @param body SlackMessage to post.
     */
    public async route(
        body: SlackMessage,
        options?: {
            /** target channel to send the message */
            channel?: string;
            /** all targets to send the message */
            targets?: string[];
            /** default parent */
            parent?: SlackChannelModel;
        },
    ): Promise<SlackChannelModel> {
        const errScope = `slack.route(${body?.channel ?? ''}/${options?.channel ?? ''})`;
        _inf(NS, `>> ${errScope}`);

        // STEP.0 validate parameters.
        const channel = options?.channel ?? body?.channel;
        const targets = options?.targets || [];

        //* check of end-of-routing
        if (!channel || targets?.includes(channel)) {
            return this.send(body, { ...options });
        }

        const _route = (body: SlackMessage, channel: string) => {
            return this.route(body, { ...options, channel, targets: [...targets] });
        };

        //* apply rules.
        let $last: SlackChannelModel = null;
        const $ch = channel ? await this.channel(channel) : null;
        const rules = $ch?.rules || [];
        for (const i in rules) {
            const rule = rules[i];
            _log(NS, `>> rule[${channel}:${i}] =`, $U.json(rule));
            const matched = this.match(body, rule);
            if (matched) {
                _log(NS, `>> match[${channel}:${i}] =`, $U.json(matched));
                //- duplicate also to other channel
                if (rule.copyTo && !targets.includes(rule.copyTo)) {
                    targets.push(rule.copyTo);
                    $last = await _route(matched, rule.copyTo);
                }

                //- forward to specific channel
                if (rule.moveTo && !targets.includes(rule.moveTo)) {
                    targets.push(rule.moveTo);
                    $last = await _route(matched, rule.moveTo);
                    // break here.
                    return $last;
                }
            }
        }

        //* send via this channel.
        if (channel && !targets.includes(channel)) {
            targets.push(channel);
            $last = await _route(body, channel);
        }

        //* returns.
        return $last;
    }

    /** test if pattern is matched */
    public match(body: SlackMessage, rule: RouteRule): SlackMessage {
        const pattern = `${rule?.pattern || ''}`;
        //* L-2: `/.../` is compiled once (no `g` flag); an invalid pattern is no match (never throws).
        const re = isRegexForm(pattern) ? compilePattern(pattern) : null;
        const _test = (text: string): boolean => {
            if (!pattern || typeof text !== 'string') return false;
            if (pattern.startsWith('#')) return text.includes(pattern);
            if (isRegexForm(pattern)) return re ? re.test(text) : false;
            //* default is word matching
            if (text.includes(pattern)) return true;
            return text.split(' ').includes(pattern);
        };
        const matched = body.attachments?.reduce<SlackAttachment[]>((L, N) => {
            if (
                (N?.text && _test(N.text)) ||
                (N?.title && _test(N.title)) ||
                (N?.pretext && _test(N.pretext)) ||
                (N?.footer && _test(N.footer)) ||
                false
            ) {
                if (rule.color) {
                    L.push({ ...N, color: rule.color });
                } else {
                    L.push(N);
                }
            }
            return L;
        }, []);
        if (matched?.length > 0) {
            return {
                ...body,
                attachments: matched,
            };
        }
        return;
    }

    /**
     * send message to specific channel
     * 1. find `channel-model` by default('public') as parent.
     * 2. if body has `channel`, then keep the channel.
     * 3. if options.channel is specified, then override the channel.
     */
    public async send(
        body: SlackMessage,
        options?: {
            /** (optional) target channel id to use. (overrides `body.channel`) */
            channel?: string;
            /** (optional) parent channel to use. (or use `public` as default) */
            parent?: SlackChannelModel;
            /** (optional) flag to send directly to endpoint w/o saving S3 */
            direct?: boolean;
        },
    ): Promise<SlackChannelModel> {
        const errScope = `slack.send(${body?.channel ?? ''}/${options?.channel ?? ''})`;
        _inf(NS, `>> ${errScope}`);
        const direct = options?.direct ?? false;
        const target = options?.channel ? await this.default(options.channel) : null;
        const parent = options?.parent ?? (await this.default());
        const endpoint = target?.endpoint || parent?.endpoint;
        const channel = target?.channel ?? parent?.channel;
        const stereo = target?.stereo || parent?.stereo;
        _log(NS, `>> parent =`, $U.json(maskSecrets(parent)));

        const asBool = (a: any): boolean => (a === undefined || a === null || a === '' ? undefined : !!a);
        const isDirect = !direct && endpoint?.startsWith('https://hooks.slack.com');
        const isUseS3 = asBool(target?.useS3 ?? parent?.useS3);
        const $msg = isDirect && body ? await this.saveMessageToS3(body, isUseS3) : body;
        const message: SlackMessage = onlyDefined<SlackMessage>({
            ...$msg,
            channel:
                channel === null || channel === ''
                    ? undefined
                    : target
                    ? channel
                    : body?.channel
                    ? body?.channel
                    : channel
                    ? channel
                    : undefined,
        });

        //* send via endpoint.
        const _send = async (): Promise<SlackResponse> => {
            if (endpoint?.startsWith('http://') || endpoint?.startsWith('https://')) {
                //* H-1: `https:` to an allowed host (stored or config endpoint). unset env: an unlisted host warns only.
                if (!checkSendEndpoint(endpoint, this.logWarn)) {
                    _inf(NS, `WARN! endpoint not allowed:${channel ?? ''} =`, maskEndpoint(endpoint));
                    return { statusCode: 400, statusMessage: `400 INVALID ENDPOINT - host not allowed @${errScope}` };
                }
                //* `chatic` channel - convert to `{content, stereo, token}`. (target channel is in the endpoint url)
                const isChatic = stereo === 'chatic';
                const token = target?.token || parent?.token;
                const sourceUrl = isChatic ? await this.saveChaticSourceToS3(message, isUseS3) : undefined;
                const $body = isChatic ? asChaticPayload(message, { sourceUrl, token }) : message;
                const $sent = await this.postMessage(endpoint, $body).catch<SlackResponse>(e => {
                    _err(NS, `! err.send:${channel ?? ''} =`, e);
                    return { statusCode: 500, statusMessage: `${GETERR(e)} - ${errScope}` };
                });
                _log(NS, `>> sent:${channel ?? ''} =`, $U.json($sent));
                return $sent;
            }
            return {
                statusCode: 0,
                statusMessage: `@endpoint(string) is required in channe[${channel}] - ${errScope}`,
            };
        };
        const $sent = await _send();
        return onlyDefined<SlackChannelModel>({ ...(target ?? parent), $sent, endpoint });
    }

    /**
     * save message data into S3.
     */
    public saveMessageToS3 = async (message: SlackMessage, isUseS3?: boolean): Promise<SlackMessage> => {
        _log(NS, `saveMessageToS3()...`);
        const SLACK_PUT_S3 = $U.env('SLACK_PUT_S3', '1') as string;
        isUseS3 = isUseS3 ?? !!$U.N(SLACK_PUT_S3, 0);
        const attachments: SlackAttachment[] = message?.attachments || [];
        const isSlackMessage = (message: any): message is SlackMessage =>
            Array.isArray(attachments) && attachments.length > 0;

        //* if put to s3, then filter attachments
        if (isUseS3 && isSlackMessage(message)) {
            const attachment = attachments[0];
            const pretext = $T.S(attachment.pretext, '');
            const title = $T.S(attachment.title, '');
            const color = $T.S(attachment.color, 'green');
            const thumb_url = attachment.thumb_url ? attachment.thumb_url : undefined;
            const image_url = attachment.image_url ? attachment.image_url : undefined;
            _log(NS, `> title[${pretext}] =`, title);
            const saves = { ...message };
            saves.attachments = attachments.map((N: any) => {
                //* convert internal data.
                N = { ...N }; // copy.
                const text = typeof N.text === 'string' ? N.text : `${N.text || ''}`;
                try {
                    if (text.startsWith('{') && text.endsWith('}')) N.text = JSON.parse(N.text);
                    if (N.text && N.text['stack-trace'] && typeof N.text['stack-trace'] == 'string')
                        N.text['stack-trace'] = N.text['stack-trace'].split('\n');
                } catch (e) {
                    _err(NS, '> WARN! ignored =', e);
                }
                return N;
            });

            //* choose the icon.
            // eslint-disable-next-line prettier/prettier
            const MOONS =
                ':new_moon:,:waxing_crescent_moon:,:first_quarter_moon:,:moon:,:full_moon:,:waning_gibbous_moon:,:last_quarter_moon:,:waning_crescent_moon:'.split(
                    ',',
                );
            const now = this.options?.current ? new Date(this.options?.current) : new Date();
            let hour = now.getHours() + now.getMinutes() / 60.0 + 1.0;
            hour = hour >= 24 ? hour - 24 : hour;
            const tag = MOONS[Math.floor((MOONS.length * hour) / 24)];
            const json = $U.json(saves);
            const bucket = this.options?.$s3s?.bucket();

            // ignore
            if (!bucket) return message;

            // _log(NS, `> json =`, json);
            return this.options?.$s3s
                .putObject(json)
                .then(res => {
                    const { Bucket, Key, Location } = res;
                    _inf(NS, `> uploaded[${Bucket}/${Key}] =`, $U.json(res));
                    const link = Location;
                    //* change btwn title & pretext.
                    const _pretext = title?.startsWith('error-report') ? title : pretext;
                    const text = title?.startsWith('error-report') ? pretext : title;
                    const tag0 = `${text}`.startsWith('#error') ? ':rotating_light:' : '';
                    message.attachments = [
                        onlyDefined<SlackAttachment>({
                            pretext: _pretext,
                            text: `<${link}|${tag0 || tag || '*'}> ${text}`,
                            color,
                            mrkdwn: true,
                            mrkdwn_in: ['pretext', 'text'],
                            thumb_url,
                            image_url,
                        }),
                    ];
                    return message;
                })
                .catch(e => {
                    _err(NS, 'WARN! internal.err =', e);
                    message.attachments.push({
                        pretext: `**WARN** internal error in \`lemon-hello-api\` to \`${bucket}\``,
                        color: 'red',
                        title: `${e.message || e.reason || e.error || e}: ${e.stack || ''}`,
                    });
                    return message;
                });
        }
        return message;
    };

    /**
     * upload the original message (JSON) to S3 for `chatic` webhook.
     * - unlike `saveMessageToS3()`, this does not rewrite `.attachments` w/ slack markup.
     * - returns the object URL, or `undefined` if S3 is not configured/enabled or upload fails.
     */
    public saveChaticSourceToS3 = async (message: SlackMessage, isUseS3?: boolean): Promise<string> => {
        const SLACK_PUT_S3 = $U.env('SLACK_PUT_S3', '1') as string;
        isUseS3 = isUseS3 ?? !!$U.N(SLACK_PUT_S3, 0);
        const bucket = this.options?.$s3s?.bucket();
        if (!isUseS3 || !bucket) return undefined;
        return this.options?.$s3s
            .putObject($U.json(message))
            .then(res => res?.Location)
            .catch(e => {
                _err(NS, '> WARN! chatic.s3.err =', e);
                return undefined;
            });
    };

    /**
     * POST message to endpoint.
     *
     * @param {*} endpoint      URL
     * @param {*} message       Object or String.
     */
    public postMessage = async (endpoint: string, message: any): Promise<SlackResponse> => {
        //* L-4: never log the full endpoint or the `token` in the body.
        _log(NS, `> postMessage = endpoint[${maskEndpoint(endpoint)}]`);
        message = typeof message == 'object' && message instanceof Promise ? await message : message;
        _log(NS, `> message = `, $U.json(maskSecrets(message)));

        //* v5: WHATWG `URL` instead of `url.parse()` (Node 24 runtime warning DEP0169). same host/path/query.
        const target = new URL(endpoint);
        const body = (typeof message == 'string' ? message : JSON.stringify(message)) || '';
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Content-Length': Buffer.byteLength(body),
            },
        };
        return new Promise((resolve, reject) => {
            //* L-1: settle once; the timer aborts a hanging request after `POST_TIMEOUT_MS`.
            let timer: ReturnType<typeof setTimeout> = null;
            const done = (fn: () => void) => {
                if (timer) clearTimeout(timer);
                timer = null;
                fn();
            };
            const postReq = https.request(target, options, res => {
                const chunks: any[] = [];
                res.setEncoding('utf8');
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const body = chunks.join('');
                    const statusCode = res.statusCode || 200;
                    const statusMessage = res.statusMessage || '';
                    const result = { body, statusCode, statusMessage };
                    _log(NS, `> post(${maskEndpoint(endpoint)}) =`, $U.json(result));
                    done(() => (statusCode < 400 ? resolve(result) : reject(result)));
                });
                return res;
            });
            //* a request error (dns, connect, abort) rejects. (no unhandled `error` event)
            postReq.on('error', e => done(() => reject(e)));
            timer = setTimeout(() => {
                const e = new Error(`504 TIMEOUT - postMessage(${target.hostname}) after ${POST_TIMEOUT_MS} ms`);
                done(() => reject(e));
                postReq.destroy(e);
            }, POST_TIMEOUT_MS);
            postReq.write(body);
            postReq.end();
        });
    };
    /**
     * post to slack channel(default is public).
     */
    public packageWithChannel =
        (channel: string) =>
        (
            pretext = '',
            title = '',
            text = '',
            fields: (string | { title: string; value: string })[] = [],
            color = '',
            username = '',
        ): ParamToSlack => {
            _log(NS, `packageWithChannel(${channel})...`);
            channel = `${channel || 'public'}`;
            color = `${color || '#FFB71B'}`;
            username = `${username || 'hello-alarm'}`;
            _log(NS, `> param[${channel}] =`, $U.json({ pretext, title, color, username }));
            const { service, version, stage } = $info();

            //* build attachment.
            const ts = Math.floor(new Date().getTime() / 1000);
            const fields2 = fields.map((field, i) =>
                typeof field === 'string'
                    ? { title: `${field || ''}`.split('/')[0] || `${i + 1}`, value: field }
                    : { ...(field as any) },
            );
            const footer = `${service}/${stage}#${version}`;
            const attachment = { username, color, pretext, title, text, ts, fields: fields2, footer };

            //* build body for slack, and call
            const body = { attachments: [attachment] };
            return { channel, body };
        };

    /**
     * post to slack default channel.
     */
    public packageDefaultChannel = ({ pretext, title, text, fields, color, username }: BindParamOfSlack) => {
        _log(NS, `packageDefaultChannel()...`);
        return this.packageWithChannel('')(
            pretext || '',
            title || '',
            text || '',
            fields || [],
            color || '',
            username || '',
        );
    };

    /**
     * convert object to json string.
     */
    public asText = (data: any) => {
        const keys = (data && Object.keys(data)) || [];
        return keys.length > 0 ? JSON.stringify(data) : '';
    };

    /**
     * find the handler by subject.
     *
     * @param subject to process.
     * @returns SlackHandler
     */
    public asTransformer(subject: string): SlackTransformer {
        _log(NS, `asHandler(${subject})...`);
        if (!subject) return this.$transformer.noop;
        if (subject === 'error' || subject.startsWith('error/')) return this.$transformer.buildErrorForm;
        if (subject === 'slack' || subject.startsWith('slack/')) return this.$transformer.buildCommonSlackForm;
        return this.$transformer.noop;
    }

    /** handlers */
    protected $transformer: { [key: string]: SlackTransformer } = {
        /**
         * default noop handler
         */
        noop: ({ subject, data, context }: RecordData): ParamToSlack => {
            _log(NS, `noop.handler(${subject})...`);
            return this.packageDefaultChannel({
                text: $U.json(data),
                pretext: `post-event`,
                title: subject || `Unknown event`,
            });
        },
        /**
         * build simple form for error-report
         */
        buildErrorForm: async ({ subject, data, context }: RecordData): Promise<ParamToSlack> => {
            _log(`buildErrorForm(${subject})...`);
            data = data || {};
            subject = `${subject || ''}`;

            //* get error reason.
            const channel = subject.indexOf('/')
                ? subject.split('/', 2)[1]
                : (data.data && data.data.channel) || data.channel;
            const message = data.message || data.error;
            _log(`>> data[${channel || ''}] =`, $U.json(maskSecrets(data)));
            const service = (() => {
                const str = $T.S(data?.service);
                return str.indexOf('://') > 0 ? str.substring(str.indexOf('://') + 3) : str;
            })();
            const title = service ? `error-report: \`${service}\`` : 'error-report';

            return this.packageWithChannel(channel)(message, title, this.asText(data), []);
        },
        /**
         * transform to slack-body from SNS Payload.
         */
        buildCommonSlackForm: ({ subject, data, context }: RecordData<PayloadOfReportSlack>): ParamToSlack => {
            _log(NS, `buildCommonSlackForm(${subject})...`);
            const $data: PayloadOfReportSlack = { ...data };
            subject = `${subject || ''}`;
            _log(NS, `> raw-data[${subject}] =`, $U.json(maskSecrets($data)));

            //* extract data.
            const channel = subject.indexOf('/') > 0 ? subject.split('/', 2)[1] : $data.channel || '';
            const service = `${$data.service || ''}`;
            const body = $data.body;

            //* add additional attachment about caller context
            if (context && body?.attachments && Array.isArray(body?.attachments)) {
                body.attachments.push({
                    pretext: service,
                    fields: [
                        {
                            title: 'context',
                            value: context ? $U.json(context) : '',
                        },
                    ],
                });
            }

            //* returns.
            return { channel, body };
        },
    };
}
