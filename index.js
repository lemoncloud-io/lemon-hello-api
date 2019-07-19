/**
 * factory of express()
 *
 * @param {*} env   environment config like `process.env`
 */
const express = env => {
	const $express = require(`./dist/express`);
	return $express;
};

/**
 * factory of handler()
 *
 * @param {*} env   environment config like `process.env`
 */
const handler = env => {
	const $handler = require('./handler');
	return $handler;
};

//! export default
module.exports = { express, handler };
