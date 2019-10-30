/**
 * class: `CallbackData`
 * - data structor for `callback` notification.
 */
export interface CallbackData {
    cmd?: string; // command name
    param?: any; // parameters
    body?: any; // main data body
    result?: any; // result-set
    error?: any; // error if exception.
}

/**
 * class: `CallbackData`
 * - data structor for `callback` notification.
 */
export interface CallbackSlackData extends CallbackData {
    channel?: string; // (optional) slack channel to post.
    title?: string; // (optional) slack title message if applicable.
}

/**
 * class: `CallbackPayload`
 * - payload vis SNS/SQS record.
 */
export interface CallbackPayload {
    service?: string; // service name
    data?: CallbackSlackData; // target data.
}
