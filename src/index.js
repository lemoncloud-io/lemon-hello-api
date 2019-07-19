/**
 * main factory function of lemon instance manager
 *
 *
 * ```js
 * const scope = { name: 'lemon-hello' };
 * const environ = process.env || {};
 * const engine = require('lemon-hello-api')(scope, environ);
 * // call target
 * const res = engine('hello').do_get_hello('0')
 * ```
 *
 * @param $scope    main scope.
 * @param $environ	configuration environment like `process.env`.
 *
 * @author  Steve <steve@lemoncloud.io)
 * @date    2019-07-19
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
module.exports = function factory($scope, $environ) {
	// eslint-disable-next-line no-underscore-dangle
	function _$$() {} // global container.(dummy instance pointer)

	// ! make sure not null
	$scope = $scope || new _$$();
	$environ = $environ || {};

	//! load configuration.
	const ROOT_NAME = $scope.name || 'lemon';
	const STAGE = _get_env('STAGE', '');
	const LS = _get_env('LS', '0') === '1'; // LOG SILENT (NO PRINT LOG)
	const TS = _get_env('TS', '1') === '1'; // PRINT TIME-STAMP.
	const LC = STAGE === 'local' || STAGE === 'express' || _get_env('LC', '') === '1'; // COLORIZE LOG.

	const RED = '\x1b[31m';
	const BLUE = '\x1b[32m';
	const YELLOW = '\x1b[33m';

	//! common function for logging.
	const silent = () => {};
	const $console = {
		thiz: console,
		// eslint-disable-next-line no-console
		log: LS ? silent : console.log,
		// eslint-disable-next-line no-console
		error: LS ? silent : console.error,
		auto_ts: TS,
		auto_color: LC,
	};
	const _log = function() {
		const args = (!Array.isArray(arguments) && Array.prototype.slice.call(arguments)) || arguments;
		if ($console.auto_color)
			args.unshift('\x1b[0m'), ($console.auto_ts && args.unshift(_ts(), 'L')) || args.unshift('L'), args.unshift(BLUE);
		else $console.auto_ts && args.unshift(_ts(), 'L');
		return $console.log.apply($console.thiz, args);
	};
	const _inf = function() {
		const args = (!Array.isArray(arguments) && Array.prototype.slice.call(arguments)) || arguments;
		if ($console.auto_color)
			args.unshift(''),
				args.push('\x1b[0m'),
				($console.auto_ts && args.unshift(_ts(), 'I')) || args.unshift('I'),
				args.unshift(YELLOW);
		else $console.auto_ts && args.unshift(_ts(), 'I');
		return $console.log.apply($console.thiz, args);
	};
	const _err = function() {
		const args = (!Array.isArray(arguments) && Array.prototype.slice.call(arguments)) || arguments;
		if ($console.auto_color)
			args.unshift(''),
				args.push('\x1b[0m'),
				($console.auto_ts && args.unshift(_ts(), 'E')) || args.unshift('E'),
				args.unshift(RED);
		else $console.auto_ts && args.unshift(_ts(), 'E');
		return $console.error.apply($console.thiz, args);
	};
	const _extend = function(opt, opts) {
		// simple object extender.
		for (const k in opts) {
			const v = opts[k];
			if (v === undefined) delete opt[k];
			else opt[k] = v;
		}
		return opt;
	};
	function _ts(_d) {
		// timestamp like 2016-12-08 13:30:44
		const dt = _d || new Date();
		const [y, m, d, h, i, s] = [
			dt.getFullYear(),
			dt.getMonth() + 1,
			dt.getDate(),
			dt.getHours(),
			dt.getMinutes(),
			dt.getSeconds(),
		];
		return `${(y < 10 ? '0' : '') + y}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d} ${h < 10 ? '0' : ''}${h}:${
			i < 10 ? '0' : ''
		}${i}:${s < 10 ? '0' : ''}${s}`;
	}
	function _get_env(name, defVal) {
		// as default, load from proces.env.
		const env = $environ || (process && process.env) || {};
		const val = typeof env[name] !== 'undefined' ? env[name] : undefined;
		// throw Error if value is not set.
		if (defVal && defVal instanceof Error && val === undefined) throw defVal;
		// returns default.
		return val === undefined ? defVal : val;
	}

	//! root instance to manage global objects.
	var _$ = function(name, opts) {
		// global identifier.
		if (!name) return;
		const thiz = _$; // 인스턴스 바꿔치기: _$('hello') == _$.hello
		let opt = typeof thiz[name] !== 'undefined' ? thiz[name] : undefined;
		if (opts === undefined) return opt;
		if (opt === undefined) {
			_log(`INFO! service[${name}] registered`);
			thiz[name] = opts;
			return opts;
		}
		//! extends options.
		_err(`WARN! service[${name}] exists! so extends `);
		opt = opt || {};
		opts = opts || {};
		opt = _extend(opt, opts);
		thiz[name] = opt;
		return opt;
	};

	// register into _$(global instance manager).
	_$.STAGE = STAGE;
	_$.id = ROOT_NAME;
	_$.log = _log;
	_$.inf = _inf;
	_$.err = _err;
	_$.extend = _extend;
	_$.ts = _ts;
	_$.environ = _get_env;
	_$.$console = $console; // '$' means object. (change this in order to override log/error message handler)
	_$.toString = () => ROOT_NAME || '$ROOT';

	// register as global instances.
	$scope._log = _log;
	$scope._inf = _inf;
	$scope._err = _err;
	$scope._$ = _$;
	$scope[_$.id] = _$;

	//! load underscore(or lodash) for global utility.
	const _ = require('lodash/core'); // underscore utilities.
	_$('_', _); // register: underscore utility.

	//! initialize in addition.
	initialize.apply(_$, [$scope]);

	//! returns root function.
	return _$;
};

/** ********************************************************************************************************************
 *  main application
 ** ****************************************************************************************************************** */
/**
 * initialize application.
 *
 * @param {*} $export   main export
 */
function initialize($export) {
	//! load main instance.
	const thiz = this; // it must be $root.
	const _$ = thiz;

	if (!$export) throw new Error('$export is required.');
	if (!_$) throw new Error('_$ is required.');
	if (typeof _$ !== 'function') throw new Error('_$ should be function.');

	//! load common functions
	const _inf = _$.inf;

	//! load configuration.
	const STAGE = _$.environ('STAGE', '');
	STAGE && _inf('#STAGE =', STAGE);

	//! load utilities & aws
	const $U = require('./lib/utilities')(_$);
	const $aws = require('aws-sdk'); // AWS module.

	//! register to global instance manager.
	_$('U', $U);
	_$('aws', $aws);

	//! load basic core services......
	const $kms = require('./service/kms-service')(_$);
	const $sns = require('./service/sns-service')(_$);
	_$('kms', $kms);
	_$('sns', $sns);

	//! load api functions............
	const hello = require('./api/hello-api')(_$);
	_$('hello', hello);

	//! export.
	return Object.assign($export, { hello });
}
