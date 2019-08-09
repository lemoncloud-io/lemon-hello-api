/**
 * `engine.ts`
 * - main index to export
 *
 *
 * @author  Steve Jung <steve@lemoncloud.io>
 * @date    2019-07-31 support ECMA 2016.
 * @date    2019-08-09 optimized with `lemon-core#1.0.1`
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
/** ********************************************************************************************************************
 *  start initializing `lemon-core` with global `process.env`
 ** ********************************************************************************************************************/
import { $engine } from 'lemon-core';

/** ********************************************************************************************************************
 *  Loading API Services.
 ** ********************************************************************************************************************/
import hello from './api/hello-api';

//! load services, and export.
import * as $kms from './service/kms-service';
import * as $s3s from './service/s3s-service';
import * as $sns from './service/sns-service';
export { $kms, $s3s, $sns };

//! Load Additional Handlers......
import $SNS from './builder/SNS';
import { $SQS } from 'lemon-core';

//! build additional handlers.....
export const SNS = $SNS('hello');
export const SQS = $SQS('hello');

//! export default.
export default Object.assign($engine, { hello, SNS, SQS });
