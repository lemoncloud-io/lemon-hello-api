/**
 * `sns-service.js`
 * - encrypt/decrypt service api with KMS
 *
 *
 * @author  Steve <steve@lemoncloud.io>
 * @date    2019-07-19 initial version
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
/** ****************************************************************************************************************
 *  Common Headers
 ** ****************************************************************************************************************/
//! load engine
import { $U, _log, _inf, _err } from 'lemon-core';
import AWS from 'aws-sdk';

//! model name;
const name = 'SNS'; // global service name.

// NAMESPACE TO BE PRINTED.
const NS = $U.NS(name, 'blue');

/** ****************************************************************************************************************
 *  Public Common Interface Exported.
 ** ****************************************************************************************************************/
//TODO - load via environ.
const REGION = 'ap-northeast-2';
const $arns = {};

/**
 * hello
 */
export const hello = () => {
    return {
        hello: 'sns-service',
    };
};

/**
 * get current aws account-id.
 *
 * refer: `https://stackoverflow.com/questions/35563270/finding-my-aws-account-id-using-javascript`
 */
const accountID = () => {
    const iam = new AWS.IAM();
    const metadata = new AWS.MetadataService();
    return new Promise((resolve, reject) => {
        iam.getUser({}, (err, data) => {
            if (err) {
                const msg = `${err.message || err}`;
                //! if non-User case. call STS().
                if (msg == 'Must specify userName when calling with non-User credentials') {
                    const sts = new AWS.STS();
                    sts.getCallerIdentity({}, function(err, data) {
                        if (err) {
                            reject('Error', err);
                        } else {
                            resolve(data.Account);
                        }
                    });
                    return;
                }
                //! otherwise, call internal resource. (ECS, EC2)
                _err(NS, '! err@1 =', err);
                //NOTE! - below will be fail in lambda.
                metadata.request('/latest/meta-data/iam/info/', (err, data) => {
                    if (err) reject(err);
                    else resolve(JSON.parse(data).InstanceProfileArn.split(':')[4]);
                });
            } else resolve(data.User.Arn.split(':')[4]);
        });
    });
};

/**
 * get/set arn string of this
 *
 * ```js
 * // get default 'arn'
 * const = $sns.arn();
 *
 * // set 'arn' of 'lemon-hello-sns'
 * const old = $sns.arn('arn:aws:sns:111223344:lemon-hello-sns');
 * ```
 */
export const arn = (_arn = undefined, name = 'lemon-hello-sns') => {
    const arn = $arns[name];
    //! set if _arn is defined.
    if (_arn !== undefined) {
        $arns[name] = _arn;
        return Promise.resolve(arn); // returns old value.
    }
    //! return if cached.
    if (arn) return Promise.resolve(arn);
    return accountID().then(_ => {
        _log(NS, '> account-id =', _);
        const arn = ['arn', 'aws', 'sns', REGION, _, name].join(':');
        $arns[name] = arn;
        return arn;
    });
};

/**
 * publish message
 *
 * @return {string | object}     message-id
 */
export const publish = (subject = '', payload = null) => {
    _inf(NS, `publish(${subject})...`);
    const sns = new AWS.SNS({ region: REGION });
    return arn().then(arn => {
        _log(NS, `> payload[${subject}] =`, $U.json(payload));
        const params = {
            TopicArn: arn,
            Subject: subject,
            Message: JSON.stringify({
                default: payload && typeof payload == 'object' ? JSON.stringify(payload) : payload,
            }),
            MessageStructure: 'json',
        };
        _log(NS, '> params =', params);
        //! call sns.publish()
        return sns
            .publish(params)
            .promise()
            .then(result => {
                _log(NS, `> result[${subject}] =`, result);
                return (result && result.MessageId) || '';
            });
    });
};

/**
 * report error via SNS with subject 'error'
 *
 * @param e             Error instance
 * @param message       simple text message or object to override.
 */
export const reportError = (e, message, force = false) => {
    if (!e) return 'N/A';
    _inf(NS, `reportError(${e}, force=${force})...`);
    _err(NS, '!ERR report =', e);
    e.body && _err(NS, '!ERR issue.errors =', $U.json((e.body && e.body.errors) || e.body));

    //! prepare payload
    const stack = e.stack;
    const errors = (e.body && e.body.errors) || undefined;
    const error = message && typeof message == 'string' ? message : `${e.message || e.statusMessage || e}`;
    const base = message && typeof message == 'object' ? message : {};
    const payload = Object.assign(base, {
        'stack-trace': stack,
        error: error,
        errors,
    });

    //! root of errors.
    const error0 = (errors && errors[0]) || undefined;
    if (error0) {
        payload.message = payload.error;
        payload.error = error0;
    }

    _log(NS, '> payload =', $U.json(payload));
    return publish('error', payload).catch(e => {
        return `ERROR - ${(e && e.message) || e}`;
    });
};
