/**
 * Common utilities.
 *
 * author: xeni <coolxeni@gmail.com> (coolxeni@gmail.com)
 * date : 2017-07-25
 */
module.exports = (function (_$) {
	"use strict";

	const thiz = {};
	// var _request = require('request');
	// var _promise = require('bluebird');
	// if(!_request) throw new Error('request is required!');
	const NS = _NS('util');

	// use underscore util.
	const $_ = _$._;                                // re-use global instance (utils).
	if (!$_) throw new Error('$_ is required!');

	//////////////////////////////////////////////////
	// define public exports.
	thiz.name = `${NS}-utils`;
	thiz.ts = _ts;									    // timestamp
	thiz.dt = _dt;									    // date
	thiz.now = _dt;									    // now
	thiz.escape = _escape;								// escape string
	thiz.cleanup = _cleanup;							// clean-up '_', '$' members.
	thiz.updated = _updated;							// clean-up '_', '$' members.
	thiz.copy = _copy;							        // shollow copy object.
	thiz.N = _N;									    // Number conversion.
	thiz.F = _F;									    // Number conversion.
	thiz.current_time_ms = _current_time_ms;            // Current millisecond time (UTC+0)
	thiz.NS = _NS;									    // NameSpace Maker.
	thiz.env = get_env;

	thiz.extend = _extend;								// extends object
	thiz.isset = _isset;								// check undefined.
	thiz.empty = _empty;								// check valid
	thiz.min = _min;									// min
	thiz.max = _max;									// max
	thiz.round = _round;								// round
	thiz.json = _json;								    // JSON function to stringify
	thiz.diff = _diff;                                  // Object Different.
	thiz.copy_node = _copy_node;				        // copy object without '_', '$' members.
	thiz.bare_node = _bare_node;                        // Bare Node with only core members.
	thiz.diff_node = _diff_node;                        // Node Different by ignoring '_','$' members.
	thiz.hash = _hash;                                  // Get Hash Value (32-bits)
	thiz.md5 = _md5;                                  	// Get md5 hash Value with encoding(default hex, base64)
	thiz.hmac = _hmac;                                  // Get hmac key-validate hash Value

	thiz.logger_factory = _logger_factory;				//! logger factory : logger_factory().create('hi');
	thiz.promise = _promise;                            //! promise 객체를 준비.
	thiz.promise_sequence = _promise_sequence;          //! array() 들에 대해서 하나씩 실행할 수 있음.


	//////////////////////////////////////////////////
	// Function Definitions.
	var _log = _log || _$.log || function () {
			return dummy_log(arguments, 'I')
		};
	var _err = _err || _$.err || function () {
			return dummy_log(arguments, 'E')
		};
	var _is_dev = _is_dev || function () {
			var env = get_env('ENV') || get_env('NODE_ENV') || get_env('STAGE');;
			return (env === 'production' || env === 'op') ? false : true;
		};

	//! exports functions.
	thiz.log = _log;
	thiz.err = _err;
	thiz.is_dev = _is_dev();

	//! some helper function.s
	function get_env(name, def_val) {
		// ovrride get_env() function.
		if (typeof _$.get_env === 'function')		return _$.get_env(name, def_val);
		if (typeof _$.environ === 'function')		return _$.environ(name, def_val);

		// as default, load from proces.env.
		let val = process && process.env[name] || undefined;
		return val === undefined ? def_val : val;
	}

	// dummy logger.
	function _logger_factory() {
		//env = env||process.env||{};
		return {
			create: function (name, path) {
				name = name || NS;
				path = path || '/var/www/html/logs/';
				let log4js = require('log4js');
				let log_file = path + name + '.log';
				log4js.loadAppender('file');
				log4js.addAppender(log4js.appenders.file(log_file), name);
				return log4js.getLogger(name);
			}
		}
	}

	//WARN! DO NOT MAKE LOGGER IN HERE.
	var _logger = 1 ? null : _logger_factory && _logger_factory.create(get_env('ENV') || 'op');
	var dummy_log = function (args, t) {
		if (_logger) {
			if (t == 'E') {
				_logger.error.apply(_logger, args);
			} else {
				_logger.info.apply(_logger, args);
			}
		}
		else if (typeof console != 'undefined') {
			if (true) {
				if (!Array.isArray(args)) {
					args = Array.prototype.slice.call(args);
				}
				if (t) args.unshift(t);
				args.unshift(_ts());
			}
			if (t == 'E') {
				console.error.apply(console, args);
			} else {
				console.log.apply(console, args);
			}
		}
		return true;
	};

	function _extend(a, b) {
		for (var x in b) a[x] = b[x];
		return a;
	}

	function _isset(x) {
		return x === undefined ? false : true;
	}

	function _empty(x) {
		return x ? false : true;
	}

	function _min(a, b) {
		return a < b ? a : b;
	}

	function _max(a, b) {
		return a > b ? a : b;
	}

	function _round(a) {
		return Math.round(a)
	}

	function _json(o, isSorted) {
		if (isSorted){
			var output = {};
			Object.keys(o).sort().forEach(function (key) {
				output[key] = o[key];
			});
			o = output;
		}
		return o && JSON.stringify(o) || o;
	}

	// timestamp value.
	function _ts(d) {
		var dt = (d && typeof d === 'object' ? d : d ? new Date(d) : new Date());
		var y = dt.getFullYear();
		var m = dt.getMonth() + 1; //Months are zero based
		var d = dt.getDate();

		var h = dt.getHours();
		var i = dt.getMinutes();
		var s = dt.getSeconds();

		var ret = (y < 10 ? "0" : "") + y + "-" + (m < 10 ? "0" : "") + m + "-" + (d < 10 ? "0" : "") + d + " "
			+ (h < 10 ? "0" : "") + h + ":" + (i < 10 ? "0" : "") + i + ":" + (s < 10 ? "0" : "") + s;
		return ret;
	};

	// parse timestamp to date.
	function _dt(ts) {
		ts = ts || _ts();
		var aa = ts.split(' ');
		var dd = aa[0].split('-');
		var hh = aa[1].split(':');
		var y = parseInt(dd[0]), m = parseInt(dd[1]) - 1, d = parseInt(dd[2]);
		var h = parseInt(hh[0]), i = parseInt(hh[1]), s = parseInt(hh[2]);
		//! addtional function: add_seconds()
		if (!Date.prototype.add_seconds) {
			Date.prototype.add_seconds = function (dx) {
				this.setSeconds(this.getSeconds() + dx);
				return this;
			}
		}
		//! format to time-stamp.
		if (!Date.prototype.ts) {
			Date.prototype.ts = function () {
				return _ts(this);
			}
		}
		var dt = new Date(y, m, d, h, i, s, 0);
		return dt;
	}

	/**
	 * 현재 시간값 (number of milliseconds since midnight of January 1, 1970.)
	 *
	 *
	 * @returns {number}
	 */
	function _current_time_ms(){
		//TODO:XENI - 서버와 시간 동기화를 위해서, 디비서버에등에서 일체화된 시간 동기값을 환산하여 준다.
		var time_shift = 0;

		var ret = new Date().getTime();
		ret += time_shift;
		return ret;
	}

	/**
	 * NameSpace Maker.
	 *
	 * @returns {string}
	 */
	function _NS(ns, color, len){
		if(!ns) return ns;
		len = len||4;
		len = len - ns.length;
		len = len < 0 ? 0 : len;
		const SPACE = '           ';
		ns = SPACE.substr(0, len) + ns +':';
		if(thiz.is_dev && color){
			const COLORS = {
				'red' : "\x1b[31m",
				'green' : "\x1b[32m",
				'yellow' : "\x1b[33m",
				'blue' : "\x1b[34m",
				'magenta' : "\x1b[35m",
				'cyan' : "\x1b[36m",
				'white' : "\x1b[37m",
			}
			ns = COLORS[color] + ns + "\x1b[0m";
		}
		return ns;
	}

	// escape string for mysql.
	function _escape(str, urldecode) {
		if (str === undefined) return 'NULL';
		if (isInteger(str)) return str;
		str = str || '';
		if (typeof str == 'object') {
			str = JSON.stringify(str);
		}
		str = str.replace(/\\/g, "\\\\")
			.replace(/\$/g, "\\$")
			.replace(/'/g, "\\'")
			.replace(/"/g, "\\\"");

		if (urldecode) {
			// url-decode
			str = decodeURI(str);
		}
		return "'" + str + "'";
	}

	// convert to integer.
	function isInteger(x) {
		return (typeof x === 'number') && (x % 1 === 0);
	}

	function _N(x, def) {
		try {
			if (x === '' || x === undefined || x === null) return def;
			if ((typeof x === 'number') && (x % 1 === 0)) return x;
			if (typeof x == 'number') return parseInt(x);
			x = ('0' + x);
			x = x.startsWith('0-') ? x.substr(1) : x;			// minus
			return parseInt(x.replace(/,/ig, '').trim())
		} catch (e) {
			_err('err at _N: x=' + x + ';' + (typeof x) + ';' + (e.message || ''), e);
			return def;
		}
	}

	//! parse float number (like 1.01)
	function _F(x, def) {
		try {
			if (x === '' || x === undefined || x === null) return def;
			if ((typeof x === 'number') && (x % 1 === 0)) return x;
			if (typeof x == 'number') return parseFloat(x);
			x = ('0' + x);
			x = x.startsWith('0-') ? x.substr(1) : x;			// minus
			return parseFloat(x.replace(/,/ig, '').trim())
		} catch (e) {
			_err('err at _N: x=' + x + ';' + (typeof x) + ';' + (e.message || ''), e);
			return def;
		}
	}

	//! remove underscore variables.
	function _cleanup($N) {
		return Object.keys($N).reduce(function($N, key) {
			if (key.startsWith('_')) delete $N[key];
			if (key.startsWith('$')) delete $N[key];
			return $N;
		}, $N)
	}

	//! remove underscore variables.
	function _updated(that, that2) {
		const updated = Object.keys(that2).reduce((self, key) => {
			if (that[key] !== that2[key]) {
				if (that[key] === null && that2[key] === ''){			// both same.
					return self;
				}
				self[key] = that2[key];
			}
			return self;
		}, {});
		return updated;
	}

	function _copy($N) {
		return Object.keys($N).reduce(function($n, key) {
			$n[key] = $N[key]
			return $n;
		}, {})
	}

	function _copy_node($N, isClear) {
		isClear = isClear === undefined ? false : isClear;
		return Object.keys($N).reduce(function($n, key) {
			if(key.startsWith('_')) return $n;
			if(key.startsWith('$')) return $n;
			$n[key] = isClear ? null : $N[key]
			return $n;
		}, {})
	}

	//! clean up all member without only KEY member.
	function _bare_node($N, opts) {
		// return Object.keys($N).reduce(function($n, key) {
		// 	if(key.startsWith('_')) return $n;
		// 	if(key.startsWith('$')) return $n;
		// 	$n[key] = $N[key]
		// 	return $n;
		// }, {})
		let $n = {};
		$n._id = $N._id;
		$n._current_time = $N._current_time;
		if (opts) $n = _extend($n, opts);
		return $n;
	}

	function _diff(obj1, obj2) {
		const diff = Object.keys(obj1).reduce((result, key) => {
			if (!obj2.hasOwnProperty(key)) {
				result.push(key);
			} else if ($_.isEqual(obj1[key], obj2[key])) {
				const resultKeyIndex = result.indexOf(key);
				result.splice(resultKeyIndex, 1);
			}
			return result;
		}, Object.keys(obj2));

		return diff;
	}

	function _diff_node(obj1, obj2) {
		let keys1 = [], keys2 = [];
		Object.keys(obj1).forEach(key=>{
			if(key.startsWith('_')) return;
			if(key.startsWith('$')) return;
			keys1.push(key);
		})
		Object.keys(obj2).forEach(key=>{
			if(key.startsWith('_')) return;
			if(key.startsWith('$')) return;
			keys2.push(key);
		})
		const diff = keys1.reduce((result, key) => {
			if (!obj2.hasOwnProperty(key)) {
				result.push(key);
			} else if ($_.isEqual(obj1[key], obj2[key])) {
				const resultKeyIndex = result.indexOf(key);
				result.splice(resultKeyIndex, 1);
			}
			return result;
		}, keys2);

		return diff;
	}

	function _hash(data){
		data = data||'';
		data = typeof data === 'object' ? _json(data, true) : data;     //WARN! it must be sorted json.
		data = typeof data !== 'string' ? String(data) : data;
		/**
		 * Calculate a 32 bit FNV-1a hash
		 * Found here: https://gist.github.com/vaiorabbit/5657561
		 * Ref.: http://isthe.com/chongo/tech/comp/fnv/
		 *
		 * @param {string} str the input value
		 * @param {boolean} [asString=false] set to true to return the hash value as
		 *     8-digit hex string instead of an integer
		 * @param {integer} [seed] optionally pass the hash of the previous chunk
		 * @returns {integer | string}
		 */
		const hashFnv32a = function(str, asString, seed) {
			/*jshint bitwise:false */
			let i, l;
			let hval = (seed === undefined) ? 0x811c9dc5 : seed;

			for (i = 0, l = str.length; i < l; i++) {
				hval ^= str.charCodeAt(i);
				hval += (hval << 1) + (hval << 4) + (hval << 7) + (hval << 8) + (hval << 24);
			}
			if (asString){
				// Convert to 8 digit hex string
				return ("0000000" + (hval >>> 0).toString(16)).substr(-8);
			}
			return hval >>> 0;
		}
		return hashFnv32a(data);
	}

	//! start promise chain.
	function _promise(param){
		return new Promise(function (resolve, reject) {
			resolve(param);
		});
	}

	//! promise in sequence.
	// example) promise_sequence([1,2,3], item => item+1);
	function _promise_sequence(array, func){
		let chain = _promise(array.shift());
		chain = array.reduce((chain, item) => {
			return chain.then(() => func(item));
		}, chain.then(item => func(item)));
		return chain;
	}

	function _md5(data, digest){
		const crypto = require('crypto');
		digest = digest === undefined ? 'hex' : digest;
		return crypto.createHash('md5').update(data).digest(digest);
	}

	function _hmac(data, KEY, algorithm, encoding){
		const crypto = require('crypto');
		KEY = KEY || 'XENI';
		encoding = encoding || "base64";
		algorithm = algorithm || "sha256";
		return crypto.createHmac(algorithm, KEY).update(data).digest(encoding);
	}

	return thiz;
});