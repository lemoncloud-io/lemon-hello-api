/**
 * API: `/hello`
 * - public service api
 *
 *
 * @author  Steve Jung <steve@lemoncloud.io>
 * @date    2019-07-19 initial version
 * @date    2019-08-01 refactoring for ts + engine v2.0
 * @date    2019-08-09 optimized with `lemon-core#1.0.1`
 *
 * @copyright (C) 2019 LemonCloud Co Ltd. - All Rights Reserved.
 */
/** ********************************************************************************************************************
 *  Common Headers
 ** ********************************************************************************************************************/
//! import core engine + service.
import { $U, _log, _inf, _err, NextDecoder, NextHanlder } from 'lemon-core';
import { loadJsonSync } from 'lemon-core';

//! define NS, and export default handler().
export const NS = $U.NS('HELO', 'yellow'); // NAMESPACE TO BE PRINTED.
import { $WEB } from 'lemon-core';

//! import dependency
import $engine from '../engine';
import url from 'url';
import https from 'https';

import { $kms, $s3s, $sns } from '../engine';
import AWS from 'aws-sdk';

/** ********************************************************************************************************************
 *  Decode Next Handler
 ** ********************************************************************************************************************/
/**
 * Decode Target Next Handler (promised function).
 *
 * @param {*} MODE 	method
 * @param {*} ID 	id
 * @param {*} CMD 	command
 */
const decode_next_handler: NextDecoder = (MODE, ID, CMD) => {
    const noop = () => {};
    let next = null;
    switch (MODE) {
        case 'LIST':
            next = do_list_hello;
            break;
        case 'GET':
            if (false) noop();
            else if (ID !== '!' && CMD === '') next = do_get_hello;
            else if (ID !== '!' && CMD === 'test-sns') next = do_get_test_sns;
            else if (ID !== '!' && CMD === 'test-sns-arn') next = do_get_test_sns_arn;
            else if (ID !== '!' && CMD === 'test-sns-err') next = do_get_test_sns_err;
            else if (ID !== '!' && CMD === 'test-encrypt') next = do_get_test_encrypt;
            else if (ID !== '!' && CMD === 'test-error') next = do_get_test_error;
            else if (ID !== '!' && CMD === 'test-s3-put') next = do_get_test_s3_put;
            break;
        case 'PUT':
            if (false) noop();
            else if (ID !== '!' && CMD === '') next = do_put_hello;
            break;
        case 'POST':
            if (false) noop();
            else if (ID !== '!' && CMD === '') next = do_post_hello;
            else if (ID !== '!' && CMD === 'slack') next = do_post_hello_slack;
            else if (ID === '!' && CMD === 'event') next = do_post_hello_event;
            break;
        case 'DELETE':
            if (false) noop();
            else if (ID !== '!' && CMD === '') next = do_delete_hello;
            break;
        case 'EVENT':
            break;
        // For WSS. use dummy handler.
        case 'CONNECT':
        case 'DISCONNECT':
            return async () => 'ok';
        default:
            break;
    }
    return next;
};
export default $WEB(NS, decode_next_handler);

/** ********************************************************************************************************************
 *  Local Functions.
 ** ********************************************************************************************************************/
//! shared memory.
// WARN! - `serverless offline`는 상태를 유지하지 않으므로, NODES값들이 실행때마다 리셋이될 수 있음.
const NODES = [
    {
        name: 'lemon',
    },
    {
        name: 'cloud',
    },
];

/**
 * POST message to hookUrl.
 *
 * @param {*} hookUrl       URL
 * @param {*} message       Object or String.
 */
