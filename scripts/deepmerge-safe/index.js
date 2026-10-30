/**
 * `scripts/deepmerge-safe/index.js`
 * - dev-only stand-in for `deepmerge` (installed through `overrides` in the root `package.json`).
 * - reason: GHSA-gcqx-w48m-w2h4 covers deepmerge 4.2.0 ~ 4.3.1 and no fixed release exists yet.
 * - the only consumer is `jest-config` (merges preset `globals` with project `globals`).
 * - same call shape as deepmerge 4.x: `deepmerge(target, source, options?)` and `deepmerge.all(list, options?)`.
 * - drop this folder and the override once deepmerge ships a fixed version.
 * - origin: copied unchanged from lemon-model `scripts/deepmerge-safe/` (lemon-model #24).
 *
 * @copyright (C) LemonCloud Co Ltd. - All Rights Reserved.
 */
'use strict';

/** keys that would rewrite the prototype of the merged result; never copied. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/** default mergeable test: non-null objects except RegExp and Date (as deepmerge). */
const isMergeableObjectDefault = value => {
    // only plain containers are merged; special objects are copied as-is
    if (!value || typeof value !== 'object') return false;
    const tag = Object.prototype.toString.call(value);
    return tag !== '[object RegExp]' && tag !== '[object Date]';
};

/** own enumerable keys plus own enumerable symbols, minus the unsafe keys. */
const safeKeys = obj =>
    // symbols are kept to match deepmerge; unsafe string keys are dropped
    [
        ...Object.keys(obj),
        ...Object.getOwnPropertySymbols(obj).filter(s => Object.prototype.propertyIsEnumerable.call(obj, s)),
    ].filter(key => !UNSAFE_KEYS.has(key));

/** clone a mergeable value into an empty container unless `clone: false`. */
const cloneValue = (value, options) =>
    // deep-copy mergeable values so the result shares nothing with the inputs
    options.clone !== false && options.isMergeableObject(value)
        ? deepmerge(Array.isArray(value) ? [] : {}, value, options)
        : value;

/** default array merge: concatenate then clone each element (as deepmerge). */
const arrayMergeDefault = (target, source, options) =>
    // keep deepmerge's documented concat behaviour
    target.concat(source).map(item => cloneValue(item, options));

/** merge two plain objects into a fresh object that has no inherited state from the inputs. */
const mergeObject = (target, source, options) => {
    const out = {};
    // copy target keys first
    if (options.isMergeableObject(target))
        safeKeys(target).forEach(key => (out[key] = cloneValue(target[key], options)));
    // then source keys: recurse only when both sides hold an own mergeable value
    safeKeys(source).forEach(key => {
        const own = Object.prototype.hasOwnProperty.call(target, key);
        const merge = (options.customMerge && options.customMerge(key)) || deepmerge;
        out[key] =
            own && options.isMergeableObject(source[key])
                ? merge(target[key], source[key], options)
                : cloneValue(source[key], options);
    });
    return out;
};

/** deep merge `source` onto `target` and return a new value (inputs are not modified). */
function deepmerge(target, source, options) {
    // resolve options with deepmerge defaults
    const opts = Object.assign({}, options);
    opts.arrayMerge = opts.arrayMerge || arrayMergeDefault;
    opts.isMergeableObject = opts.isMergeableObject || isMergeableObjectDefault;
    opts.cloneUnlessOtherwiseSpecified = cloneValue;
    // arrays merge with arrays, objects with objects; a type mismatch takes the source
    const sourceIsArray = Array.isArray(source);
    if (sourceIsArray !== Array.isArray(target)) return cloneValue(source, opts);
    return sourceIsArray ? opts.arrayMerge(target, source, opts) : mergeObject(target, source, opts);
}

/** merge a list of values left to right (as `deepmerge.all`). */
deepmerge.all = (list, options) => {
    // same guard as deepmerge
    if (!Array.isArray(list)) throw new Error('first argument should be an array');
    return list.reduce((prev, next) => deepmerge(prev, next, options), {});
};

module.exports = deepmerge;
