/**
 * `engine.ts`
 * - main index to export
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2019-07-31 support ECMA 2016.
 * @date        2019-08-09 optimized with `lemon-core#1.0.1`
 * @date        2019-11-26 optimized with `lemon-core#2.0.0`
 * @date        2019-12-03 optimized with `lemon-core#2.0.3`
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
/** ********************************************************************************************************************
 *  start initializing `lemon-core` with global `process.env`
 ** ********************************************************************************************************************/
import { $engine } from 'lemon-core';

// Loading API Service of NextDecoder
import hello from './api/hello-controller'; //NOTE - it should be `NextDecoder`.

//! import the default core services.
import $core from 'lemon-core';

const $lambda = $core.cores.lambda;
const $web = $lambda.web;
const $sqs = $lambda.sqs;
const $sns = $lambda.sns;

//! register sub handlers, and listeners.
// $web.setHandler('hello', hello);
$web.addController(hello);

//! export with used cores services.
export { $lambda, $web, $sqs, $sns };

//! default exports with lambda handler.
const lambda = async (e: any, c: any) => $lambda.lambda.handle(e, c);
export default { $engine, lambda };
