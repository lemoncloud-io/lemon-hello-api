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
	if(!$U) throw new Error('$U(utillities) is required!');

	//! Name Space.
	const NS = $U.NS(name||'GOOD', "yellow");		// NAMESPACE TO BE PRINTED. (4자리 문자 추천)

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    /** ********************************************************************************************************************
     *  Main Function for API export.
     ** ********************************************************************************************************************/
    const main = require('./bootload')(_$, NS, decode_next_handler);

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
	function decode_next_handler(MODE, ID, CMD)
	{
		let next = null;
		switch(MODE)
		{
			case 'LIST':
				next = do_list_hello;
				break;
			case 'GET':
                if (false);
                else if (ID !== '!' && CMD === '')
                    next = do_get_hello;
                else if (ID !== '!' && CMD === 'test')
                    next = do_get_test;
				break;
			case 'PUT':
                if (false);
                else if (ID !== '!' && CMD === '')
                    next = do_put_hello;
				break;
			case 'POST':
                if (false);
                else if (ID !== '!' && CMD === '')
                    next = do_post_hello;
                else if (ID !== '!' && CMD === 'slack')
                    next = do_post_hello_slack;
				break;
			case 'DELETE':
                if (false);
                else if (ID !== '!' && CMD === '')
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
    
	main.do_post_slack      = do_post_hello_slack;

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
     * POST message to hookUrl.
     * 
     * @param {*} hookUrl       URL
     * @param {*} message       Object or String.
     */
    const postMessage = async function(hookUrl, message) {
        const url = require('url');
        const https = require('https');

        const body = typeof message == 'string' ? message : JSON.stringify(message);
        const options = url.parse(hookUrl);
        options.method = 'POST';
        options.headers = {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
        };
        return new Promise((resolve, reject)=>{
            const postReq = https.request(options, (res)=>{
                var chunks = [];
                res.setEncoding('utf8');
                res.on('data', (chunk)=>{
                    return chunks.push(chunk);
                });
                res.on('end', function() {
                    const body = chunks.join('');
                    const statusCode = res.statusCode||200;
                    const statusMessage = res.statusMessage||'';
                    const result = {body, statusCode, statusMessage};
                    _log(NS, `> post(${hookUrl}) =`, result);
                    if (statusCode < 400){
                        resolve(result);
                    } else {
                        reject(result);
                    }
                });
                return res;
            });
            postReq.write(body);
            postReq.end();
        })
    };

	/** ********************************************************************************************************************
	 *  Public API Functions.
	 ** ********************************************************************************************************************/
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
     * Post message via Slack Web Hook
     * 
     * 
     * ```sh
     * # post message to slack/general
     * $ echo '{"text":"hello"}' | http ':8888/hello/public/slack'
     * $ echo 'hahah' | http ':8888/hello/public/slack'
     * ```
     * @param {*} ID                slack-channel id (see environment)
     * @param {*} $param            (optional)
     * @param {*} $body             {error?:'', message:'', data:{...}}
     * @param {*} $ctx              context
     */
	async function do_post_hello_slack(ID, $param, $body, $ctx){
		_log(NS, `do_post_hello_slack(${ID})....`);
        if (ID !== 'public') return Promise.reject(new Error('404 NOT FOUND - Channel:'+ID));
        $param = $param||{};

        //! basic configuration.
        const WEBHOOK = 'https://hooks.slack.com/services/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';            // channel: `lemoncloud-io/public`
        const message = typeof $body == 'string' ? {text: $body} : $body;

        //1. load target webhook via environ.
        const $env = process.env||{};
        const ENV_NAME = `SLACK_${ID}`.toUpperCase();
        const webhook = $env[ENV_NAME]||WEBHOOK;
        _log(NS, '> webhook :=', webhook);

        //2. post message.
        const res = await postMessage(webhook, message);

        //3. returns
        return res;
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
    

	/**
	 * Read the detailed object.
	 * 
	 * ```sh
	 * $ http ':8888/hello/SNS/test'
	 */
	function do_get_test(ID, $param, $body, $ctx){
        _log(NS, `do_get_test(${ID})....`);

        if (ID == 'SNS'){
            const $SNS = require('../../SNS')(_$);
            if (!$SNS) throw new Error('.SNS is required!');
            const data = require('../../data/alarm.json');
            const event = {
                Records:[{
                    Sns:{
                        Subject: 'ALARM: "...." in Asia Pacific (Seoul)',
                        Message: data
                    }
                }]
            }
            return new Promise((resolve, reject)=>{
                $SNS(event, $ctx, (err,res)=>{
                    if (err) reject(err)
                    else resolve(res)
                })
            })
            // _log(NS, '> data=', data);
        }
        return Promise.reject(new Error('404 NOT FOUND - ID:'+ID));
    }
        
	//! return fially.
	return main;
//////////////////////////
//- end of module.exports
});