/**
 * class: `CallbackData`
 * - data structor for `callback` notification.
 */
export interface CallbackData {
    /**
     * command name
     */
    cmd?: string;
    /**
     * parameters
     */
    param?: any;
    /**
     * main data body
     */
    body?: any;
    /**
     * result-set
     */
    result?: any;
    /**
     * error if exception.
     */
    error?: any;
}

/**
 * class: `CallbackData`
 * - data structor for `callback` notification.
 */
export interface CallbackSlackData extends CallbackData {
    /**
     * (optional) slack channel to post.
     */
    channel?: string;
    /**
     * (optional) slack title message if applicable.
     */
    title?: string;
}

/**
 * class: `CallbackPayload`
 * - payload vis SNS/SQS record.
 */
export interface CallbackPayload {
    /**
     * service name
     */
    service?: string;
    /**
     * target data.
     */
    data?: CallbackSlackData;
}
