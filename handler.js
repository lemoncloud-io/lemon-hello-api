'use strict';
/** ********************************************************************************************************************
 *  Serverless API Handlers
 *  - optimized to export handler functions for serverless.
 * 	- mainly export API handler which is includes in main loader.
 ** *******************************************************************************************************************/
////////////////////////////////////////////////////////////////////////
// COMMON ENVIRONMENT LOADER
const $env = process.env;                                   //NOTE! - serverless may initialize environment with opt.

//! SETUP TIMEZONE @2019/03/14
process.env.TZ = 'Asia/Seoul';

//! TARGET SOURCE FOLDER.
const SRC = $env.SRC || './src/';

//! PREPARE RUNNING SCOPE.
const $scope = {
	name : 'LEMON-API'
	,env : $env
}

//! load configuration.
const handler = require(SRC+'index')(0 ? global : $scope);

//! Common SNS Handler for lemon-protocol integration.
const SNS      = require('./SNS')(_$);

//! export serverless handlers.
module.exports = Object.assign(handler, {SNS})
