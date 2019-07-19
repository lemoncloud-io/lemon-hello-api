/**
 * Common SQS Handler in order to dispatch the target handler via SQS common.
 * - `lemon-protocol-api` 에서 각 서비스의 대표 SQS 에 메세지를 전달함.
 * - 그러면, 대표 SQS에 대해서는 이 SQS 핸들러가 데이터를 전달 받고, 이후 해당 API로 전달해줌.
 * - 해당 API 전달은 _$('api-name') 으로 찾아서 전달함.
 *
 * [Deploy]
 *  - 이 파일을 각 서비스 프로젝트에 복사하여, handler.js에 SQS 추가 `const SQS = require('./SQS')(_$)`.
 *  - `serverless.yml` 의 SQS 생성과 연결 부분을 수정하여 준다.
 *
 *
 *
 * @author Tony Sung <tony@lemoncloud.io>
 * @description     2019-01-17 To support `$protocol().do_post_notify(url, body, callback)`. (engine >1.0.13)
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
/* eslint-disable global-require */
/* eslint-disable no-nested-ternary */
/* eslint-disable no-param-reassign */
/* eslint-disable no-unused-vars */
/* eslint-disable no-underscore-dangle */
/* eslint-disable no-constant-condition */
/* eslint-disable no-use-before-define */
module.exports = function(_$) {
	if (!_$) throw new Error('_$(global instance pool) is required!');

	//! load services (_$ defined in global)
	const $_ = _$._; // re-use global instance (lodash).
	const $U = _$.U; // re-use global instance (utils).
	if (!$U) throw new Error('$U(utillities) is required!');

	const NS = $U.NS('SQS', 'yellow'); // NAMESPACE TO BE PRINTED.
	const DEFAULT_TYPE = _$.environ('DEFAULT_TYPE', 'hello');

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! process each record.
	const local_process_record = (record, i) => {
		_log(`local_process_record(${i})...`);
		const body = record.body || '';
		const data = typeof body === 'string' && body.startsWith('{') && body.endsWith('}') ? JSON.parse(body) : body || {};
		const attributes = record.messageAttributes || {};

		//! validate & filter inputs.
		if (!data) return Promise.resolve({ error: 'empty data!' });

		//! extract parameters....
		const TYPE = data.type || DEFAULT_TYPE || '';
		const METHOD = (data.method || 'get').toUpperCase();
		const ID = data.id;
		const CMD = data.cmd;
		const PARAM = data.param;
		const BODY = data.body;

		// transform to APIGatewayEvent;
		const event = {
			httpMethod: METHOD,
			path: CMD ? `/${ID}/${CMD}` : ID !== undefined ? `/${ID}` : '/',
			headers: {},
			pathParameters: {},
			queryStringParameters: {},
			body: '',
			isBase64Encoded: false,
			stageVariables: null,
			requestContext: {},
			resource: '',
		};
		if (ID !== undefined) event.pathParameters.id = ID;
		if (CMD !== undefined) event.pathParameters.cmd = CMD;
		if (PARAM) event.queryStringParameters = PARAM;
		if (BODY) event.body = BODY;

		//! lookup by type....................
		return new Promise((resolve, reject) => {
			const API = _$(TYPE);
			if (!API) return reject(new Error(`404 NOT FOUND - API.type:${TYPE}`));
			return API(event, {}, (err, res) => {
				err && reject(err);
				!err && resolve(res);
			});
		})
			.then(res => {
				const statusCode = res.statusCode || 200;
				const body =
					typeof res.body === 'string' && (res.body.startsWith('{') && res.body.endsWith('}'))
						? JSON.parse(res.body)
						: res.body;
				_log(NS, `! RES[${statusCode}] =`, typeof body, $U.json(body));
				return statusCode != 200 ? { error: body } : body;
			})
			.catch(e => {
				_err(NS, '! ERR =', e);
				const msg = (e && e.message) || `${e}`;
				return { error: msg };
			});
	};

	// TODO - post message.
	const local_error_handler = (record, error) => {
		_log(NS, '>> local_error_handler');
		const body = record.body || {};
		const data = typeof body === 'string' && body.startsWith('{') && body.endsWith('}') ? JSON.parse(body) : body || {};
		data.error = error || 'N/A';
		return data;
	};

	//! wait some
	function wait_sometime(that, time) {
		time = time || 1500;
		return new Promise((resolve, reject) => {
			setTimeout(() => {
				resolve(that);
			}, time);
		});
	}

	//! retry to process record
	const local_process_record_retry = (record, n) =>
		local_process_record(record).then(that => {
			const ERROR = that.error || '';
			//! handle error
			if (n <= 1) return local_error_handler(record, ERROR);
			//! retry
			if (ERROR) {
				_log(NS, `>> retry counts (${n}) due to error: ${ERROR}`);
				return wait_sometime({}, 500).then(_ => local_process_record_retry(record, n - 1));
			}
			//! success
			else that;
		});

	//! Common SQS Handler for lemon-protocol integration.
	const SQS = function(event, context, callback) {
		//! WARN! allows for using callbacks as finish/error-handlers
		context.callbackWaitsForEmptyEventLoop = false;

		//! for each SQS record. do service.
		const records = event.Records || [];
		if (!records.length) return callback && callback(null, 0);

		//! resolve all.
		return Promise.all(
			records.map(record => {
				const RETRY = 3;
				return local_process_record_retry(record, RETRY);
			})
		);
	};

	//! returns main SQS handler.
	return SQS;
};
