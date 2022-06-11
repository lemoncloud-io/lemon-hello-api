/**
 * `hello-service.ts`
 * - common service for `hello`
 *
 *
 * @author      Tyler <tyler@lemoncloud.io>
 * @date        2020-06-10 refactor with api
 * @date        2020-06-23 optimized with lemon-core#2.2.1
 *
 * @copyright (C) 2020 LemonCloud Co Ltd. - All Rights Reserved.
 */
import { _log, _inf, _err, $U } from 'lemon-core';
import {
    APIService,
    SlackAttachment,
    AWSKMSService,
    AWSS3Service,
    AWSSNSService,
    SlackPostBody,
    $info,
} from 'lemon-core';

//! import dependency
import https from 'https';
import AWS from 'aws-sdk';
import url from 'url';
import { CallbackSlackData, CallbackPayload } from '../common/types';
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

/**
 * class: `HelloService`
 * - catch `report-error` via SNS, then save into S3 and post to slack.
 */
export class HelloService {
    protected $channels: any = {};
    protected $kms: AWSKMSService;
    protected $sns: AWSSNSService;
    protected $s3s: AWSS3Service;

    public constructor($kms?: AWSKMSService, $sns?: AWSSNSService, $s3s?: AWSS3Service) {
        this.$kms = $kms || new AWSKMSService();
        this.$sns = $sns || new AWSSNSService();
        this.$s3s = $s3s || new AWSS3Service();
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
    public postMessage = async (hookUrl: string, message: any) => {
        _log(NS, `> postMessage = hookUrl[${hookUrl}]`);
        message = typeof message == 'object' && message instanceof Promise ? await message : message;
        _log(NS, `> message = `, $U.json(message));

        const body = (typeof message == 'string' ? message : JSON.stringify(message)) || '';
        const options: any = url.parse(hookUrl);
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

    //! store channel map in cache
    public loadSlackChannel = async (name: string, defName?: string): Promise<string> => {
        const ENV_NAME = `SLACK_${name || 'public'}`.toUpperCase();
        const ENV_DEFAULT = defName ? `SLACK_${defName || 'default'}`.toUpperCase() : '';
        const $env = process.env || {};
        // NOTE channel cache를 이렇게 사용해도 되나?
        const webhook_name = `${this.$channels[ENV_NAME] || $env[ENV_NAME] || ''}`.trim();
        const webhook_default = `${this.$channels[ENV_DEFAULT] || $env[ENV_DEFAULT] || ''}`.trim();
        const webhook = webhook_name || webhook_default;
        _inf(NS, `> webhook[${name}] :=`, webhook);
        if (!webhook) return Promise.reject(new Error(`env[${ENV_NAME}] is required!`));
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
                    throw new Error(`404 NOT FOUND - Channel:${name}`);
                }
                return _;
            });
    };

    public getSubscriptionConfirmation = async (param: { snsMessageType: string; subscribeURL: string }) => {
        _log(NS, `getSubscriptionConfirmation()...`);
        // Send HTTP GET to subscribe URL in request for subscription confirmation
        if (param.snsMessageType == 'SubscriptionConfirmation' && param.subscribeURL) {
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

    public asText = (data: any) => {
        const keys = (data && Object.keys(data)) || [];
        return keys.length > 0 ? JSON.stringify(data) : '';
    };

    //! chain to save message data to S3.
    public saveMessageToS3 = async (message: any) => {
        _log(NS, `saveMessageToS3()...`);
        const val = $U.env('SLACK_PUT_S3', '1') as string;
        const SLACK_PUT_S3 = $U.N(val, 0);
        const attachments: SlackAttachment[] = (message && message.attachments) || [];

        //! if put to s3, then filter attachments
        if (SLACK_PUT_S3 && attachments && attachments.length > 0) {
            const attachment = attachments[0] || {};
            const pretext = attachment.pretext || '';
            const title = attachment.title || '';
            const color = attachment.color || 'green';
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
            const now = new Date();
            let hour = now.getHours() + now.getMinutes() / 60.0 + 1.0;
            hour = hour >= 24 ? hour - 24 : hour;
            const tag = MOONS[Math.floor((MOONS.length * hour) / 24)];
            const json = $U.json(saves);
            // _log(NS, `> json =`, json);
            return this.$s3s
                .putObject(json)
                .then(res => {
                    const { Bucket, Key, Location } = res;
                    _inf(NS, `> uploaded[${Bucket}] =`, $U.json(res));
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

    //! post to slack channel(default is public).
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
            const fields2 = fields.map((F, i) =>
                typeof F === 'string'
                    ? { title: `${F || ''}`.split('/')[0] || `${i + 1}`, value: F }
                    : { ...(F as any) },
            );
            const footer = `${service}/${stage}#${version}`;
            const attachment = { username, color, pretext, title, text, ts, fields: fields2, footer };

            //! build body for slack, and call
            const body = { attachments: [attachment] };
            return { channel: `${channel || ''}`, body };
        };

    //! post to slack default channel.
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
}

/**
 * class: `DummyHelloService`
 * - provide dummy-service for unit-test.
 */
export class DummyHelloService extends HelloService {
    public constructor() {
        super();
        this.$channels = {
            SLACK_AA: 'https://hooks.slack.com/services/AAAAAAAAA/BBBBBBBBB/CCCCCCCCCCCCCCCC',
        };
    }

    public hello = () => `hello-mocks-service`;

    /**
     *  {
     *      "body": "ok",
     *      "statusCode": 200,
     *      "statusMessage": "OK"
     *  }
     */
    public postMessage = async (hookUrl: string, message: any) => {
        return new Promise(resolve => {
            const body = 'ok';
            const statusCode = 200;
            const statusMessage = 'OK';
            const result = { body, statusCode, statusMessage };
            resolve(result);
        });
    };

    //! store channel map in cache
    public loadSlackChannel = async (name: string, defName?: string): Promise<string> => {
        const ENV_NAME = `SLACK_${name}`.toUpperCase();
        const ENV_DEFAULT = defName ? `SLACK_${defName}`.toUpperCase() : '';
        const $env = process.env || {};
        const webhook_name = `${this.$channels[ENV_NAME] || $env[ENV_NAME] || ''}`.trim();
        const webhook_default = `${this.$channels[ENV_DEFAULT] || $env[ENV_DEFAULT] || ''}`.trim();
        const webhook = webhook_name || webhook_default;
        _inf(NS, `> webhook[${name}] :=`, webhook);
        if (!webhook) return Promise.reject(new Error(`env[${ENV_NAME}] is required!`));
        return Promise.resolve(webhook)
            .then(() => {
                // dummy url
                return 'https://hooks.slack.com/services/AAAAAAAAA/BBBBBBBBB/CCCCCCCCCCCCCCCC';
            })
            .then(_ => {
                if (!(_ && _.startsWith('http'))) {
                    throw new Error(`404 NOT FOUND - Channel:${name}`);
                }
                return _;
            });
    };

    public getSubscriptionConfirmation = async (param: { snsMessageType: string; subscribeURL: string }) => {
        _log(NS, `getSubscriptionConfirmation()...`);
        // Send HTTP GET to subscribe URL in request for subscription confirmation
        if (param.snsMessageType == 'SubscriptionConfirmation' && param.subscribeURL) {
            const res = { subscribe: true };
            _log(NS, `> subscribe =`, $U.json(res));
            return 'OK';
        }
        return 'PASS';
    };

    //! chain to save message data to S3.
    public saveMessageToS3 = async (message: any) => {
        const val = $U.env('SLACK_PUT_S3', '1') as string;
        const SLACK_PUT_S3 = $U.N(val, 0);
        _log(NS, `saveMessageToS3(${SLACK_PUT_S3})...`);
        const attachments: SlackAttachment[] = message.attachments;

        //! if put to s3, then filter attachments
        if (SLACK_PUT_S3 && attachments && attachments.length) {
            const attachment = attachments[0] || {};
            const pretext = attachment.pretext || '';
            const title = attachment.title || '';
            const color = attachment.color || 'green';
            const thumb_url = attachment.thumb_url ? attachment.thumb_url : undefined;
            _log(NS, `> title[${pretext}] =`, title);
            const data = Object.assign({}, message); // copy.
            data.attachments = data.attachments.map((_: any) => {
                //! convert internal data.
                _ = Object.assign({}, _); // copy.
                const text = `${_.text || ''}`;
                try {
                    if (text.startsWith('{') && text.endsWith('}')) _.text = JSON.parse(_.text);
                    if (_.text && _.text['stack-trace'] && typeof _.text['stack-trace'] == 'string')
                        _.text['stack-trace'] = _.text['stack-trace'].split('\n');
                } catch (e) {
                    _err(NS, '> WARN! ignored =', e);
                }
                return _;
            });
            const TAGS = [':slack:', ':cubimal_chick:', ':rotating_light:'];
            const MOONS =
                ':new_moon:,:waxing_crescent_moon:,:first_quarter_moon:,:moon:,:full_moon:,:waning_gibbous_moon:,:last_quarter_moon:,:waning_crescent_moon:'.split(
                    ',',
                );
            const CLOCKS =
                ':clock12:,:clock1230:,:clock1:,:clock130:,:clock2:,:clock230:,:clock3:,:clock330:,:clock4:,:clock430:,:clock5:,:clock530:,:clock6:,:clock630:,:clock7:,:clock730:,:clock8:,:clock830:,:clock9:,:clock930:,:clock10:,:clock1030:,:clock11:,:clock1130:'.split(
                    ',',
                );
            const now = new Date();
            const hour = now.getHours();
            const tag = 0 ? TAGS[2] : MOONS[Math.floor((MOONS.length * hour) / 24)];
            return Promise.resolve(data)
                .then(res => {
                    const { Bucket, Key, Location } = res;
                    _inf(NS, `> uploaded[${Bucket}]@2 =`, $U.json(res));
                    const link = Location;
                    const _pretext = title == 'error-report' ? title : pretext;
                    const text = title == 'error-report' ? pretext : title;
                    const tag0 = `${text}`.startsWith('#error') ? ':rotating_light:' : '';
                    message = {
                        attachments: [
                            {
                                pretext: _pretext,
                                text: `<${link}|${tag0 || tag || '*'}> ${text}`,
                                color,
                                mrkdwn: true,
                                mrkdwn_in: ['pretext', 'text'],
                                thumb_url,
                            },
                        ],
                    };
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
        const result = await Promise.resolve({ EndpointArn })
            .then(_ => {
                _log(NS, '> EndpointAttributes=', _);
                message.fields.push({ title: 'Enabled', value: 'on', short: true });
                message.fields.push({
                    title: 'CustomUserData',
                    value: Math.floor(new Date().getTime() / 1000),
                    short: true,
                });
                message.fields.push({ title: 'Token', value: '1234-1234-1234-1234', short: false });
                return message;
            })
            .catch(e => {
                _err(NS, '!ERR EndpointAttributes=', e);
                return message;
            });

        // package default.
        return this.packageDefaultChannel(result);
    };
}

//! export default
export default new HelloService();
