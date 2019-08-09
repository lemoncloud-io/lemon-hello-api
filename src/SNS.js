/**
 * Common SNS Handler in order to dispatch the target handler via SNS common.
 *
 *
 *
 * @author  Steve <steve@lemoncloud.io>
 * @date    2019-07-19 initial version
 * @date    2019-08-06 refactoring with `chain_filter_data()`
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
module.exports = _$ => {
    if (!_$) throw new Error('_$(global instance pool) is required!');

    //! load services (_$ defined in global)
    const $_ = _$._; // re-use global instance (lodash).
    const $U = _$.U; // re-use global instance (utils).
    if (!$U) throw new Error('$U(utillities) is required!');

    const NS = $U.NS('SNS', 'yellow'); // NAMESPACE TO BE PRINTED.
    const DEFAULT_TYPE = _$.environ('DEFAULT_TYPE', 'hello');

    //! load common functions
    const _log = _$.log;
    const _inf = _$.inf;
    const _err = _$.err;

    //! translate data to `POST /!/event?subject`
    const chain_filter_data = ({ subject, data, context }) => {
        if (
            subject.startsWith('ALARM:') ||
            subject.startsWith('DeliveryFailure') ||
            subject === 'error' ||
            subject === 'callback'
        ) {
            const body = data;
            const param = { subject };
            data = { method: 'POST', id: '!', cmd: 'event', param, body };
        }
        return { subject, data, context };
    };

    //! chain for HTTP type.
    const chain_process_http = ({ subject, data, context }) => {
        _log(`chain_process_http(${subject})...`);
        _log('> data=', data);

        //! extract parameters....
        const TYPE = data.type || DEFAULT_TYPE || ''; // NOTE - default API name.
        const METHOD = (data.method || 'get').toUpperCase();
        const ID = data.id;
        const CMD = data.cmd;
        const PARAM = data.param;
        const BODY = data.body;

        // transform to APIGatewayEvent;
        const event = {
            httpMethod: METHOD,
            // eslint-disable-next-line no-nested-ternary
            path: CMD ? `/${ID}/${CMD}` : ID !== undefined ? `/${ID}` : '/',
            headers: {},
            pathParameters: {},
            queryStringParameters: {},
            body: '',
            isBase64Encoded: false,
            stageVariables: null,
            requestContext: context,
            resource: '',
        };
        if (ID !== undefined) event.pathParameters.id = ID;
        if (CMD !== undefined) event.pathParameters.cmd = CMD;
        if (PARAM) event.queryStringParameters = PARAM;
        if (BODY) event.body = BODY;

        //! lookup target-api by name.
        const API = _$(TYPE);
        if (!API) return Promise.reject(new Error(`404 NOT FOUND - API.type:${TYPE}`));

        //! returns promised
        return new Promise((resolve, reject) => API(event, {}, (err, res) => (err ? reject(err) : resolve(res))));
    };

    //! process each record.
    const local_process_record = (record, i, context) => {
        const sns = record.Sns || {};
        const subject = sns.Subject || '';
        const message = sns.Message || '';
        const data =
            typeof message === 'string' && message.startsWith('{') && message.endsWith('}')
                ? JSON.parse(message)
                : message || {};
        _log(`! record[${i}]."${subject}" =`, typeof data, JSON.stringify(data));

        //! validate & filter inputs.
        if (!data) return Promise.resolve({ error: 'empty data!' });

        //! start chain processing.
        return Promise.resolve({ subject, data, context })
            .then(chain_filter_data)
            .then(chain_process_http)
            .then(res => {
                const statusCode = res.statusCode || 200;
                const body =
                    typeof res.body === 'string' && (res.body.startsWith('{') && res.body.endsWith('}'))
                        ? JSON.parse(res.body)
                        : res.body;
                _log(`! RES[${statusCode}] =`, typeof body, $U.json(body));
                return statusCode !== 200 ? { error: body } : body;
            })
            .catch(e => {
                _err('! ERR =', e);
                const msg = (e && e.message) || `${e}`;
                return { error: msg };
            });
    };

    //! Common SNS Handler for lemon-protocol integration.
    const SNS = (event, context, callback) => {
        //! WARN! allows for using callbacks as finish/error-handlers
        context.callbackWaitsForEmptyEventLoop = false;

        //! for each SNS record. do service.
        const records = event.Records || [];
        if (!records.length) return callback && callback(null, 0);

        //! resolve all.
        return Promise.all(records.map((_, i) => local_process_record(_, i, context))).then(
            _ => callback && callback(null, _.length),
        );
    };

    //! returns main SNS handler.
    return SNS;
};
