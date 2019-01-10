/**
 * API: /hello 
 *  - hello lemon API
 * 
 * 각 Method 별 기능은 'README.md' 참고.
 * 
 * 
 * ========================================================================================
 * !!중요!! 	아래 내용을 각 API 헤더에 복사하여 주세요.				
 * 2018-04-11  initial coding style guidance.
 * ========================================================================================
 * 1. 함수의 기본 패턴은 아래와 같이 통일함. (여기서 name은 노드의 이름으로 변경 )
 * 	@param 	id 		노드의 ID로, 주로 number|string 으로 설정됨.
 *  @param	params	options 항목으로, 노드의 데이터 항목과는 관련없이 메쏘드 실행의 옵션 사항 저장.
 * 	@param	body	노드의 데이터 항목이 담김.
 *  @param	context 그냥 상위 메쏘드에서 하위로 계속 전달해줌. (실행 관련 컨텍스트 저장함).
 * 	- do_get_name/getName (id : number|string, params : any, body : null, context?) : Promise<*>
 * 	- do_put_name/putName (id : number|string, params : any, body : any, context?) : Promise<*>
 * 	- do_post_name/postName (id : number|string, params : any, body : any, context?) : Promise<*>
 * 	- do_delete_name/deleteName (id : number|string, params : any, body : any, context?) : Promise<*>
 * 
 * 2. 추가 :cmd를 포함할 경우. (GET/POST 로 :cmd 정보 전달 가능)
 * 	- do_get_command_name/commandName (id : number|string, params : any, body : any, context?) : Promise<*>
 * 
 * 3. API의 public 함수는 모두 HTTP Method로 매핑 가능해야함.
 * 	- 매우 중요함. 
 *
 * 4. API는 항상 모듈화를 고려하여 만들어져야하며, export로 Factory함수 리턴.
 * 	- export default (function (_$, name) { return main;})
 *  
 * 4. <FUTURE> 모든 api단위는 gulp build를 걸쳐 npm 모듈로 재배포 가능하도록.
 * 	- self unit-test/version 를 고려하여, 배포 관리를 하자!!!!!
 * 
 * ----------------------------------------------------------------------------------------
 * 
 * 
 * 
 * @author Steve Jung <steve@lemoncloud.io>
 * @date   2018-05-15
 *
 * Copyright (C) 2019 LemonCloud Co Ltd. - All Rights Reserved.
 */
/** ********************************************************************************************************************
 *  Common Headers
 ** ********************************************************************************************************************/
