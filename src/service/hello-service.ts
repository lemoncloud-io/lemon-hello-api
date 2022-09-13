/**
 * `hello-service.ts`
 * - common service for `hello`
 *
 *
 * @author      Tyler <tyler@lemoncloud.io>
 * @date        2020-06-10 refactor with api
 * @date        2020-06-23 optimized with lemon-core#2.2.1
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2022-09-08 supports database w/ manager
 * @date        2022-09-13 support route by channel's rules.
 *
 * @copyright (C) 2020 LemonCloud Co Ltd. - All Rights Reserved.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $U, $T, _log, _inf, _err } from 'lemon-core';
import {
    APIService,
    SlackAttachment,
    AWSKMSService,
    AWSS3Service,
    AWSSNSService,
    SlackPostBody,
    CoreManager,
    CoreService,
    NextContext,
    $info,
} from 'lemon-core';
import { CallbackSlackData, CallbackPayload } from '../common/types';
import { $FIELD, ChannelModel, Model, ModelType, RouteRule, TargetModel, TestModel } from './hello-model';

//! import dependency
import https from 'https';
import AWS from 'aws-sdk';
import url from 'url';
const NS = $U.NS('HLLS', 'blue'); // NAMESPACE TO BE PRINTED.

/**
 * record-data
 */
export interface RecordData<T = any, U = any> {
    subject?: string;
    data?: T;
    context?: U;
}

/**
 * notification-param
 */
export interface NotificationParam {
    service?: string;
    stage?: string;
    event?: string;
    type?: string;
    data?: { accountId?: string; provider?: string };
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
    channel?: string;
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

export interface PostResponse {
    body: string;
    statusCode: number;
    statusMessage: string;
}

/**
 * class: `HelloService`
 * - catch `report-error` via SNS, then save into S3 and post to slack.
 */
export class HelloService extends CoreService<Model, ModelType> {
    protected $channels: any = {};

    public readonly $kms: AWSKMSService;
    public readonly $sns: AWSSNSService;
    public readonly $s3s: AWSS3Service;

    public readonly $test: MyTestManager;
    public readonly $channel: MyChannelManager;
    public readonly $target: MyTargetManager;

    /**
     * default constructor w/ optional parameters.
     *
     * @param tableName target table-name, or dummy `.yml` file.
     * @param params optional parameters.
     */
    public constructor(tableName?: string, params?: { kms?: AWSKMSService; sns?: AWSSNSService; s3?: AWSS3Service }) {
        super(tableName);
        _log(NS, `HelloService(${this.tableName}, ${this.NS})...`);
        this.$kms = params?.kms ?? new AWSKMSService();
        this.$sns = params?.sns ?? new AWSSNSService();
        this.$s3s = params?.s3 ?? new AWSS3Service();

        this.$test = new MyTestManager(this);
        this.$channel = new MyChannelManager(this);
        this.$target = new MyTargetManager(this);
    }

    /**
     * hello.
     */
    public hello = () => `hello-service`;

