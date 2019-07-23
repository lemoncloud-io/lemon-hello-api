/**
 * API: /hello
 *  - hello lemon API
 *
 *
 * @author  Steve <steve@lemoncloud.io)
 * @date    2019-07-19
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
/** ********************************************************************************************************************
 *  Common Headers
 ** ******************************************************************************************************************* */
//! module.exports
module.exports = (_$, name) => {
	if (!_$) throw new Error('_$(global instance pool) is required!');

	//! load services (_$ defined in global)
	const $_ = _$._; // re-use global instance (lodash).
	const $U = _$.U; // re-use global instance (utils).
	if (!$U) throw new Error('$U(utillities) is required!');

	//! Name Space.
	const NS = $U.NS(name || 'GOOD', 'yellow'); // NAMESPACE TO BE PRINTED. (4자리 문자 추천)

	//! load common functions
	const _log = _$.log;
	const _inf = _$.inf;
	const _err = _$.err;

	/** ********************************************************************************************************************
	 *  Main Function for API export.
	 ** ******************************************************************************************************************* */
	const main = require('./bootload')(_$, NS, decode_next_handler);

	/** ********************************************************************************************************************
	 *  Decode Next Handler
	 ** ******************************************************************************************************************* */
	/**
	 * Decode Target Next Handler (promised function).
	 *
	 * @param {*} MODE 	method
	 * @param {*} ID 	id
	 * @param {*} CMD 	command
	 */
	function decode_next_handler(MODE, ID, CMD) {
		let next = null;
		switch (MODE) {
			case 'LIST':
				next = do_list_hello;
				break;
			case 'GET':
				if (false);
				else if (ID !== '!' && CMD === '') {
					next = do_get_hello;
				} else if (ID !== '!' && CMD === 'test-sns') {
					next = do_get_test_sns;
				} else if (ID !== '!' && CMD === 'test-sns-arn') {
					next = do_get_test_sns_arn;
				} else if (ID !== '!' && CMD === 'test-sns-err') {
					next = do_get_test_sns_err;
				} else if (ID !== '!' && CMD === 'test-encrypt') {
					next = do_get_test_encrypt;
				}
				break;
			case 'PUT':
				if (false);
				else if (ID !== '!' && CMD === '') {
					next = do_put_hello;
				}
				break;
			case 'POST':
				if (false);
				else if (ID !== '!' && CMD === '') {
					next = do_post_hello;
				} else if (ID !== '!' && CMD === 'slack') {
					next = do_post_hello_slack;
				}
				break;
			case 'DELETE':
				if (false);
				else if (ID !== '!' && CMD === '') {
					next = do_delete_hello;
				}
				break;
			case 'EVENT':
				break;
			// For WSS. use dummy handler.
			case 'CONNECT':
			case 'DISCONNECT':
				return () => 'ok';
			default:
				break;
		}
		return next;
	}

	// INFO - 이름 규칙 do_action_object().
	main.do_list_hello = do_list_hello;
	main.do_get_hello = do_get_hello;
	main.do_put_hello = do_put_hello;
	main.do_post_hello = do_post_hello;
	main.do_delete_hello = do_delete_hello;

	main.do_post_slack = do_post_hello_slack;

	/** ********************************************************************************************************************
	 *  Local Functions.
	 ** ******************************************************************************************************************* */
	const $kms = function() {
		if (!_$.kms) throw new Error('$kms(kms-service) is required!');
		return _$.kms;
	};

	const $sns = function() {
		if (!_$.sns) throw new Error('$sns(sns-service) is required!');
		return _$.sns;
	};

	//! shared memory.
	// WARN! - `serverless offline`는 상태를 유지하지 않으므로, NODES값들이 실행때마다 리셋이될 수 있음.
	const NODES = [
		{
			name: 'lemon',
		},
		{
			name: 'cloud',
		},
	];

	/**
	 * POST message to hookUrl.
	 *
	 * @param {*} hookUrl       URL
	 * @param {*} message       Object or String.
	 */
	const postMessage = (hookUrl, message) => {
		const url = require('url');
		const https = require('https');

		const body = typeof message === 'string' ? message : JSON.stringify(message);
		const options = url.parse(hookUrl);
		options.method = 'POST';
		options.headers = {
			'Content-Type': 'application/json',
			'Content-Length': Buffer.byteLength(body),
		};
		return new Promise((resolve, reject) => {
			const postReq = https.request(options, res => {
				const chunks = [];
				res.setEncoding('utf8');
				res.on('data', chunk => chunks.push(chunk));
				res.on('end', () => {
					const body = chunks.join('');
					const statusCode = res.statusCode || 200;
					const statusMessage = res.statusMessage || '';
					const result = { body, statusCode, statusMessage };
					_log(NS, `> post(${hookUrl}) =`, result);
					if (statusCode < 400) {
						resolve(result);
					} else {
						reject(result);
					}
				});
				return res;
			});
			postReq.write(body);
			postReq.end();
		});
	};

	//! store channel map in cache
	const $channels = {};
	const do_load_slack_channel = name => {
		const ENV_NAME = `SLACK_${name}`.toUpperCase();
		const $env = process.env || {};
		const webhook = $channels[ENV_NAME] || $env[ENV_NAME] || '';
		_log(NS, '> webhook :=', webhook);
		if (!webhook) return Promise.reject(new Error(`env[${ENV_NAME}] is required!`));
		return Promise.resolve(webhook)
			.then(_ => {
				if (!_.startsWith('http')) {
					return $kms()
						.do_decrypt(_)
						.then(_ => {
							const url = `${_}`.trim();
							$channels[ENV_NAME] = url;
							return url;
						});
				}
				return _;
			})
			.then(_ => {
				if (!(_ && _.startsWith('http'))) {
					throw new Error(`404 NOT FOUND - Channel:${name}`);
				}
				return _;
			});
	};

	/** ********************************************************************************************************************
	 *  Public API Functions.
	 ** ******************************************************************************************************************* */
	/**
	 * Search by params
	 *
	 * ```sh
	 * $ http ':8888/hello/'
	 * ```
	 * @param {*} ID 			id of object
	 * @param {*} $param		query parameters (json)
	 * @param {*} $body			body parameters (json)
	 * @param {*} $ctx			context (optional)
	 */
	function do_list_hello(ID, $param, $body, $ctx) {
		_log(NS, `do_list_hello(${ID})....`);

		const that = {};
		that.name = _$.environ('NAME'); // read via process.env
		return Promise.resolve(that).then(_ => {
			_.list = NODES;
			return _;
		});
	}

	/**
	 * Read the detailed object.
	 *
	 * ```sh
	 * $ http ':8888/hello/0'
	 */
	function do_get_hello(ID, $param, $body, $ctx) {
		_log(NS, `do_get_hello(${ID})....`);

		const id = $U.N(ID, 0);
		const node = NODES[id];
		if (!node) return Promise.reject(new Error(`404 NOT FOUND - id:${id}`));
		return Promise.resolve(node).then(_ => {
			const node = Object.assign({}, _); // copy node.
			node._id = id;
			return node;
		});
	}

	/**
	 * Only Update with incremental support
	 *
	 * ```sh
	 * $ echo '{"size":1}' | http PUT ':8888/hello/1'
	 */
	function do_put_hello(ID, $param, $body, $ctx) {
		_log(NS, `do_put_hello(${ID})....`);
		$param = $param || {};

		return do_get_hello(ID, null, null, $ctx).then(node => {
			const id = node._id;
			Object.assign(NODES[id], $body || {});
			return Object.assign(node, $body || {});
		});
	}

	/**
	 * Insert new Node at position 0.
	 *
	 * ```sh
	 * $ echo '{"name":"lemoncloud"}' | http POST ':8888/hello/0'
	 */
	function do_post_hello(ID, $param, $body, $ctx) {
		_log(NS, `do_post_hello(${ID})....`);
		$param = $param || {};
		if (!$body && !$body.name) return Promise.reject(new Error('.name is required!'));

		return Promise.resolve($body).then(node => {
			NODES.push(node);
			return NODES.length - 1; // returns ID.
		});
	}

	/**
	 * Post message via Slack Web Hook
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
	function do_post_hello_slack(ID, $param, $body, $ctx) {
		_log(NS, `do_post_hello_slack(${ID})....`);
		$param = $param || {};

		const message = typeof $body === 'string' ? { text: $body } : $body;
		//! load target webhook via environ.
		return do_load_slack_channel(ID).then(webhook => {
			_log(NS, '> webhook :=', webhook);
			// return { webhook }
			return postMessage(webhook, message);
		});
	}

	/**
	 * Delete Node (or mark deleted)
	 *
	 * ```sh
	 * $ http DELETE ':8888/hello/1'
	 */
	function do_delete_hello(ID, $param, $body, $ctx) {
		_log(NS, `do_delete_hello(${ID})....`);

		return do_get_hello(ID, null, null, $ctx).then(node => {
			const id = node._id;
			if (id === undefined) return Promise.reject(new Error('._id is required!'));
			// NODES.splice(id, 1);                // remove single node.
			delete NODES[id]; // set null in order to keep id.
			return node;
		});
	}

	/**
	 * Read the detailed object.
	 *
	 * ```sh
	 * $ http ':8888/hello/alarm/test-sns'
	 * $ http ':8888/hello/failure/test-sns'
	 */
	function do_get_test_sns(ID, $param, $body, $ctx) {
		_log(NS, `do_get_test_sns(${ID})....`);

		//! build event body, then start promised
		const build_event_chain = (subject, data) => {
			//! clear internals
			data = Object.keys(data).reduce((N, key) => {
				if (!key.startsWith('!')) N[key] = data[key];
				return N;
			}, {});
			//! prepare event body.
			const event = {
				Records: [
					{
						Sns: {
							Subject: subject || 'ALARM: "...." in Asia Pacific (Seoul)',
							Message: data,
						},
					},
				],
			};
			return Promise.resolve(event);
		};

		//! call sns handler.
		const local_chain_handle_sns = event => {
			const $SNS = require('../../SNS')(_$);
			if (!$SNS) return Promise.reject(new Error('.SNS is required!'));

			//! validate event
			event = event || {};
			if (!event.Records || !Array.isArray(event.Records)) return Promise.reject(new Error('.Records[] is required!'));
			if (!event.Records[0] || !event.Records[0].Sns) return Promise.reject(new Error('.Records[0].Sns is required!'));
			if (!event.Records[0].Sns.Subject || !event.Records[0].Sns.Message)
				return Promise.reject(new Error('.Records[0].Sns.Subject is required!'));

			//! call handler.
			return new Promise((resolve, reject) => {
				$SNS(event, $ctx, (err, res) => {
					if (err) reject(err);
					else resolve(res);
				});
			});
		};

		//! decode by ID
		return (() => {
			if (ID == 'alarm') {
				const data = require('../../data/alarm.json');
				return build_event_chain('ALARM: "...." in Asia Pacific (Seoul)', data);
			}
			if (ID == 'failure') {
				const data = require('../../data/delivery-failure.json');
				return build_event_chain(data['!Subject'] || 'DeliveryFailure', data);
			}
			return Promise.reject(new Error(`404 NOT FOUND - test-sns:${ID}`));
		})().then(local_chain_handle_sns);
	}

	/**
	 * Test SNS ARN
	 *
	 * ```sh
	 * $ http ':8888/hello/0/test-sns-arn'
	 */
	function do_get_test_sns_arn(ID, $param, $body, $ctx) {
		_log(NS, `do_get_test_sns_arn(${ID})....`);
		return $sns()
			.arn()
			.then(arn => {
				_log(NS, '> arn =', arn);
				return arn;
			});
	}

	/**
	 * Test SNS Report Error
	 *
	 * ```sh
	 * $ http ':8888/hello/0/test-sns-err'
	 */
	function do_get_test_sns_err(ID, $param, $body, $ctx) {
		_log(NS, `do_get_test_sns_err(${ID})....`);
		const e = new Error('Test Error');
		return $sns()
			.reportError(e)
			.then(mid => {
				_log(NS, '> message-id =', mid);
				return mid;
			});
	}

	/**
	 * Encrypt Test.
	 *
	 * ```sh
	 * $ http ':8888/hello/0/test-encrypt'
	 */
	function do_get_test_encrypt(ID, $param, $body, $ctx) {
		_log(NS, `do_get_test_encrypt(${ID})....`);
		const message = 'hello lemon';
		return $kms()
			.do_encrypt(message)
			.then(encrypted =>
				$kms()
					.do_decrypt(encrypted)
					.then(decrypted => ({ encrypted, decrypted, message }))
			)
			.then(_ => {
				const result = _.encrypted && _.message === _.decrypted;
				return Object.assign(_, { result });
			});
	}

	//! return fially.
	return main;
	// ////////////////////////
	// - end of module.exports
};