//! module.exports
exports = module.exports = (function (_$, name) {
	if (!_$) throw new Error('_$(global instance pool) is required!');

	//! load services (_$ defined in global)
	const $_ = _$._;                                // re-use global instance (lodash).
	const $U = _$.U;                                // re-use global instance (utils).
	if(!$U) throw new Error('$U is required!');

	//! Name Space.
	const NS = $U.NS(name||'GOOD', "yellow");		// NAMESPACE TO BE PRINTED. (4자리 문자 추천)

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

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

	/** ********************************************************************************************************************
	 *  Main Function for API export.
	 ** ********************************************************************************************************************/
	//! IT WILL BE MOVED TO SUB FILES..
	const main = function (event, context, callback){
		"use strict";

		//!WARN! allows for using callbacks as finish/error-handlers
		context.callbackWaitsForEmptyEventLoop = false;

		//! API parameters.
		const $param = event.queryStringParameters || {};
		const $path = event.pathParameters || {};
		// _log(NS,'$path=', $path);

		//! determine running mode.
		const TYPE = decodeURIComponent($path.type || '');                               // type in path (0st parameter).
		const ID = decodeURIComponent($path.id || '');                                   // id in path (1st parameter).
		const METHOD = !ID&&event.httpMethod==='GET'&&'LIST'||event.httpMethod||'';      // determine method.
		const CMD = decodeURIComponent($path.cmd || event.action || '');                 // cmd in path (2nd parameter).

		//! decoding mode.
		const METHOD_MODE_MAP = {'LIST':'LIST', 'GET':'GET', 'PUT':'PUT', 'POST':'POST', 'DELETE':'DELETE'};
		const MODE = METHOD && METHOD_MODE_MAP[METHOD] || (event.Records ? 'EVENT' : event.Sns ? 'SNS' : 'CRON');       // updated @180710
		//! safe decode body if it has json format. (TODO - support url-encoded post body)
		const $body = event.body 
				&& (typeof event.body === 'string' && (event.body.startsWith('{') || event.body.startsWith('[')) ? JSON.parse(event.body) : event.body) 
				|| event.Records && {records: event.Records}
				|| null;
		//! debug print body.
		!$body && _log(NS, `#${MODE}:${CMD} (${METHOD}, ${TYPE}/${ID})....`);
		$body && _log(NS, `#${MODE}:${CMD} (${METHOD}, ${TYPE}/${ID}).... body.len=`, $body ? $U.json($body).length : -1);

		//! prepare chain object.
		const that = {_id:ID, _param:$param, _body:$body, _event:event, _ctx:context};
        that._ctx = event && event.requestContext || that._ctx;                         // 180622 Override Context with event.requestContext.
		let chain = Promise.resolve(that);

		//! exit if not found.
		const next = _decode_next_handler(MODE, ID, CMD);
		if (!next) return callback(null, notfound({MODE}));

		//! do the promised task chain.
		try {
			chain.then((that) => {
				const ID = that._id;
				const $param = that._param;
				const $body = that._body;
                const $ctx = that._ctx;

				// call next.. (it will return result or promised)
				return next(ID, $param, $body, $ctx);
			})
			.then(_ => {
				if(_ && typeof _ === 'object') _ = $U.cleanup(_);
				callback(null, success(_));
				return true;
			})
			.catch(e => {
				_err(NS, '!!! callback@1 with err', e);
				const message = e && e.message || '';
				if(message.indexOf('404 NOT FOUND') >= 0){
					callback(null, notfound(e.message));
				} else {
					callback(null, failure(e.message||e));
				}
				return false;
			})
		} catch(e){
			callback(e, failure(e.message));
		}
	};

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
	function _decode_next_handler(MODE, ID, CMD)
	{
		let next = null;
		switch(MODE)
		{
			case 'LIST':
				next = do_list_hello;
				break;
			case 'GET':
				next = do_get_hello;
				break;
			case 'PUT':
				next = do_put_hello;
				break;
			case 'POST':
				next = do_post_hello;
				break;
			case 'DELETE':
				next = do_delete_hello;
				break;
			case 'EVENT':
				break;
			default:
				break;
		}
		return next;
	}

	//INFO - 이름 규칙 do_action_object().
	main.do_list_hello      = do_list_hello;
	main.do_get_hello       = do_get_hello;
	main.do_put_hello       = do_put_hello;
	main.do_post_hello      = do_post_hello;
	main.do_delete_hello    = do_delete_hello;

	/** ********************************************************************************************************************
	 *  Local Functions.
	 ** ********************************************************************************************************************/
    //! shared memory.
    //WARN! - `serverless offline`는 상태를 유지하지 않으므로, NODES값들이 실행때마다 리셋이될 수 있음.
    const NODES = [
        {
            name:'lemon'
        },
        {
            name:'cloud'
        }
    ]

	/**
	 * Search by params
	 * 
	 * example:
	 * $ http ':8888/hello/'
	 * 
	 * @param {*} ID 			id of object
	 * @param {*} $param		query parameters (json)
	 * @param {*} $body			body parameters (json)
	 * @param {*} $ctx			context (optional)
	 */
	function do_list_hello(ID, $param, $body, $ctx){
        _log(NS, `do_list_hello(${ID})....`);
        
        const that = {};
        that.name = _$.environ('NAME');                     // read via process.env
        return Promise.resolve(that)
        .then(_ => {
            _.list = NODES;
            return _;
        })
	}

	/**
	 * Read the detailed object.
	 * 
	 * example:
	 * $ http ':8888/hello/0'
	 */
	function do_get_hello(ID, $param, $body, $ctx){
        _log(NS, `do_get_hello(${ID})....`);
        
        const id = $U.N(ID, 0);
        const node = NODES[id];
        if (!node) return Promise.reject(new Error('404 NOT FOUND - id:'+id))
        return Promise.resolve(node)
        .then(_ => {
            const node = Object.assign({}, _);             // copy node.
            node._id = id;
            return node;
        })
    }
    
	/**
	 * Only Update with incremental support
	 * 
	 * example:
	 * $ echo '{"size":1}' | http PUT ':8888/hello/1'
	 */
	function do_put_hello(ID, $param, $body, $ctx){
		_log(NS, `do_put_hello(${ID})....`);
        $param = $param||{};

        return do_get_hello(ID, null, null, $ctx)
        .then(node => {
            const id = node._id;
            Object.assign(NODES[id], $body||{});
            return Object.assign(node, $body||{});
        })
	}


	/**
	 * Insert new Node at position 0.
	 * 
	 * example:
	 * $ echo '{"name":"lemoncloud"}' | http POST ':8888/hello/0'
	 */
	function do_post_hello(ID, $param, $body, $ctx){
		_log(NS, `do_post_hello(${ID})....`);
        $param = $param||{};
        if (!$body && !$body.name) return Promise.reject(new Error('.name is required!'));

        return Promise.resolve($body)
        .then(node => {
            NODES.push(node);
            return NODES.length - 1;            // returns ID.
        })
    }
    
	/**
	 * Delete Node (or mark deleted)
	 * 
	 * example:
	 * $ http DELETE ':8888/hello/1'
	 */
	function do_delete_hello(ID, $param, $body, $ctx){
        _log(NS, `do_delete_hello(${ID})....`); 
        
        return do_get_hello(ID, null, null, $ctx)
        .then(node => {
            const id = node._id;
            if (id === undefined) return Promise.reject(new Error('._id is required!'));
            // NODES.splice(id, 1);                // remove single node.
            delete NODES[id];                    // set null in order to keep id.
            return node;
        })
	}
	
	//! return fially.
	return main;
//////////////////////////
//- end of module.exports
});