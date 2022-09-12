/**
 * `hello-dummies.ts`
 * - dummy services for `hello`
 *
 *
 * @author      Tyler <tyler@lemoncloud.io>
 * @date        2020-06-10 refactor with api
 * @date        2020-06-23 optimized with lemon-core#2.2.1
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2022-09-08 supports database w/ manager
 *
 * @copyright (C) 2020 LemonCloud Co Ltd. - All Rights Reserved.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { $U, $T, _log, _inf, _err, SlackAttachment } from 'lemon-core';
import { HelloService, ParamToSlack, RecordData } from './hello-service';
const NS = $U.NS('DUMS', 'blue'); // NAMESPACE TO BE PRINTED.

/**
 * class: `DummyHelloService`
 * - provide dummy-service for unit-test.
 */
export class DummyHelloService extends HelloService {
    public constructor() {
        super('dummy-table.yml');
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
