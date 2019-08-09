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
import forms from './api/forms-api';

//! Load Additional Handlers......
import { $SNS, $SQS } from 'lemon-core';

//! build additional handlers.....
const SNS = $SNS('forms');
const SQS = $SQS('forms');

//! export default.
export default Object.assign($engine, { forms, SNS, SQS });
