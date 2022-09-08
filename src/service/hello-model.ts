/**
 * `account-models.ts`
 * - model definitions..
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2022-09-08 supports database w/ manager
 *
 * @copyright (C) 2022 LemonCloud Co Ltd. - All Rights Reserved.
 */
//NOTE - must use `lemon-model` to publish w/o `lemon-core`.
import { CoreModel } from 'lemon-model';
import { SlackPostBody } from 'lemon-core';
import { keys } from 'ts-transformer-keys';

/**
 * type: `ModelType`
 * - use this type to make pkey per data.
 */
export type ModelType = 'test' | 'channel' | 'target';

/**
 * class: `Model`
 *  - common model definitions
 *
 * see https://github.com/kimamula/ts-transformer-keys
 *  - keys() 실행 에러 해결을 위해서 `$ npm install --save-dev typescript ttypescript`, 후 tsc -> ttsc로 변경함!.
 */
export interface Model extends CoreModel<ModelType> {
    /**
     * stereo: stereo-type in common type.
     */
    stereo?: string;
    /**
     * name: readable name instead of id
     */
    name?: string;
}

/**
 * type: `TestModel`
 * - internal test model.
 */
export interface TestModel extends Model {
    /**
     * name
     */
    name?: string;
    /**
     * internal test count
     */
    test?: number;
    /**
     * (readonly) view.
     */
    readonly Model?: Model; // inner Object.
}

/**
 * type: `RouteRule`
 *
 *
 * @see SlackPostBody
 */
export interface RouteRule {
    /** regular express to match */
    pattern: string;

    /**
     * copy contents to target channel.
     * - duplicate the attachments
     * - ignored if it is in same channel
     * ex) A -> A + B
     */
    copyTo?: string;

    /**
     * move channel to other one.
     * - change the `.channel` in attachments.
     * ex) A -> B
     */
    moveTo?: string;

    /**
     * forward the input message to other
     * = id of `TargetModel`
     */
    forward?: string;
}

/**
 * type: `ChannelModel`
 * - describe the rule flow by slack channel.
 */
export interface ChannelModel extends Model {
    /**
     * = slack channel name
     * (default would be `public`)
     */
    id?: string;

    /** (optional) readable name of this channel */
    name?: string;

    /**
     * route rules in sequence.
     */
    rules?: RouteRule[];

    /**
     * target address (URL)
     */
    endpoint?: string;
}

/**
 * type: `TargetModel`
 * - describe the target information.
 */
export interface TargetModel extends Model {
    /**
     * = slack channel name
     */
    id?: string;
}

/**
 * extract field names from models
 * - only fields start with lowercase, or all upper.
 */
export const filterFields = (fields: string[], base: string[] = []) =>
    fields
        .filter(field => field !== '_id' && /^[a-z_][a-zA-Z0-9_]+/.test(field))
        .reduce<string[]>(
            (L, k) => {
                if (k && !L.includes(k)) L.push(k);
                return L;
            },
            [...base],
        );

//! extended fields set of sub-class.
export const $FIELD = {
    test: filterFields(keys<TestModel>()),
    channel: filterFields(keys<ChannelModel>()),
    target: filterFields(keys<TargetModel>()),
};
