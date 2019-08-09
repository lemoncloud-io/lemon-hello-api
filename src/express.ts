/**
 * Express Server Application.
 * - standalone http service with express.
 *
 *
 * @author  Steve Jung <steve@lemoncloud.io>
 * @date    2019-08-09 optimized with `lemon-core#1.0.1`
 *
 * @copyright (C) lemoncloud.io 2019 - All Rights Reserved.
 */
/** ****************************************************************************************************************
 *  Override Environ
 ** ****************************************************************************************************************/
//NOTE - 다음이 있어야, Error 발생시 ts파일에서 제대로된 스택 위치를 알려줌!!!.
require('source-map-support').install();
import environ from 'lemon-core/dist/environ';

//! override environment with yml (only for local)
const $env = environ(process);
process.env = $env;

//! next 2 lines important to init core properly.
import { engine } from './index';
const $engine = engine();

//! build express engine.
import { buildExpress } from 'lemon-core';
export const { express, app, createServer } = buildExpress($engine);

//! default exports.
export default { express, app, createServer };
