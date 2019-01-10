'use strict';
/** ********************************************************************************************************************
 *  Serverless API Handlers
 *  - optimized to export handler functions for serverless.
 * 	- mainly export API handler which is includes in main loader.
 ** *******************************************************************************************************************/
const IS_OP = 0;                            //!WARN - only for debug. set false in local run.
const SRC = IS_OP ? './dist/' : './src/';

const $scope = {
	name : 'LEMON-API'
	,env : process.env						// environment setting.
}

//! load configuration.
const handler = require(SRC+'index')(0 ? global : $scope);

//! API Handler.
const hello = handler.hello;

//! export serverless handlers.
module.exports = {hello};
