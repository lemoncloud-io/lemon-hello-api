/**
 * Common SNS Handler in order to dispatch the target handler via SNS common.
 *
 *
 *
 * @author  Steve <steve@lemoncloud.io)
 * @date    2019-07-19
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

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	//! external service
	const $aws = () => {
		if (!_$.aws) throw new Error('$aws is required!');
		return _$.aws;
	};

	//! load api services.
	const $hello = () => {
		if (!_$.hello) throw new Error('$hello(hello-api) is required!');
		return _$.hello;
	};

	const asText = data => {
		const keys = (data && Object.keys(data)) || [];
		return keys.length > 0 ? JSON.stringify(data) : '';
	};

	//! post to slack channel.
	const do_post_slack = (
		pretext = '',
		title = '',
		text = '',
		fields = [],
		color = '#FFB71B',
		username = 'hello-alarm'
	) => {
		if (pretext && typeof pretext === 'object') {
			const args = pretext || {};
			pretext = args.pretext || '';
			title = args.title || title;
			text = args.text || text;
			fields = args.fields || fields;
			color = args.color || color;
			username = args.username || username;
		}
		// Set the request body
		const now = new Date().getTime();

		//! build attachment.
		const attachment = {
			username,
			color,
			pretext,
			title,
			text,
			ts: Math.floor(now / 1000),
			// "title_link": link||'',
			// "thumb_url" : thumb || '',
			// "image_url" : image || '',
			fields,
		};
		//! build body for slack
		const body = { attachments: [attachment] };

		//! call post-slack
		return $hello().do_post_slack('public', {}, body);
	};

	//! chain for ALARM type. (see data/alarm.jsonc)
	const chain_process_alarm = ({ subject, data, context }) => {
		_log(`chain_process_alarm(${subject})...`);
		data = data || {};
		_log('> data=', data);

		const AlarmName = data.AlarmName || '';
		const AlarmDescription = data.AlarmDescription || '';

		//!  build fields.
		const Fields = [];
		const pop_to_fields = (param, short = true) => {
			short = short === undefined ? true : short;
			const [name, nick] = param.split('/', 2);
			const val = data[name];
			if (val !== undefined && val !== '') {
				Fields.push({
					title: nick || name,
					value: typeof val === 'object' ? JSON.stringify(val) : val,
					short,
				});
			}
			delete data[name];
		};
		pop_to_fields('AlarmName', false);
		pop_to_fields('AlarmDescription');
		pop_to_fields('AWSAccountId');
		pop_to_fields('NewStateValue');
		pop_to_fields('NewStateReason', false);
		pop_to_fields('StateChangeTime');
		pop_to_fields('Region');
		pop_to_fields('OldStateValue');
		pop_to_fields('Trigger', false);

		const pretext = `Alarm: ${AlarmName}`;
		const title = AlarmDescription || '';
		const text = asText(data);
		const fields = Fields;

		return do_post_slack(pretext, title, text, fields);
	};

	//! chain for DeliveryFailure type. (see data/delivery-failure.json)
	const chain_process_delivery_failure = ({ subject, data, context }) => {
		_log(`chain_process_delivery_failure(${subject})...`);
		data = data || {};
		_log('> data=', data);

		const FailName = data.EventType || '';
		const FailDescription = data.FailureMessage || '';
		const EndpointArn = data.EndpointArn || '';

		//!  build fields.
		const Fields = [];
		const pop_to_fields = (param, short = true) => {
			short = short === undefined ? true : short;
			const [name, nick] = param.split('/', 2);
			const val = data[name];
			if (val !== undefined && val !== '' && nick !== '') {
				Fields.push({
					title: nick || name,
					value: typeof val === 'object' ? JSON.stringify(val) : val,
					short,
				});
			}
			delete data[name];
		};
		pop_to_fields('EventType/'); // clear this
		pop_to_fields('FailureMessage/'); // clear this
		pop_to_fields('FailureType');
		pop_to_fields('DeliveryAttempts/'); // DeliveryAttempts=1
		pop_to_fields('Service/'); // Service=SNS
		pop_to_fields('MessageId');
		pop_to_fields('EndpointArn', false);
		pop_to_fields('Resource', false);
		pop_to_fields('Time/', false); // clear this

		const pretext = `SNS: ${FailName}`;
		const title = FailDescription || '';
		// const text = asText(data);
		const text = `For more details, run below. \n\`\`\`aws sns get-endpoint-attributes --endpoint-arn "${EndpointArn}"\`\`\``;
		const fields = Fields;

		//! get get-endpoint-attributes
		const local_chain_endpoint_attrs = that => {
			const AWS = $aws();
			const SNS = new AWS.SNS();
			return SNS.getEndpointAttributes({ EndpointArn })
				.promise()
				.then(_ => {
					_log(NS, '> EndpointAttributes=', _);
					const Attr = (_ && _.Attributes) || {};
					that.fields.push({ title: 'Enabled', value: Attr.Enabled || '', short: true });
					that.fields.push({ title: 'CustomUserData', value: Attr.CustomUserData || '', short: true });
					that.fields.push({ title: 'Token', value: Attr.Token || '', short: false });
					return that;
				})
				.catch(e => {
					_err(NS, '!ERR EndpointAttributes=', e);
					return that;
				});
		};

		// return do_post_slack(pretext, title, text, fields)
		return Promise.resolve({
			pretext,
			title,
			text,
			fields,
		})
			.then(local_chain_endpoint_attrs)
			.then(do_post_slack);
	};

	//! chain for ALARM type. (see data/alarm.jsonc)
	const chain_process_error = ({ subject, data, context }) => {
		_log(`chain_process_error(${subject})...`);
		data = data || {};
		_log('> data=', data);

		return do_post_slack('', 'error-report', asText(data), []);
	};

	//! chain for ALARM type. (see data/alarm.jsonc)
	const chain_process_callback = ({ subject, data, context }) => {
		_log(`chain_process_callback(${subject})...`);
		data = data || {};
		_log('> data=', data);

		return do_post_slack('', 'callback-report', asText(data), [], '#B71BFF');
	};

	//! chain for HTTP type.
	const chain_process_http = ({ subject, data, context }) => {
		_log(`chain_process_http(${subject})...`);
		_log('> data=', data);

		//! extract parameters....
		const TYPE = data.type || subject || ''; // NOTE - default API name.
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
			requestContext: {},
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

		//! determin main chain process.
		// eslint-disable-next-line no-constant-condition
		const chain_next = false
			? null
			: subject.startsWith('ALARM: ')
			? chain_process_alarm
			: subject.startsWith('DeliveryFailure event')
			? chain_process_delivery_failure
			: subject === 'error'
			? chain_process_error
			: subject === 'callback'
			? chain_process_callback
			: chain_process_http;

		//! start chain processing.
		return Promise.resolve({ subject, data, context })
			.then(chain_next)
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
			_ => callback && callback(null, _.length)
		);
	};

	//! returns main SNS handler.
	return SNS;
};
