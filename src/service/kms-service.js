/**
 * kms-service.js
 * - encrypt/decrypt service api with KMS
 *
 * 
 * Author: Steve (steve@lemoncloud.io)
 * Date : 2018-11-20
 *
 * Copyright (C) 2019 Lemoncloud - All Rights Reserved.
 */
module.exports = (function (_$, name, options) {
	"use strict";
	name = name || 'KMS';							// engine service name.

	// core module
	const $U = _$.U; 
	if (!$U) throw new Error('$U is required!');
	
	//! load common(log) functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	// NAMESPACE TO BE PRINTED.
    const NS = $U.NS(name);
    
    //! external service
    const $aws = function() {
        if(!_$.aws) throw new Error('$aws is required!');
        return _$.aws;
    }

	/** ****************************************************************************************************************
	 *  Public Common Interface Exported.
	 ** ****************************************************************************************************************/
    //TODO - load via environ.
    const REGION = 'ap-northeast-2';

    //! check if base64 string.
    const isBase64 = (text) => /^([A-Za-z0-9+/]{4})*([A-Za-z0-9+/]{4}|[A-Za-z0-9+/]{3}=|[A-Za-z0-9+/]{2}==)$/.test(text);

    /**
     * Encrypt message
     *
     * @param {*} message 
     */
    function do_encrypt(message) {
        _inf(NS, 'do_encrypt()..');
        const AWS = $aws();
        const kms = new AWS.KMS({ region: REGION });
        const params = {
            KeyId: 'alias/lemon-hello-api',
            Plaintext: message,
        };
        return kms.encrypt(params).promise()
        .then(result => {
            _log(NS, '> result =', result);
            const ciphertext = result.CiphertextBlob ? (result.CiphertextBlob).toString('base64') : message;
            _log(NS, '> ciphertext[' + message + '] =', ciphertext.substring(0, 32), '...');
            return ciphertext;
        })
    }

    /**
     * Decrypt message
     *
     * @param {*} message 
     */
    function do_decrypt(encryptedSecret) {
        _inf(NS, 'do_decrypt()..');
        const AWS = $aws();
        const kms = new AWS.KMS({ region: REGION });
        encryptedSecret =
            typeof encryptedSecret == 'string'
                    ? isBase64(encryptedSecret)
                    ? Buffer.from(encryptedSecret, 'base64')
                    : encryptedSecret
                : encryptedSecret;
        //! api param.
        const params = {
            CiphertextBlob: encryptedSecret,
        };
        return kms.decrypt(params).promise()
        .then(result => {
            _log(NS, '> result =', result);
            return result.Plaintext ? result.Plaintext.toString() : '';
        })
    }

	//! returns.
	return { do_encrypt, do_decrypt };
});        