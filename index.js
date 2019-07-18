/* eslint-disable global-require */
/* eslint-disable import/no-dynamic-require */
/**
 * index.js
 * - root index.js
 *
 *
 */

/**
 * factory of express()
 *
 * @param {*} env   environment config like `process.env`
 */
const express = (env) => {
  const SRC = (env && env.SRC) || './dist/';
  const $express = require(`${SRC}express`);
  return $express;
};


/**
 * factory of handler()
 *
 * @param {*} env   environment config like `process.env`
 */
const handler = () => {
  const $handler = require('./handler');
  return $handler;
};

//! export default
module.exports = { express, handler };
