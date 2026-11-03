/**
 * interface: `StorageSupportable<T>`
 * - storage supportable interface.
 */
export interface StorageSupportable<T> {
    /** say hello */
    hello?(): string;

    /**
     * get model by id
     * - can return null if not found.
     */
    read(id: string): Promise<T | null>;

    /**
     * save(or update) model by id
     * - null data means delete the model.
     * - get the final model saved.
     *
     * @returns the final model saved (can be null if deleted).
     */
    save(id: string, data?: T): Promise<T | null>;
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
     * - change the `.channel` in `SlackPostBody`
     * ex) A -> B
     */
    moveTo?: string;

    /** override `color` of `SlackAttachment` */
    color?: string;

    /**
     * forward the input message to other
     * = id of `TargetModel`
     */
    forward?: string;
}

/**
 * type: `ChannelStereo`
 * - target format adapter of channel. `''` (or absent) and `'slack'` mean the default slack format.
 */
export type ChannelStereo = '' | 'slack' | 'chatic';

export interface SlackChannelModel {
    /**
     * id of channel
     */
    id?: string;

    /**
     * (optional) redirected `channel` name in slack.
     * - `id` would be channel.
     */
    channel?: string;

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

    /**
     * (optional) stereo of target format adapter. ex) 'chatic' (default is slack)
     */
    stereo?: ChannelStereo;

    /**
     * (optional) service token to authenticate the request to `endpoint`.
     */
    token?: string;

    /**
     * flag to use S3 for message body storage.
     */
    useS3?: boolean;

    /**
     * (readonly) last sent response.
     */
    readonly $sent?: SlackResponse;
}

/**
 * interface: `SlackResponse`
 * - response from slack to post.
 */
export interface SlackResponse<T = string> {
    /** body in json string */
    body?: T;
    /** status code */
    statusCode: number;
    /** status message */
    statusMessage: string;
}

/**
 * type: `ChaticWebhookMeta`
 * - structured meta contract carried in `stereo: 'webhook'` chat messages.
 */
export interface ChaticWebhookMeta {
    /** source header. ex) 'error-report: chatic-sockets-api/lemon-production#0.26.710' */
    pretext?: string;
    /** title of message */
    title?: string;
    /** body text */
    text?: string;
    /** key-value fields */
    fields?: { title?: string; value: string | number }[];
    /** severity color. ex) 'danger' | 'warning' | 'good' | '#hex' */
    color?: string;
    /** sender display name. ex) 'hello-alarm' */
    username?: string;
    /** timestamp (epoch seconds) of the report */
    ts?: number;
    /** footer origin string. ex) 'chatic-sockets-api/lemon-production#0.26.710' */
    footer?: string;
    /** url of the full original payload (S3) */
    sourceUrl?: string;
}
