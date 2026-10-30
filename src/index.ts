/**
 * `index.ts`
 * - main index to export
 *
 * **NOTE**
 * - DO `NOT EXPORT` ANY ADDITIONALS DUE TO TIME OF ENGINE INITIALIZER.
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
/** ********************************************************************************************************************
 *  Loading API Services.
 ** ********************************************************************************************************************/
/**
 * start engine intialize, and returns.
 */
export const engine = () => {
    const $engine = require('./engine').default;
    return $engine;
};

/**
 * start load express, and returns
 */
export const express = () => {
    const $express = require('./express').default;
    return $express;
};

/** ********************************************************************************************************************
 *  MAIN RUNNER
 *
 * # Usage
 * - required to run `$ npm run express`
 *
 * ```sh
 * # run express in local
 * $ node .
 * ```
 *
 * - v5: the `lemon-core/dist/exec-cli` batch runner is gone (HOW_TO_UPGRADE_V5 § 12).
 ** *******************************************************************************************************************/
if (typeof require !== 'undefined' && require.main === module) {
    //* start the local express server.
    const $express = express();
    $express.createServer();
}
