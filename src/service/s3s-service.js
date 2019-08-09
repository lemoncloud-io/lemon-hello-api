/**
 * `s3s-service.js`
 * - common S3 services.
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

//! model name;
const name = 'S3S'; // global service name.

// NAMESPACE TO BE PRINTED.
const NS = $U.NS(name, 'blue');

//! external service
const $aws = function() {
    if (!_$.aws) throw new Error('$aws is required!');
    return _$.aws;
};

/** ****************************************************************************************************************
 *  Public Common Interface Exported.
 ** ****************************************************************************************************************/
//TODO - load via environ.
const region = 'ap-northeast-2';

/**
 * hello
 */
export const hello = () => {
    return {
        hello: 's3s-service',
    };
};

//! get aws client for S3
const instance = () => {
    const AWS = $aws();
    const config = { region };
    return new AWS.S3(config); // SQS Instance. shared one???
};

//! translate to real s3 arn by id.
const bucketId = () => {
    //TODO - use `env/config#bucket` configuration.
    const name = 'lemon-hello-www';
    return `${name}`;
};

/**
 * upload a file to S3 Bucket
 *
 * ```js
 * const res = $s3s().putObject(JSON.stringify({ message }), 'test.json', 'application/json');
 * // response would be like
 * {
 *  "Bucket": "lemon-hello-www",
 *  "ETag": "5e206.....8bd4c",
 *  "Key": "test.json",
 *  "Location": "https://lemon-hello-www.s3.ap-northeast-2.amazonaws.com/test.json",
 *  "key": "test.json"
 * }
 * ```
 *
 * @param {string} bucketId
 * @param {string} fileName
 * @param {string} fileStream
 * @param {object} tags             (optional) tags to save.
 */
export async function putObject(fileStream, fileName = '', contentType = 'application/json', tags = null) {
    _log(NS, `putObject(${fileName})...`);
    if (!fileStream) throw new Error('filestream is required!');
    // if (!fileName) throw new Error('filename is required!');

    //! get unique file name.
    fileName = fileName || `${this.nextId()}.json`;

    const params = { Bucket: bucketId(), Key: fileName, Body: fileStream };
    const options = {};

    if (contentType) params.ContentType = contentType;
    if (tags && typeof tags == 'object') {
        options.tags = Object.keys(tags).reduce((L, key) => {
            const val = tags[key];
            L.push({ Key: key, Value: `${val}` });
            return L;
        }, []);
    }

    //! call s3.upload.
    // _log(NS, '> params =', params);
    return new Promise((resolve, reject) => {
        instance().upload(params, options, function(err, data) {
            if (err) return reject(err);
            resolve(data);
        });
    })
        .then(data => {
            _log(NS, 'data.key:', (data && data.Key) || '#NOP');
            return data;
        })
        .catch(e => {
            _err(NS, 'ERR! err=', e);
            throw e;
        });
}

/**
 * get a file from S3 Bucket
 *
 * @param {string} bucketId
 * @param {string} fileName
 */
export async function getObject(fileName) {
    if (!fileName) throw new Error('filename is required!');

    const params = { Bucket: bucketId(), Key: fileName };

    //! call s3.getObject.
    // _log(NS, '> params =', params);
    return new Promise((resolve, reject) => {
        instance().getObject(params, function(err, data) {
            if (err) return reject(err);
            resolve(data);
        });
    }).catch(e => {
        _err(NS, 'ERR! err=', e);
        throw e;
    });
}

export function nextId() {
    const uuidv4 = require('uuid/v4');
    return uuidv4();
}
