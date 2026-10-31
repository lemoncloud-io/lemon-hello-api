/**
 * `hello-models.ts`
 * - model definitions..
 *
 *
 * @author      Steve Jung <steve@lemoncloud.io>
 * @date        2024-11-27 initial version with `lemon-core#3.2.10`
 *
 * @copyright (C) lemoncloud.io 2024 - All Rights Reserved. (https://eureka.codes)
 */
//NOTE - v5: lemon-model comes through lemon-core (`CoreModel` is a root name; HOW_TO_UPGRADE_V5 § 16).
import { CoreModel } from 'lemon-core';
import { keys } from 'ts-transformer-keys';

/**
 * type: `ModelType`
 * - use this type to make pkey per data.
 */
export type ModelType = 'test';

/**
 * class: `Model`
 *  - common model definitions
 *
 * see https://github.com/kimamula/ts-transformer-keys
 *  - keys() 실행 에러 해결을 위해서 `$ npm install --save-dev typescript ttypescript`, 후 tsc -> ttsc로 변경함!.
 */
export type Model = CoreModel<ModelType>;

/**
 * type: `TestModel`
 * - internal test model.
 */
export interface TestModel<T = any> extends Model {
    /**
     * id of model
     */
    id?: string;
    /**
     * stereo-type of model
     */
    stereo?: string;
    /**
     * name
     */
    name?: string;
    /**
     * internal test count
     */
    count?: number;
    /**
     * metadata in some format.
     */
    meta$?: T;

    /**
     * (readonly) view.
     */
    readonly Model?: Model; // inner Object.
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

//*extended fields set of sub-class.
export const $FIELD = {
    test: filterFields(keys<TestModel>()),
};
