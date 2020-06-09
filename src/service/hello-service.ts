/**
 * `hello-service.js`
 * - common service for `hello`
 *
 *
 * @author      Tyler <tyler@lemoncloud.io>
 * @copyright (C) 2020 LemonCloud Co Ltd. - All Rights Reserved.
 */
import $engine, { _log, _inf, _err, $U, $_, GETERR, ProtocolBody } from 'lemon-core';
import { doReportSlack, NextMode, StorageMakeable, UniqueFieldManager, SlackPostBody } from 'lemon-core';
import {
    GeneralModelFilter,
    NextContext,
    SlackAttachment,
    CoreModelFilterable,
    ProtocolService,
    ProtocolParam,
    CallbackParam,
    DynamoService,
    Elastic6Service,
    Elastic6QueryService,
    Elastic6Option,
    CronParam,
    GeneralKeyMaker,
    ProxyStorageService,
    TypedStorageService,
} from 'lemon-core';
const NS = $U.NS('HLL', 'blue'); // NAMESPACE TO BE PRINTED.

//! import dependency
import url from 'url';
import https from 'https';
import AWS from 'aws-sdk';

/** ********************************************************************************************************************
 *  Core Service Instances
 ** ********************************************************************************************************************/
import { AWSKMSService, AWSS3Service, AWSSNSService } from 'lemon-core';
const $kms = new AWSKMSService();
const $sns = new AWSSNSService();
const $s3s = new AWSS3Service();

export interface RecordChainData {
    subject: string;
    data: any;
    context: any;
}

export interface RecordChainWork {
    (param: RecordChainData): Promise<any>;
}

export interface HelloProxyService {
    hello(): string;
    postMessage(hookUrl: string, message: any): Promise<any>;
    do_load_slack_channel(name: string, defName?: string): Promise<string>;
    do_chain_message_save_to_s3(message: any): any;
}

export class HelloService implements HelloProxyService {
    public $channels: any = {};

    public hello = () => `hello-service`;
    /**
     * POST message to hookUrl.
     *
     * @param {*} hookUrl       URL
     * @param {*} message       Object or String.
     */
    public postMessage = (hookUrl: string, message: any) => {
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
    public do_load_slack_channel = (name: string, defName?: string): Promise<string> => {
        const ENV_NAME = `SLACK_${name}`.toUpperCase();
        const ENV_DEFAULT = defName ? `SLACK_${defName}`.toUpperCase() : '';
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
                    return $kms.decrypt(_).then(_ => {
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

    public asText = (data: any): string => {
        const keys = (data && Object.keys(data)) || [];
        return keys.length > 0 ? JSON.stringify(data) : '';
    };

    //! chain to save message data to S3.
    public do_chain_message_save_to_s3 = (message: any) => {
        const val = $U.env('SLACK_PUT_S3', '1') as string;
        const SLACK_PUT_S3 = $U.N(val, 0);
        _log(NS, `do_chain_message_save_to_s3(${SLACK_PUT_S3})...`);
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
            const MOONS = ':new_moon:,:waxing_crescent_moon:,:first_quarter_moon:,:moon:,:full_moon:,:waning_gibbous_moon:,:last_quarter_moon:,:waning_crescent_moon:'.split(
                ',',
            );
            const CLOCKS = ':clock12:,:clock1230:,:clock1:,:clock130:,:clock2:,:clock230:,:clock3:,:clock330:,:clock4:,:clock430:,:clock5:,:clock530:,:clock6:,:clock630:,:clock7:,:clock730:,:clock8:,:clock830:,:clock9:,:clock930:,:clock10:,:clock1030:,:clock11:,:clock1130:'.split(
                ',',
            );
            const now = new Date();
            const hour = now.getHours();
            const tag = 0 ? TAGS[2] : MOONS[Math.floor((MOONS.length * hour) / 24)];
            const json = JSON.stringify(data);
            return $s3s
                .putObject(json)
                .then(res => {
                    const { Bucket, Key, Location } = res;
                    _inf(NS, `> uploaded[${Bucket}] =`, res);
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
}

export class HelloMocksService implements HelloProxyService {
    public hello = () => `hello-mocks-service`;

    public postMessage(hookUrl: string, message: any): Promise<any> {
        throw new Error('Method not implemented.');
    }

    public do_load_slack_channel(name: string, defName?: string): Promise<string> {
        throw `https://hooks.slack.com/services/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`;
    }

    public do_chain_message_save_to_s3(message: any) {
        throw new Error('Method not implemented.');
    }
}

export default class MyHelloService implements HelloProxyService {
    public service: HelloProxyService;
    public constructor(type: string = '') {
        this.service = type == 'dummy' ? new HelloService() : new HelloService();
    }

    public hello = () => this.service.hello();

    public postMessage(hookUrl: string, message: any): Promise<any> {
        throw new Error('Method not implemented.');
    }
    public do_load_slack_channel(name: string, defName?: string): Promise<string> {
        return this.service.do_load_slack_channel(name, defName);
    }
    public do_chain_message_save_to_s3(message: any) {
        throw new Error('Method not implemented.');
    }
}
