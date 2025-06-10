/**
 * `views.ts`
 * - type of views used in `transformer`
 *
 * @author      Claire <claire@lemoncloud.io>
 * @date        2025-06-04 initial version.
 *
 * @copyright   (C) 2025 LemonCloud Co Ltd. - All Rights Reserved.
 * @origin      `@lemoncloud/codes-goods-api/modules/resource`
 */
import { View, Body } from 'lemon-model';
import { SnsPayload, MessagePayload } from './types';

export interface PostSqsBody extends Body, Partial<MessagePayload> {}
export interface PostSnsBody extends Body, Partial<MessagePayload> {}

//! export all internal types
export * from './types';
