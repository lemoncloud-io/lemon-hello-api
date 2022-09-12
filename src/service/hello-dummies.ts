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
import { $U, $T, _log, _inf, _err, AWSS3Service } from 'lemon-core';
import { Metadata } from 'aws-sdk/clients/s3';
import { PutObjectResult, TagSet } from 'lemon-core/dist/cores/aws/aws-s3-service';
import { HelloService, ParamToSlack, RecordData } from './hello-service';
const NS = $U.NS('DUMS', 'blue'); // NAMESPACE TO BE PRINTED.

/**
 * type: `AWSS3Dummy`
 * - working with dummy environment.
 */
class AWSS3Dummy extends AWSS3Service {
    /**
     * override `putObject`
     */
    public putObject = async (
        content: string | Buffer,
        key?: string,
        metadata?: Metadata,
        tags?: TagSet,
    ): Promise<PutObjectResult> => {
        const Bucket = content.toString();
        const Key = key || 'any-key';
        const Location = 's3://dummy';
        return { Bucket, Key, Location, ETag: null };
    };
}

/**
 * class: `DummyHelloService`
 * - provide dummy-service for unit-test.
 */
export class DummyHelloService extends HelloService {
    /**
     * parametered constructor.
     *
     * @param s3
     */
    public constructor(s3: AWSS3Service = new AWSS3Dummy()) {
        super('dummy-table.yml', { s3 });
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

    //TODO - improve test spec by using dummy `kms`.
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
