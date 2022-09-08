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
};
