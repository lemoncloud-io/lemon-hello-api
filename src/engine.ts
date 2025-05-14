/**
 * `engine.ts`
 * - main index to export
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
/** ********************************************************************************************************************
 *  start initializing `lemon-core` with global `process.env`
 ** ********************************************************************************************************************/
import $cores, { $engine } from 'lemon-core';

//* Lambda handlers
const $lambda = $cores.cores.lambda;
const $web = $lambda.web;
const $sqs = $lambda.sqs;
const $sns = $lambda.sns;
const $alb = $lambda.alb;

//* Loading API Service of NextDecoder
import $hello from './api/hello-api'; //NOTE - it should be `NextDecoder`.

//* register sub handlers, and listeners.
$web.addController($hello);
$alb.setHandler($hello.doALB);

//* export with used cores services.
export { $lambda, $web, $sqs, $sns };

//* default exports with lambda handler.
const lambda = async (e: any, c: any) => $lambda.lambda.handle(e, c);
export default { $engine, lambda };