    /**
     * POST message to hookUrl.
     *
     * @param {*} hookUrl       URL
     * @param {*} message       Object or String.
     */
    public postMessage = async (hookUrl: string, message: any): Promise<PostResponse> => {
        _log(NS, `> postMessage = hookUrl[${hookUrl}]`);
        message = typeof message == 'object' && message instanceof Promise ? await message : message;
        _log(NS, `> message = `, $U.json(message));

        //TODO - improve `url.parse()` due to deprecated.
        const options: any = url.parse(hookUrl);
        const body = (typeof message == 'string' ? message : JSON.stringify(message)) || '';
        options.method = 'POST';
        options.headers = {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': Buffer.byteLength(body),
        };
        return new Promise((resolve, reject) => {
            const postReq = https.request(options, res => {
                const chunks: any[] = [];
                res.setEncoding('utf8');
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const body = chunks.join('');
                    const statusCode = res.statusCode || 200;
                    const statusMessage = res.statusMessage || '';
                    const result = { body, statusCode, statusMessage };
                    _log(NS, `> post(${hookUrl}) =`, $U.json(result));
                    if (statusCode < 400) {
                        resolve(result);
                    } else {
                        reject(result);
                    }
                });
                return res;
            });
            postReq.write(body);
            postReq.end();
        });
    };

    /**
     * store channel map in cache
     *
     * @param name channel name (= 'public')
     * @param defName (optional) default name if not found
     * @param prefix (optional) prefix name of target environment key.
     * @returns URL address to post
     */
    public loadSlackChannel = async (name: string, defName?: string, prefix = 'SLACK'): Promise<string> => {
        name = name || 'public';
        defName = defName || '';

        const DELIM = prefix ? '_' : '';
        const ENV_NAME = `${prefix}${DELIM}${name}`.toUpperCase();
        const DEF_NAME = defName ? `${prefix}${DELIM}${defName}`.toUpperCase() : '';
        const _find = (name: string): string => (name ? `${this.$channels[name] || process.env?.[name] || ''}` : '');

        // const webhook_name = this.$channels[ENV_NAME] || $env[ENV_NAME] || '';
        // const webhook_default = this.$channels[DEF_NAME] || $env[DEF_NAME] || '';
        // const webhook = webhook_name || webhook_default;
        const webhook = (_find(ENV_NAME) || _find(DEF_NAME) || '').trim();
        _inf(NS, `> webhook[${name}] :=`, webhook);
        if (!webhook) throw new Error(`@env[${ENV_NAME}] is not found!`);

        //! decrypt if required.
        return Promise.resolve(webhook)
            .then(_ => {
                if (!_.startsWith('http')) {
                    return this.$kms.decrypt(_).then(_ => {
                        const url = `${_}`.trim();
                        this.$channels[ENV_NAME] = url;
                        return url;
                    });
                }
                return _;
            })
            .then(_ => {
                if (!(_ && _.startsWith('http'))) {
                    throw new Error(`404 NOT FOUND - Channel:${name}, Hook:${webhook?.substring(0, 100)}`);
                }
                return _;
            });
    };

    /**
     * process the request of subscription-confirmation
     */
    public getSubscriptionConfirmation = async (param: { snsMessageType: string; subscribeURL: string }) => {
        _log(NS, `getSubscriptionConfirmation()...`);
        // Send HTTP GET to subscribe URL in request for subscription confirmation
        if (param?.snsMessageType === 'SubscriptionConfirmation' && param.subscribeURL) {
            const uri = new URL(param.subscribeURL);
            const path = `${uri.pathname || ''}`;
            const search = `${uri.search || ''}`;
            const api = new APIService('web', `${uri.origin}${path == '/' ? '' : path}`);
            const res = await api.doGet(null, null, search.startsWith('?') ? search.substring(1) : search);
            _log(NS, `> subscribe =`, $U.json(res));
            return 'OK';
        }
        return 'PASS';
    };

    /**
     * convert object to json string.
     */
    public asText = (data: any) => {
        const keys = (data && Object.keys(data)) || [];
        return keys.length > 0 ? JSON.stringify(data) : '';
    };

    /**
     * save message data into S3.
     */
    public saveMessageToS3 = async (message: SlackPostBody | any) => {
        _log(NS, `saveMessageToS3()...`);
        const SLACK_PUT_S3 = $U.env('SLACK_PUT_S3', '1') as string;
        const isUseS3 = !!$U.N(SLACK_PUT_S3, 0);
        const attachments: SlackAttachment[] = message?.attachments || [];

        const isSlackPostBody = (message: any): message is SlackPostBody =>
            Array.isArray(attachments) && attachments.length > 0;

        //! if put to s3, then filter attachments
        if (isUseS3 && isSlackPostBody(message)) {
            const attachment = attachments[0];
            const pretext = $T.S(attachment.pretext, '');
            const title = $T.S(attachment.title, '');
            const color = $T.S(attachment.color, 'green');
            const thumb_url = attachment.thumb_url ? attachment.thumb_url : undefined;
            _log(NS, `> title[${pretext}] =`, title);
            const saves = { ...message };
            saves.attachments = attachments.map((N: any) => {
                //! convert internal data.
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

            //! choose the icon.
            // eslint-disable-next-line prettier/prettier
            const MOONS = ':new_moon:,:waxing_crescent_moon:,:first_quarter_moon:,:moon:,:full_moon:,:waning_gibbous_moon:,:last_quarter_moon:,:waning_crescent_moon:'.split(',');
            const now = this.current ? new Date(this.current) : new Date();
            let hour = now.getHours() + now.getMinutes() / 60.0 + 1.0;
            hour = hour >= 24 ? hour - 24 : hour;
            const tag = MOONS[Math.floor((MOONS.length * hour) / 24)];
            const json = $U.json(saves);

            // _log(NS, `> json =`, json);
            return this.$s3s
                .putObject(json)
                .then(res => {
                    const { Bucket, Key, Location } = res;
                    _inf(NS, `> uploaded[${Bucket}/${Key}] =`, $U.json(res));
                    const link = Location;
                    const _pretext = title == 'error-report' ? title : pretext;
                    const text = title == 'error-report' ? pretext : title;
                    const tag0 = `${text}`.startsWith('#error') ? ':rotating_light:' : '';
                    message.attachments = [
                        {
                            pretext: _pretext,
                            text: `<${link}|${tag0 || tag || '*'}> ${text}`,
                            color,
                            mrkdwn: true,
                            mrkdwn_in: ['pretext', 'text'],
                            thumb_url,
                        },
                    ];
                    return message;
                })
                .catch(e => {
                    _err(NS, 'WARN! internal.err =', e);
                    message.attachments.push({
                        pretext: '**WARN** internal error in `lemon-hello-api`',
                        color: 'red',
                        title: `${e.message || e.reason || e.error || e}: ${e.stack || ''}`,
                    });
                    return message;
                });
        }
        return message;
    };

    /**
     * transform to slack message.
     * @param body see `notifyLoginEvent()` of `lemon-accounts-api/oauth-api`
     */
    public buildSlackNotification = (body: any, color?: string) => {
        _log(NS, `buildSlackNotification()...`);
        body = body || {};
        // Publish notification on Slack public channel
        let pretext = '';
        let title = '';
        color = `${color || '#12B5E9'}`;
        if (body.type === 'oauth') {
            const data = body.data || {};
            const $ctx = body.context || {};
            const $acc = body.Account || {};
            const accountId = `${data.accountId || ''}`;
            const provider = `${data.provider || ''}`;
            const clientIp = `${data.context?.clientIp || $ctx?.clientIp || ''}`;
            const who =
                provider && $acc?.name
                    ? `${provider}/${$acc?.name}`
                    : $acc?.name
                    ? `${$acc?.name}`
                    : provider && accountId.startsWith(provider)
                    ? accountId
                    : `${provider}/${accountId}`;
            title = `#${body?.event || 'oauth'}(\`${body.stage}\`) of \`${who}\` via \`${clientIp}\``;
            color = `${body?.color || '#FFC300'}`; // yellow style.
            if (body && typeof body == 'object') body._source = __filename;
        } else if (body?.mail && body?.notificationType) {
            const subject = `mail/${body?.notificationType}`;
            const type = body?.bounce?.bounceType || '';
            const sub = (body?.bounce?.bouncedRecipients && body?.bounce?.bouncedRecipients[0]?.emailAddress) || '';
            pretext = `\`#notification\` at lemon-hello-api`;
            title = `[${subject}] event received as \`${type}/${sub}\`.`;
        } else if (body?.subject !== undefined && body?.data !== undefined) {
            const subject = body?.subject || Object.keys(body?.data)[0] || '';
            pretext = `\`#notification\` at lemon-hello-api`;
            title = `[${subject}] event received.`;
        } else {
            pretext = `\`#notification\` at lemon-hello-api`;
            title = `[${body.event || ''}] event received from \`${body.service}/${body.stage}\`.`;
        }

        return this.packageWithChannel('public')(pretext, title, this.asText(body), [], color);
    };

    /**
     * build simple form for alarm
     */
    public buildAlarmForm = async ({ subject, data, context }: RecordData): Promise<ParamToSlack> => {
        _log(`buildAlarmForm(${subject})...`);
        data = data || {};
        _log(`> data[${subject}] =`, $U.json(data));

        const AlarmName = data.AlarmName || '';
        const AlarmDescription = data.AlarmDescription || '';

        //!  build fields.
        const Fields: any[] = [];
        const pop_to_fields = (param: string, short = true) => {
            short = short === undefined ? true : short;
            const [name, nick] = param.split('/', 2);
            const val = data[name];
            if (val !== undefined && val !== '') {
                Fields.push({
                    title: nick || name,
                    value: typeof val === 'object' ? JSON.stringify(val) : val,
                    short,
                });
            }
            delete data[name];
        };
        pop_to_fields('AlarmName', false);
        pop_to_fields('AlarmDescription');
        pop_to_fields('AWSAccountId');
        pop_to_fields('NewStateValue');
        pop_to_fields('NewStateReason', false);
        pop_to_fields('StateChangeTime');
        pop_to_fields('Region');
        pop_to_fields('OldStateValue');
        pop_to_fields('Trigger', false);

        const pretext = `Alarm: ${AlarmName}`;
        const title = AlarmDescription || '';
        const text = this.asText(data);
        const fields = Fields;

        return this.packageDefaultChannel({ pretext, title, text, fields });
    };

    /**
     * build simple form for delivery failure of SNS
     */
    public buildDeliveryFailure = async ({ subject, data, context }: RecordData): Promise<ParamToSlack> => {
        _log(`buildDeliveryFailure(${subject})...`);
        data = data || {};
        _log(`> data[${subject}] =`, $U.json(data));

        const FailName = data.EventType || '';
        const FailDescription = data.FailureMessage || '';
        const EndpointArn = data.EndpointArn || '';

        //!  build fields.
        const Fields: any[] = [];
        const pop_to_fields = (param: string, short = true) => {
            short = short === undefined ? true : short;
            const [name, nick] = param.split('/', 2);
            const val = data[name];
            if (val !== undefined && val !== '' && nick !== '') {
                Fields.push({
                    title: nick || name,
                    value: typeof val === 'object' ? JSON.stringify(val) : val,
                    short,
                });
            }
            delete data[name];
        };
        pop_to_fields('EventType/'); // clear this
        pop_to_fields('FailureMessage/'); // clear this
        pop_to_fields('FailureType');
        pop_to_fields('DeliveryAttempts/'); // DeliveryAttempts=1
        pop_to_fields('Service/'); // Service=SNS
        pop_to_fields('MessageId');
        pop_to_fields('EndpointArn', false);
        pop_to_fields('Resource', false);
        pop_to_fields('Time/', false); // clear this

        const pretext = `SNS: ${FailName}`;
        const title = FailDescription || '';
        // const text = asText(data);
        const text = `For more details, run below. \n\`\`\`aws sns get-endpoint-attributes --endpoint-arn "${EndpointArn}"\`\`\``;
        const fields = Fields;

        const message = { pretext, title, text, fields };

        //! get get-endpoint-attributes
        const SNS = new AWS.SNS();
        const result = await SNS.getEndpointAttributes({ EndpointArn })
            .promise()
            .then(_ => {
                _log(NS, '> EndpointAttributes=', _);
                const Attr = (_ && _.Attributes) || {};
                message.fields.push({ title: 'Enabled', value: Attr.Enabled || '', short: true });
                message.fields.push({ title: 'CustomUserData', value: Attr.CustomUserData || '', short: true });
                message.fields.push({ title: 'Token', value: Attr.Token || '', short: false });
                return message;
            })
            .catch(e => {
                _err(NS, '!ERR EndpointAttributes=', e);
                return message;
            });

        // package default.
        return this.packageDefaultChannel(result);
    };

    /**
     * build simple form for error-report
     */
    public buildErrorForm = async ({ subject, data, context }: RecordData): Promise<ParamToSlack> => {
        _log(`buildErrorForm(${subject})...`);
        data = data || {};
        subject = `${subject || ''}`;

        //! get error reason.
        const channel = subject.indexOf('/')
            ? subject.split('/', 2)[1]
            : (data.data && data.data.channel) || data.channel;
        const message = data.message || data.error;
        _log(`>> data[${channel || ''}] =`, $U.json(data));

        return this.packageWithChannel(channel)(message, 'error-report', this.asText(data), []);
    };

    /**
     * build simple form for callback
     */
    public buildCallbackForm = ({ subject, data, context }: RecordData): ParamToSlack => {
        _log(`buildCallbackForm(${subject})...`);
        subject = `${subject || ''}`;
        const $body: CallbackPayload = data || {};
        _log(`> data[${subject}] =`, $U.json($body));

        //! restrieve service & cmd
        const $data: CallbackSlackData = $body.data || {};
        const channel = subject.indexOf('/') > 0 ? subject.split('/', 2)[1] : $data && $data.channel;
        const service = ($body && $body.service) || '';
        const cmd = ($data && $data.cmd) || '';
        const title = ($data && $data.title) || (!service ? `callback-report` : `#callback ${service}/${cmd}`);

        return this.packageWithChannel(`${channel || ''}`)('', title, this.asText($body), [], '#B71BFF');
    };

    /**
     * transform to slack-body from SNS Payload.
     */
    public buildCommonSlackForm = ({ subject, data, context }: RecordData<PayloadOfReportSlack>): ParamToSlack => {
        _log(NS, `buildCommonSlackForm(${subject})...`);
        const $data: PayloadOfReportSlack = { ...data };
        subject = `${subject || ''}`;
        _log(NS, `> raw-data[${subject}] =`, $U.json($data));

        //! extract data.
        const channel = subject.indexOf('/') > 0 ? subject.split('/', 2)[1] : $data.channel || '';
        const service = `${$data.service || ''}`;
        const body = $data.body;

        //! add additional attachment about caller context
        if (!channel.startsWith('!') && context && body?.attachments && Array.isArray(body?.attachments)) {
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

        //! returns.
        return { channel, body };
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
            color = `${color || '#FFB71B'}`;
            username = `${username || 'hello-alarm'}`;
            _log(NS, `> param[${channel}] =`, $U.json({ pretext, title, color, username }));
            const { service, version, stage } = $info();

            //! build attachment.
            const ts = Math.floor(new Date().getTime() / 1000);
            const fields2 = fields.map((field, i) =>
                typeof field === 'string'
                    ? { title: `${field || ''}`.split('/')[0] || `${i + 1}`, value: field }
                    : { ...(field as any) },
            );
            const footer = `${service}/${stage}#${version}`;
            const attachment = { username, color, pretext, title, text, ts, fields: fields2, footer };

            //! build body for slack, and call
            const body = { attachments: [attachment] };
            return { channel: `${channel || ''}`, body };
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
     * route handler for slack-body per each request-context.
     *
     * @param context the current request-context.
     */
    public $routes = (context: NextContext) => {
        _log(NS, `! route.context =`, $U.json(context));

        //! local cache of channel-model
        const channels: { [key: string]: ChannelModel } = {};
        const _channel = async (name: string): Promise<ChannelModel> => {
            if (channels[name] !== undefined) return channels[name];
            const model = await this.$channel.find(name);
            channels[name] = model;
            return model;
        };
        //! main handler...
        return new (class {
            public constructor(protected service: HelloService) {}
            /** say hello */
            public hello = () => `route-handler/${this.service.hello()}`;
            /** last response of send() */
            public lastResponse: PostResponse = null;

            /** route the slack body to target */
            public route = async (
                body: SlackPostBody,
                channel?: string,
                paths?: string[],
                parent?: ChannelModel,
            ): Promise<number> => {
                channel = channel || body?.channel || 'public';
                paths = paths || [];
                parent = parent ? parent : await _channel(channel);

                //! check of end-of-routing
                if (paths?.includes(channel)) {
                    return this.send(body, channel, parent);
                }

                //! apply rules.
                let sent = 0;
                const $ch = await _channel(channel);
                const rules = $ch?.rules || [];
                for (const i in rules) {
                    const rule = rules[i];
                    const matched = this.match(body, rule);
                    if (matched) {
                        //- duplicate also to other channel
                        if (rule.copyTo && !paths.includes(rule.copyTo)) {
                            paths.push(rule.copyTo);
                            sent += await this.route(matched, rule.copyTo, [...paths], parent);
                        }
                        //- forward to specific channel
                        if (rule.moveTo && !paths.includes(rule.moveTo)) {
                            paths.push(rule.moveTo);
                            sent += await this.route(matched, rule.moveTo, [...paths], parent);
                            // break here.
                            return sent;
                        }
                    }
                }

                //! send via this channel.
                if (channel && !paths.includes(channel)) {
                    paths.push(channel);
                    sent += await this.route(body, channel, [...paths], parent);
                }

                //! returns.
                return sent;
            };

            /** test if pattern is matched */
            public match = (body: SlackPostBody, rule: RouteRule): SlackPostBody => {
                const pattern = `${rule?.pattern || ''}`;
                const _test = (text: string): boolean => {
                    if (!pattern) return false;
                    if (pattern.startsWith('#')) return text.includes(pattern);
                    if (pattern.startsWith('/') && pattern.endsWith('/')) {
                        const re = new RegExp(pattern.substring(1, pattern.length - 2), 'g');
                        return re.test(text);
                    }
                    //! default is word matching
                    return text.split(' ').includes(pattern);
                };
                const matched = body.attachments?.reduce<SlackAttachment[]>((L, N) => {
                    if ((N?.title && _test(N.title)) || (N?.pretext && _test(N.pretext))) {
                        if (rule.color) {
                            L.push({ ...N, color: rule.color });
                        } else {
                            L.push(N);
                        }
                    }
                    return L;
                }, []);
                if (matched.length > 0) {
                    return {
                        ...body,
                        attachments: matched,
                    };
                }
                return;
            };

            /** process per each channel */
            public send = async (body: SlackPostBody, channel: string, parent: ChannelModel): Promise<number> => {
                if (body && channel) {
                    const target = await _channel(channel);
                    const endpoint = target?.endpoint || parent?.endpoint;
                    const message: SlackPostBody = {
                        ...body,
                        channel,
                    };
                    if (endpoint) {
                        const sent = await this.service.postMessage(endpoint, message).catch(e => {
                            _err(NS, `! err.send:${channel} =`, e);
                            return null;
                        });
                        _log(NS, `>> sent:${channel} =`, $U.json(sent));
                        this.lastResponse = sent;
                        return sent?.statusCode == 200 ? 1 : 0;
                    }
                }
                return 0;
            };
        })(this);
    };
}

/**
 * class: `MyCoreManager`
 * - shared core manager for all model.
 * - handle 'name' like unique value in same type.
 */
// eslint-disable-next-line prettier/prettier
export class MyCoreManager<T extends Model, S extends CoreService<T, ModelType>> extends CoreManager<T, ModelType, S> {
    public readonly parent: S;
    public constructor(type: ModelType, parent: S, fields: string[], uniqueField?: string) {
        super(type, parent, fields, uniqueField);
        this.parent = parent;
    }

    /** say hello */
    public hello = () => `${this.storage.hello()}`;

    // override `super.onBeforeSave()`
    public onBeforeSave(model: T, origin: T): T {
        //NOTE! - not possible to change name in here.
        if (origin && origin.name) delete model.name;
        return model;
    }

    /**
     * get model by id
     */
    public async getModelById(id: string): Promise<T> {
        return this.storage.read(id).catch(e => {
            if (`${e.message}`.startsWith('404 NOT FOUND')) throw new Error(`404 NOT FOUND - ${this.type}:${id}`);
            throw e;
        });
    }

    /**
     * validate name format
     * - just check empty string.
     * @param name unique name in same type group.
     */
    public validateName = (name: string): boolean => (this.$unique ? this.$unique.validate(name) : true);

    /**
     * convert to internal id by name
     * @param name unique name in same type group.
     */
    public asIdByName = (name: string): string => (this.$unique ? this.$unique.asLookupId(name) : null);

    /**
     * lookup model by name
     * - use `stereo` property to link with the origin.
     *
     * @param name unique name in same type group.
     */
    public findByName = async (name: string): Promise<T> => {
        if (this.$unique) return this.$unique.findOrCreate(name);
        throw new Error(`400 NOT SUPPORT - ${this.type}:#${name}`);
    };

    /**
     * update name of model
     * - save the origin id into `stereo` property.
     *
     * @param model target model
     * @param name  new name of model.
     */
    public updateName = async (model: T, name: string): Promise<T> => {
        if (!this.validateName(name)) throw new Error(`@name (${name || ''}) is not valid!`);
        if (this.$unique) {
            // STEP.1 try to update loockup 1st.
            const $map = await this.$unique.updateLookup(model, name);
            _log(NS, `> lookup[${model.id}].res =`, $U.json($map));

            // STEP.3 update the name of origin.
            const $upt: Model = { name };
            const updated = await this.storage.update(model.id, $upt as T);
            _log(NS, `> update[${model.id}].res =`, $U.json(updated));

            // FINAL. returns the updated model
            model.name = name;
            model.updatedAt = updated.updatedAt || model.updatedAt;
            return model;
        }
        throw new Error(`400 NOT SUPPORT - ${this.type}:#${name}`);
    };
}

/**
 * class: `MyTestManager`
 * - manager for test-model.
 */
export class MyTestManager extends MyCoreManager<TestModel, HelloService> {
    public constructor(parent: HelloService) {
        super('test', parent, $FIELD.test, 'name');
    }
}

/**
 * class: `MyChannelManager`
 * - manager for channel-model.
 */
export class MyChannelManager extends MyCoreManager<ChannelModel, HelloService> {
    public constructor(parent: HelloService) {
        super('channel', parent, $FIELD.channel);
    }

    /** transform the input data into `route-rule` */
    public asRule = (data: RouteRule): RouteRule => {
        const rule: RouteRule = {
            pattern: $T.S2(data?.pattern, '', ' ').trim(),
        };
        if (data.copyTo !== undefined) rule.copyTo = $T.S2(data?.copyTo, '', ' ').trim();
        if (data.moveTo !== undefined) rule.moveTo = $T.S2(data?.moveTo, '', ' ').trim();
        if (data.color !== undefined) rule.color = $T.S2(data?.color, '', ' ').trim();
        if (data.forward !== undefined) rule.forward = $T.S2(data?.forward, '', ' ').trim();

        return rule;
    };
}

/**
 * class: `MyTargetManager`
 * - manager for target-model.
 */
export class MyTargetManager extends MyCoreManager<TargetModel, HelloService> {
    public constructor(parent: HelloService) {
        super('target', parent, $FIELD.target);
    }
}

//! export default
export default new HelloService();
