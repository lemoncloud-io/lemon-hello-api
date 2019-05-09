/**
 * bootload.js
 * - basic bootloader for API handler.
 * 
 * use like below in api
 * ```js
 * const NS = 'ME';
 * const main = require('./bootload')(_$, NS, decode_next_handler);
 * ...
 * return main;
 * ```
 * 
 * @author  Steve <steve@lemoncloud.io)
 * @date    2019-03-14
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
/** ********************************************************************************************************************
 *  MAIN EXPORTS
 ** ********************************************************************************************************************/
/**
 * basic handler function for lambda serverless
 * 
 * @param {*} _$       instance manager
 * @param {*} NS       name-space to print
 * @param {*} decode_next_handler  next handler.
 */
exports = module.exports = (function (_$, NS, decode_next_handler) {
    if (!_$) throw new Error('_$(global instance pool) is required!');
    if (!NS) throw new Error('NS (name-space) is required!');
    if (!decode_next_handler) throw new Error('decode_next_handler is required!');
    if (typeof decode_next_handler != 'function') throw new Error('decode_next_handler(function) is required!');

	//! load services (_$ defined in global)
	const $_ = _$._;                                // re-use global instance (lodash).
	const $U = _$.U;                                // re-use global instance (utils).

	//! load common(log) functions
	const _log = _$.log;
	const _inf = _$.inf;
    const _err = _$.err;
    
    //! constants config
    const HEADER_LEMON_IDENTITY = 'x-lemon-identity';
    const METHOD_MODE_MAP = 'LIST,GET,PUT,POST,CONNECT,DISCONNECT'.split(',').reduce((N,K)=>{return N[K]=K,N}, {});

	/** ********************************************************************************************************************
	 *  COMMON Functions.
	 ** ********************************************************************************************************************/
	function success(body) {
		return buildResponse(200, body);
	}

	function notfound(body) {
		return buildResponse(404, body);
	}

	function failure(body) {
		return buildResponse(503, body);
	}

	function buildResponse(statusCode, body) {
        //@0612 - body 가 string일 경우, 응답형식을 텍스트로 바꿔서 출력한다.
		return {
			statusCode: statusCode,
			headers: {
                "Content-Type" : typeof body == 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
				"Access-Control-Allow-Origin": "*",         // Required for CORS support to work
				"Access-Control-Allow-Credentials": true    // Required for cookies, authorization headers with HTTPS
			},
			body: typeof body == 'string' ? body : JSON.stringify(body)
		};
	}

    //! 190314 - refactoring next handler function.
    const doNextAsync = (that, callback)=>{
        return Promise.resolve(that)
        .then((that) => {
            //! decode parameter.
            const ID    = that._id;
            const MODE  = that._mode||'';
            const CMD   = that._cmd||'';
            const $param= that._param;
            const $body = that._body;
            const $ctx  = that._ctx;
            const next  = that._next;
            if (!next) return Promise.reject(new Error('404 NOT FOUND - mode:'+MODE+(CMD ? ', cmd:'+CMD:'')));

            // call next.. (it will return result or promised)
            return next(ID, $param, $body, $ctx);
        })
        .then(_ => {
            if(_ && typeof _ === 'object') _ = $U.cleanup(_);
            callback(null, success(_));
            return true;
        })
        .catch(e => {
            const message = e && e.message || '';
            if(message.indexOf('404 NOT FOUND') >= 0){
                callback(null, notfound(e.message));
            } else {
                _err(NS, '!!! callback err=', e);
                callback(null, failure(e.message||e));
            }
            return false;
        })        
    }

    /** ********************************************************************************************************************
     *  Main Function for API export.
     ** ********************************************************************************************************************/
    /**
     * basic handler function for lambda serverless
     * 
     * @param {*} event         event object
     * @param {*} context       conext object
     * @param {*} callback      callback handler.
     */
    const main = function(event, context, callback){
        "use strict";

		//!WARN! allows for using callbacks as finish/error-handlers
		context.callbackWaitsForEmptyEventLoop = false;

		//! API parameters.
		const $param = event.queryStringParameters || {};
		const $path = event.pathParameters || {};
		// _log(NS,'$path=', $path);
		// _log(NS,'headers=', event.headers);

		//! determine running mode.
		const TYPE = decodeURIComponent($path.type || '');                               // type in path (0st parameter).
		const ID = decodeURIComponent($path.id || '');                                   // id in path (1st parameter).
		const METHOD = !ID&&event.httpMethod==='GET'&&'LIST'||event.httpMethod||'';      // determine method.
		const CMD = decodeURIComponent($path.cmd || event.action || '');                 // cmd in path (2nd parameter).

		//! decoding mode.
		const MODE = METHOD_MODE_MAP[METHOD] || (event.Records ? 'EVENT' : event.Sns ? 'SNS' : 'CALL');
		//! safe decode body if it has json format. (TODO - support url-encoded post body)
		const $body = event.body 
				&& (typeof event.body === 'string' && (event.body.startsWith('{') || event.body.startsWith('[')) ? JSON.parse(event.body) : event.body) 
				|| event.Records && {records: event.Records}
				|| null;
		//! debug print body.
		!$body && _log(NS, `#${MODE}:${CMD} (${METHOD}, ${TYPE}/${ID})....`);
		$body && _log(NS, `#${MODE}:${CMD} (${METHOD}, ${TYPE}/${ID}).... body.len=`, $body ? $U.json($body).length : -1);

		//! prepare chain object.
		const that = {_id:ID, _mode:MODE, _cmd:CMD, _param:$param, _body:$body, _event:event, _ctx:context};
        that._ctx  = event && event.requestContext || that._ctx || {};                  // 180622 Override Context with event.requestContext.
        that._next = decode_next_handler(MODE, ID, CMD);                                // 190314 Save next-function.
        
        //! identity 정보를 얻음.
        //  - http 호출시 해더에 x-lemon-identity = '{"ns": "SS", "sid": "SS000002", "uid": "", "gid": "", "role": "guest"}'
        //  - lambda 호출시 requestContext.identity = {"ns": "SS", "sid": "SS000002", "uid": "", "gid": "", "role": "guest"}
        // _log(NS,'headers['+HEADER_LEMON_IDENTITY+']=', event.headers[HEADER_LEMON_IDENTITY]);
        const identity = ((val)=>{
            try {
                if (!val) return null;
                return (typeof val === 'string' && (val.startsWith('{') || val.endsWith('}'))) ? JSON.parse(val) : val;
            } catch(e){
                _err(NS, '!WARN! parse identity. err=', e);
                return null;
            }
        })((event.headers&&event.headers[HEADER_LEMON_IDENTITY])||that._ctx.identity||'');
        if(identity && !identity.cognitoIdentityPoolId) _inf(NS, '! identity :=', JSON.stringify(identity));
        that._ctx.identity = identity;

        //! do the promised task chain.
        doNextAsync(that, callback)
    };

    //! returns main handler.
    return main;
//////////////////////////
//- end of module.exports
});