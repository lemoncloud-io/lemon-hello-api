/**
 * Common SNS Handler in order to dispatch the target handler via SNS common.
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
	if(!$U) throw new Error('$U(utillities) is required!');
    
    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    //! process each record.
    const local_process_record = (record, i) => {
        const sns = record.Sns || {};
        const subject = sns.Subject || '';
        const message = sns.Message || '';
        const data = typeof message === 'string' && message.startsWith('{') && message.endsWith('}') ? JSON.parse(message) : message || {};
        _log('! record['+i+'].'+subject+' =', typeof data, JSON.stringify(data));

        //! validate & filter inputs.
        if (!data) return Promise.resolve({error: 'empty data!'});

        //! extract parameters....
        const TYPE          = data.type||'';
        const METHOD        = (data.method||'get').toUpperCase();
        const ID            = data.id;
        const CMD           = data.cmd;
        const PARAM         = data.param;
        const BODY          = data.body;
        // const CALLBACK      = data.callback;            // callback url (WARN! must be called w/ lambda) SNS -> SNS -> SNS 부르는 무한반복 문제?!!

        // transform to APIGatewayEvent;
        const event = {      // : APIGatewayEvent
            httpMethod: METHOD,
            path: CMD ? `/${ID}/${CMD}` : ID !== undefined ? `/${ID}` : `/`,
            headers: {},
            pathParameters: {},
            queryStringParameters: {},
            body: '',
            isBase64Encoded: false,
            stageVariables: null,
            requestContext: {},
            resource: ''
        }
        if (ID !== undefined) event.pathParameters.id = ID;
        if (CMD !== undefined) event.pathParameters.cmd = CMD;
        if (PARAM) event.queryStringParameters = PARAM;
        if (BODY)  event.body                  = BODY;

        //! lookup by type....................
        return new Promise((resolve, reject)=>{
            //! lookup target-api by name.
            const API = _$(TYPE);
            if (!API) return reject(new Error('404 NOT FOUND - API.type:'+TYPE));
            //! basic handler type. (see bootload.main)
            return API(event, {}, (err, res)=>{
                err && reject(err);
                !err && resolve(res);
            })
        })
        .then(res => {
            const statusCode = res.statusCode||200;
            const body = (typeof res.body === 'string' && (res.body.startsWith('{') && res.body.endsWith('}')) ? JSON.parse(res.body) : res.body);
            _log('! RES['+statusCode+'] =', typeof body, $U.json(body));
            return statusCode != 200 ? {error: body} : body;
        })
        .catch(e => {
            _err('! ERR =', e);
            const msg = e && e.message || `${e}`;
            return {error: msg};
        })
        // .then(body =>{
        //     if (!CALLBACK) return body;                 // ignore
        //     return $protocol().do_post_execute(CALLBACK, body)
        //     .then(_ => {
        //         _log('! CALLBACK['+CALLBACK+'] =', typeof _, $U.json(_));
        //         return _;
        //     })
        //     .catch(e => {
        //         _err('! ERR['+CALLBACK+'] =', e);
        //         const msg = e && e.message || `${e}`;
        //         return {error: msg};
        //     })
        // })
    }

    //! Common SNS Handler for lemon-protocol integration.
    const SNS = function(event, context, callback){
		//!WARN! allows for using callbacks as finish/error-handlers
        context.callbackWaitsForEmptyEventLoop = false;

        //! for each SNS record. do service.
        const records = event.Records||[];
        if (!records.length) return callback && callback(null, 0);

        //! resolve all.
        return Promise.all(records.map(local_process_record))
        .then(_ => callback && callback(null, _.length))
    }

    //! returns main SNS handler.
    return SNS;
})