export const postMessage = (hookUrl: string, message: any) => {
    const body = typeof message === 'string' ? message : JSON.stringify(message);
    const options: any = url.parse(hookUrl);
    options.method = 'POST';
    options.headers = {
        'Content-Type': 'application/json',
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
                _log(NS, `> post(${hookUrl}) =`, result);
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
const $channels: any = {};
export const do_load_slack_channel = (name: string): Promise<string> => {
    const ENV_NAME = `SLACK_${name}`.toUpperCase();
    const $env = process.env || {};
    const webhook = `${$channels[ENV_NAME] || $env[ENV_NAME] || ''}`.trim();
    _inf(NS, `> webhook[${name}] :=`, webhook);
    if (!webhook) return Promise.reject(new Error(`env[${ENV_NAME}] is required!`));
    return Promise.resolve(webhook)
        .then(_ => {
            if (!_.startsWith('http')) {
                return $kms.decrypt(_).then(_ => {
                    const url = `${_}`.trim();
                    $channels[ENV_NAME] = url;
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

export const asText = (data: any): string => {
    const keys = (data && Object.keys(data)) || [];
    return keys.length > 0 ? JSON.stringify(data) : '';
};

//! post to slack channel.
export const do_post_slack = (
    pretext: string = '',
    title: string = '',
    text: string = '',
    fields: string[] = [],
    color: string = '',
    username: string = '',
) => {
    color = color || '#FFB71B';
    username = username || 'hello-alarm';

    //! build attachment.
    const attachment = {
        username,
        color,
        pretext,
        title,
        text,
        ts: Math.floor(new Date().getTime() / 1000),
        fields,
    };

    //! build body for slack, and call
    const body = { attachments: [attachment] };
    return do_post_hello_slack('public', {}, body);
};

export const chain_post_slack = ({ pretext, title, text, fields, color, username }: { [key: string]: any }) => {
    return do_post_slack(pretext, title, text, fields, color, username);
};

//! chain for ALARM type. (see data/alarm.jsonc)
export const chain_process_alarm = ({ subject, data, context }: { subject: string; data: any; context: any }) => {
    _log(`chain_process_alarm(${subject})...`);
    data = data || {};
    _log('> data=', data);

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
    const text = asText(data);
    const fields = Fields;

    return do_post_slack(pretext, title, text, fields);
};

//! chain for DeliveryFailure type. (see data/delivery-failure.json)
export const chain_process_delivery_failure = ({
    subject,
    data,
    context,
}: {
    subject: string;
    data: any;
    context: any;
}) => {
    _log(`chain_process_delivery_failure(${subject})...`);
    data = data || {};
    _log('> data=', data);

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

    //! get get-endpoint-attributes
    const local_chain_endpoint_attrs = (that: any) => {
        const SNS = new AWS.SNS();
        return SNS.getEndpointAttributes({ EndpointArn })
            .promise()
            .then(_ => {
                _log(NS, '> EndpointAttributes=', _);
                const Attr = (_ && _.Attributes) || {};
                that.fields.push({ title: 'Enabled', value: Attr.Enabled || '', short: true });
                that.fields.push({ title: 'CustomUserData', value: Attr.CustomUserData || '', short: true });
                that.fields.push({ title: 'Token', value: Attr.Token || '', short: false });
                return that;
            })
            .catch(e => {
                _err(NS, '!ERR EndpointAttributes=', e);
                return that;
            });
    };

    // return do_post_slack(pretext, title, text, fields)
    const message = { pretext, title, text, fields };
    return Promise.resolve(message)
        .then(local_chain_endpoint_attrs)
        .then(chain_post_slack);
};

//! chain for ALARM type. (see data/alarm.jsonc)
export const chain_process_error = ({ subject, data, context }: { subject: string; data: any; context: any }) => {
    _log(`chain_process_error(${subject})...`);
    data = data || {};
    _log('> data=', data);

    //! get error reason.
    const message = data.message || data.error;

    //NOTE - DO NOT CHANGE ARGUMENT ORDER.
    return do_post_slack(message, 'error-report', asText(data), []);
};

//! chain for ALARM type. (see data/alarm.jsonc)
export const chain_process_callback = ({ subject, data, context }: { subject: string; data: any; context: any }) => {
    _log(`chain_process_callback(${subject})...`);
    data = data || {};
    _log('> data=', data);

    //NOTE - DO NOT CHANGE ARGUMENT ORDER.
    return do_post_slack('', 'callback-report', asText(data), [], '#B71BFF');
};

//! chain to save message data to S3.
export const do_chain_message_save_to_s3 = (message: any) => {
    const SLACK_PUT_S3 = $U.N($U.env('SLACK_PUT_S3'), 0);
    _log(NS, `do_chain_message_save_to_s3(${SLACK_PUT_S3})...`);
    const attachments = message.attachments;
    if (SLACK_PUT_S3 && attachments && attachments.length) {
        const attachment = attachments[0] || {};
        const pretext = attachment.pretext || '';
        const title = attachment.title || '';
        const color = attachment.color || 'green';
        _log(NS, `> title[${pretext}] =`, title);
        const data = Object.assign({}, message); // copy.
        data.attachments = data.attachments.map((_: any) => {
            _ = Object.assign({}, _); // copy.
            const text = `${_.text}`;
            if (text.startsWith('{') && text.endsWith('}')) _.text = JSON.parse(_.text);
            if (_.text['stack-trace'] && typeof _.text['stack-trace'] == 'string')
                _.text['stack-trace'] = _.text['stack-trace'].split('\n');
            return _;
        });
        const json = JSON.stringify(data);
        return $s3s
            .putObject(json)
            .then(res => {
                const { Bucket, Key, Location } = res;
                _inf(NS, `> uploaded[${Bucket}] =`, res);
                const link = Location;
                const _pretext = title == 'error-report' ? title : pretext;
                const text = title == 'error-report' ? pretext : title;
                const tag = [':slack:', ':cubimal_chick:', ':rotating_light:'][2];
                message = {
                    attachments: [
                        {
                            pretext: _pretext,
                            text: `<${link}|${tag}> ${text}`,
                            color,
                            mrkdwn: true,
                            mrkdwn_in: ['pretext', 'text'],
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

/** ********************************************************************************************************************
 *  Public API Functions.
 ** ********************************************************************************************************************/
/**
 * Search by params
 *
 * ```sh
 * $ http ':8888/hello/'
 * ```
 * @param {*} ID 			id of object
 * @param {*} $param		query parameters (json)
 * @param {*} $body			body parameters (json)
 * @param {*} $ctx			context (optional)
 */
export const do_list_hello: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_list_hello(${ID})....`);

    const that: any = {};
    that.name = $U.env('NAME'); // read via process.env
    return Promise.resolve(that).then(_ => {
        _.list = NODES;
        return _;
    });
};

/**
 * Read the detailed object.
 *
 * ```sh
 * $ http ':8888/hello/0'
 */
export const do_get_hello: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_get_hello(${ID})....`);

    const id = $U.N(ID, 0);
    const node = NODES[id];
    if (!node) return Promise.reject(new Error(`404 NOT FOUND - id:${id}`));
    return Promise.resolve(node).then(_ => {
        const node: any = Object.assign({}, _); // copy node.
        node._id = id;
        return node;
    });
};

/**
 * Only Update with incremental support
 *
 * ```sh
 * $ echo '{"size":1}' | http PUT ':8888/hello/1'
 */
export const do_put_hello: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_put_hello(${ID})....`);
    $param = $param || {};

    return do_get_hello(ID, null, null, $ctx).then(node => {
        const id = node._id;
        Object.assign(NODES[id], $body || {});
        return Object.assign(node, $body || {});
    });
};

/**
 * Insert new Node at position 0.
 *
 * ```sh
 * $ echo '{"name":"lemoncloud"}' | http POST ':8888/hello/0'
 */
export const do_post_hello: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_post_hello(${ID})....`);
    $param = $param || {};
    if (!$body && !$body.name) return Promise.reject(new Error('.name is required!'));

    return Promise.resolve($body).then(node => {
        NODES.push(node);
        return NODES.length - 1; // returns ID.
    });
};

/**
 * Post message via Slack Web Hook
 *
 * ```sh
 * # post message to slack/general
 * $ echo '{"text":"hello"}' | http ':8888/hello/public/slack'
 * $ echo 'hahah' | http ':8888/hello/public/slack'
 *
 * # use sample
 * $ cat data/error-hello.json | http ':8888/hello/public/slack'
 * ```
 * @param {*} ID                slack-channel id (see environment)
 * @param {*} $param            (optional)
 * @param {*} $body             {error?:'', message:'', data:{...}}
 * @param {*} $ctx              context
 */
export const do_post_hello_slack: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_post_hello_slack(${ID})....`);
    _log(NS, '> body =', $body);
    $param = $param || {};

    //! load target webhook via environ.
    return do_load_slack_channel(ID).then(webhook => {
        _log(NS, '> webhook :=', webhook);
        //! prepare slack message via body.
        const message = typeof $body === 'string' ? { text: $body } : $body;
        return Promise.resolve(message)
            .then(do_chain_message_save_to_s3)
            .then(message => postMessage(webhook, message));
    });
};

/**
 * Event Handler via SNS
 *
 * ```sh
 * # alarm data
 * $ cat data/alarm.json | http ':8888/hello/!/event?subject=ALARM: test'
 * # delivery failure
 * $ cat data/delivery-failure.json | http ':8888/hello/!/event?subject=DeliveryFailure test'
 * # error case
 * $ cat data/error-1.json | http ':8888/hello/!/event?subject=error'
 * $ cat data/error-2.json | http ':8888/hello/!/event?subject=error'
 */
export const do_post_hello_event: NextHanlder = (id, $param, $body, $ctx) => {
    _inf(NS, `do_post_hello_event(${id})....`);
    $param = $param || {};
    const subject = `${$param.subject || ''}`;
    const data = $body;
    const context = $ctx;
    const noop = (_: any) => _;

    //! decode next-chain.
    const chain_next = false
        ? null
        : subject.startsWith('ALARM:')
        ? chain_process_alarm
        : subject.startsWith('DeliveryFailure')
        ? chain_process_delivery_failure
        : subject === 'error'
        ? chain_process_error
        : subject === 'callback'
        ? chain_process_callback
        : noop;

    return Promise.resolve({ subject, data, context }).then(chain_next);
};

/**
 * Delete Node (or mark deleted)
 *
 * ```sh
 * $ http DELETE ':8888/hello/1'
 */
export const do_delete_hello: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_delete_hello(${ID})....`);

    return do_get_hello(ID, null, null, $ctx).then(node => {
        const id = node._id;
        if (id === undefined) return Promise.reject(new Error('._id is required!'));
        // NODES.splice(id, 1);                // remove single node.
        delete NODES[id]; // set null in order to keep id.
        return node;
    });
};

/**
 * Read the detailed object.
 *
 * ```sh
 * $ http ':8888/hello/alarm/test-sns'
 * $ http ':8888/hello/failure/test-sns'
 */
export const do_get_test_sns: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_get_test_sns(${ID})....`);

    //! build event body, then start promised
    const build_event_chain = (subject: string, data: any) => {
        //! clear internals
        data = Object.keys(data).reduce((N: any, key) => {
            if (!key.startsWith('!')) N[key] = data[key];
            return N;
        }, {});
        //! prepare event body.
        const event = {
            Records: [
                {
                    Sns: {
                        Subject: subject || 'ALARM: "...." in Asia Pacific (Seoul)',
                        Message: data,
                    },
                },
            ],
        };
        return Promise.resolve(event);
    };

    //! call sns handler.
    const local_chain_handle_sns = (event: any) => {
        const SNS = $engine.SNS;
        if (!SNS) return Promise.reject(new Error('.SNS is required!'));

        //! validate event
        event = event || {};
        if (!event.Records || !Array.isArray(event.Records))
            return Promise.reject(new Error('.Records[] is required!'));
        if (!event.Records[0] || !event.Records[0].Sns)
            return Promise.reject(new Error('.Records[0].Sns is required!'));
        if (!event.Records[0].Sns.Subject || !event.Records[0].Sns.Message)
            return Promise.reject(new Error('.Records[0].Sns.Subject is required!'));

        //! call handler.
        return new Promise((resolve, reject) => {
            SNS(event, $ctx, (err, res) => {
                if (err) reject(err);
                else resolve(res);
            });
        });
    };

    //! decode by ID
    return (() => {
        if (ID == 'alarm') {
            const data = loadJsonSync('data/alarm.json');
            return build_event_chain('ALARM: "...." in Asia Pacific (Seoul)', data);
        }
        if (ID == 'failure') {
            const data = loadJsonSync('data/delivery-failure.json');
            return build_event_chain(data['!Subject'] || 'DeliveryFailure', data);
        }
        return Promise.reject(new Error(`404 NOT FOUND - test-sns:${ID}`));
    })().then(local_chain_handle_sns);
};

/**
 * Test SNS ARN
 *
 * ```sh
 * $ http ':8888/hello/0/test-sns-arn'
 */
export const do_get_test_sns_arn: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_get_test_sns_arn(${ID})....`);
    return $sns.endpoint('').then(arn => {
        _log(NS, '> arn =', arn);
        return { arn };
    });
};

/**
 * Test SNS Report Error
 *
 * ```sh
 * $ http ':8888/hello/0/test-sns-err'
 */
export const do_get_test_sns_err: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_get_test_sns_err(${ID})....`);
    const e = new Error('Test Error');
    return $sns.reportError(e, undefined, undefined).then(mid => {
        _log(NS, '> message-id =', mid);
        return { mid };
    });
};

/**
 * Encrypt Test.
 *
 * ```sh
 * $ http ':8888/hello/0/test-encrypt'
 */
export const do_get_test_encrypt: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_get_test_encrypt(${ID})....`);
    const message = 'hello lemon';
    return $kms
        .encrypt(message)
        .then(encrypted => $kms.decrypt(encrypted).then(decrypted => ({ encrypted, decrypted, message })))
        .then(_ => {
            const result = _.encrypted && _.message === _.decrypted;
            return Object.assign(_, { result });
        });
};

/**
 * Raise Error
 *
 * ```sh
 * $ http ':8888/hello/0/test-error'
 */
export const do_get_test_error: NextHanlder = async (ID, $param, $body, $ctx) => {
    _log(NS, `do_get_test_error(${ID})....`);
    throw new Error('hello lemon');
};

/**
 * Test S3 PutObject.
 *
 * ```sh
 * $ http ':8888/hello/0/test-s3-put'
 */
export const do_get_test_s3_put: NextHanlder = (ID, $param, $body, $ctx) => {
    _log(NS, `do_get_test_s3_put(${ID})....`);
    const message = 'hello lemon';
    const data = { message };
    const json = JSON.stringify(data);
    // return $s3s.putObject(json, 'test.json', 'application/json');
    return $s3s.putObject(json);
};
