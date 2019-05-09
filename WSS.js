/**
 * Common WebSocket Server
 * - Proxy request to internal API handler.
 * 
 * 
 * @author Steve Jung <steve@lemoncloud.io>
 * 
 * Copyright (C) 2019 LemonCloud Co Ltd. - All Rights Reserved.
 */
exports = module.exports = (function (_$) {
    if (!_$) throw new Error('_$(global instance pool) is required!');
    
    //! load services (_$ defined in global)
    const $_ = _$._;                                // re-use global instance (lodash).
    const $U = _$.U;                                // re-use global instance (utils).
    const $aws = _$.aws;                            // re-use global instance (aws).
    if(!$U) throw new Error('$U(utillities) is required!');
	if (!$aws) throw new Error('$aws(aws-sdk) is required!');

	const NS = $U.NS('WSS', "yellow");              // NAMESPACE TO BE PRINTED.

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;
    
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
		return {
			statusCode: statusCode,
			body: body === undefined ? undefined : typeof body == 'string' ? body : JSON.stringify(body)
		};
	}

    /**
     * Send JSON message to client.
     * 
     * @param {*} url               API Gateway URL
     * @param {*} connectionId      Unique connection-id per connection
     * @param {*} payload           Data to send
     */
    const sendMessageToClient = (url, connectionId, payload) => new Promise((resolve, reject) => {
        _log(NS, `sendMessageToClient(${url}, ${connectionId})...`)
        _log(NS, '> payload=', payload);

        //NOTE - it would NOT work in VPC lambda.
        const apigatewaymanagementapi = new $aws.ApiGatewayManagementApi({ apiVersion: '2029', endpoint: url });
        apigatewaymanagementapi.postToConnection({
            ConnectionId: connectionId, // connectionId of the receiving ws-client
            Data: JSON.stringify(payload),
        }, (err, data) => {
            if (err) {
                _err(NS, '> err=', err);
                return reject(err);
            }
            _log(NS, '> res=', data);
            resolve(data);
        });
    });

    //! chain for HTTP type.
    const executeServiceApi = (method, type='hello', id='', cmd='', param=null, body=null, context=null) => new Promise((resolve, reject) => {
        _log(NS, `executeServiceApi(${method})...`)
        // if (!method) return reject(new Error('method is required!'));
        if (!method) throw new Error('method is required!');
        if (method && typeof method === 'object'){
            const data = method;
            type       = ''+(type||'hello');                //MUST BE STRING!
            method     = ''+(data.method||'get');           //MUST BE STRING!
            id         = ''+(data.id||id);                  //MUST BE STRING!
            cmd        = ''+(data.cmd||cmd);                //MUST BE STRING!
            param      = data.param;
            body       = data.body;
            context    = data.context;
        }
        method = `${method}`.toUpperCase();
        _log(NS, `> ${method} ${type}/${id}/${cmd} param=`, param);
        
        //! lookup target-api by name.
        const API = _$(type);
        if (!API) new Error('404 NOT FOUND - API.type:'+type);

        //! transform to APIGatewayEvent;
        const event = {
            httpMethod: method,
            path: cmd ? `/${id}/${cmd}` : id !== undefined ? `/${id}` : `/`,
            headers: {},
            pathParameters: {},
            queryStringParameters: {},
            body: '',
            isBase64Encoded: false,
            stageVariables: null,
            requestContext: context||{},
            resource: ''
        }
        if (id !== undefined) event.pathParameters.id = id;
        if (cmd !== undefined) event.pathParameters.cmd = cmd;
        if (param) event.queryStringParameters = param;
        if (body)  event.body                  = body;

        //! basic handler type. (see bootload.main)
        API(event, {}, (err, res)=>{
            err && reject(err);
            !err && resolve(res);
        })
    });

    /**
     * Common WSS Handler for AWS API Gateway
     * 
     * example:
     * ```js
     * $ npm install -g wscat
     * $ wscat -c wss://4zrx5adcrd.execute-api.ap-northeast-2.amazonaws.com/prod
     * > {"action":"echo"}
     * > {"id":"","cmd":""}
     * ```
     * 
     * @param {*} event 
     * @param {*} context 
     */
    const WSS = async(event, context) => {
        // context.callbackWaitsForEmptyEventLoop = false;
        // _log(NS, '! event =', event);
        // _log(NS, '! context=', context);
        _log(NS, '! event.headers =', event.headers);

        const $ctx = event.requestContext||{};
        const EVENT_TYPE = $ctx.eventType||'';
        const ROUTE_KEY = $ctx.routeKey||'';
        _log(NS, `> ${ROUTE_KEY}/${EVENT_TYPE} context=`, $ctx);

        const stage = $ctx.stage;
        const domain = $ctx.domainName;
        const connectionId = $ctx.connectionId; 
        const callbackUrlForAWS = `https://${domain}/${stage}`;

        try {
            let res = null;
            if (EVENT_TYPE === "CONNECT") 
            {
                res = await executeServiceApi({method:"CONNECT", context: $ctx})
            }
            else if (EVENT_TYPE === "DISCONNECT")
            {
                res = await executeServiceApi({method:"DISCONNECT", context: $ctx})
            }
            else if (EVENT_TYPE === "MESSAGE" && ROUTE_KEY === "echo")                   // handler for 'echo' action. see route config.
            {
                await sendMessageToClient(callbackUrlForAWS, connectionId, event);
                res = success()
            }
            else if (EVENT_TYPE === "MESSAGE")
            {
                const body = event.body;
                const data = typeof body === 'string' && body.startsWith('{') && body.endsWith('}') ? JSON.parse(body) : body;
                _log(NS, '> data =', data);
                //NOTE - in connected state, send result via web-socket with success
                const message = await (async ()=>{
                    if (data && typeof data === 'object') {
                        data.context = $ctx;                                            //NOTE - Never use context from client.
                        return await executeServiceApi(data)
                    }
                    return failure('body should be JSON object. but type:'+(typeof data))
                })()
                await sendMessageToClient(callbackUrlForAWS, connectionId, message)
                res = success(); 
            }

            //! returns result or failure.
            return res||failure(`Invalid ${ROUTE_KEY}/${EVENT_TYPE}`)
        } catch (e) {
            _err(NS, '! error =', e)
            const msg = `${e.message||e}`
            return msg.startsWith('404 NOT FOUND') ? notfound(msg) : failure(msg)
        }
    }

    //! returns main SNS handler.
    return WSS;
})

