/**
 * `types.ts`
 * - basic types used in `proxy`
 *
 * **[중요! exports 순서]**
 * 1. define data type in `types.ts` w/ internal types.
 * 2. define Model in `model.ts`
 * 3. define View/Body in `view.ts`, and external types.
 *
 * @author      Claire <claire@lemoncloud.io>
 * @date        2025-06-04 initial version.
 *
 * @copyright   (C) 2025 LemonCloud Co Ltd. - All Rights Reserved.
 * @origin      `@lemoncloud/codes-goods-api/modules/resource`
 */

/**
 * Payload for request (SQS/SNS 공용)
 */
export interface MessagePayload {
    /** target service, ex) 'eureka-hello-api' */
    service: string;
    /** stage, ex) 'dev' */
    stage: string;
    /** type of model, ex) 'hello' */
    type: string;
    /** mode, ex) 'POST' */
    mode: string;
    /** id of model, ex) '100001' */
    id: string;
    /** command, ex) 'save' */
    cmd: string;
    /** parameters, ex) { isMock: true } */
    param?: any;
    /** body, ex) { name: 'test' } */
    body?: any;
    /** context, ex) { accountId: '12355' } */
    context?: any;
}

/**
 * SNS Payload
 */
export interface SnsPayload {
    /** SNS Topic 이름 혹은 ARN, ex) 'eureka-hello-sns-dev' */
    target: string;
    /** 주제(subject), ex) 'save-to-dynamo' */
    subject?: string;
    /** 실제로 보내고자 하는 MessagePayload */
    payload: MessagePayload;
}
