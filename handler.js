/* eslint-disable import/no-dynamic-require */
/** ********************************************************************************************************************
 *  Serverless API Handlers
 *  - optimized to export handler functions for serverless.
 *  - mainly export API handler which is includes in main loader.
 ** ****************************************************************************************************************** */
// COMMON ENVIRONMENT LOADER
const $env = process.env || {}; // NOTE! - serverless may initialize environment with opt.

//! SETUP TIMEZONE @2019/03/14
process.env.TZ = 'Asia/Seoul';

//! TARGET SOURCE FOLDER.
const SRC = $env.SRC || './dist/';

//! PREPARE EXPORT SCOPE.
const $scope = { name: 'lemon-hello-api' };

//! load configuration.
const $lemon = require(`${SRC}index`)($scope, $env);

//! Load Additional Handlers
const SNS = require(`${SRC}sns`)($lemon);
const SQS = require(`${SRC}sqs`)($lemon);
const WSS = require(`${SRC}wss`)($lemon);

//! export serverless handlers.
module.exports = Object.assign($scope, { SNS, WSS, SQS });
