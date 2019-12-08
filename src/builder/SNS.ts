/**
 * `builder/SNS.ts`
 *
 * # Core SNS Handler
 * - `lemon-protocol-api` 에서 각 서비스의 대표 `SNS` 에 메세지를 전달함.
 * - 그러면, 대표 SNS에 대해서는 이 SNS 핸들러가 데이터를 전달 받고, 이후 해당 API로 전달해줌.
 * - 해당 API 전달은 `_$('api-name')` 으로 찾아서 전달함.
 * - SNS 는 최대 약 5분의 실행 시간이 설정됨. 반면 API는 약 30초 정도로 설정.
 *
 *
 * @author       Steve Jung <steve@lemoncloud.io>
 * @date         2018-11-25 To support `$protocol().do_post_notify(url, body, callback)`. (engine >1.0.13)
 * @date         2019-07-23 support `lemon-engine` v2
 * @date         2019-08-08 fix `$protocol()`, refactored to `core/SNS.ts`
 *
 * @copyright   (C) 2019 LemonCloud Co Ltd. - All Rights Reserved.
 */
/** ********************************************************************************************************************
 *  Common Headers
 ** ********************************************************************************************************************/
//! import core engine.
import { $U, _log, _inf, _err } from 'lemon-core';
import { do_parrallel } from 'lemon-core';
import { do_post_hello_event } from '../api/hello-api';

//! Node definition.
export interface SNSNode {
    record: {
        Sns: {
            Subject: string;
            Message: string;
        };
    };
    context: any;
}

interface CoreHandler<T> {
    (event: any, context: any, cb: any): any;
}
interface BrokerBuilder<T> {
    (type: string, ns: string): any;
}

/**
 * build SNS() handler.
 *
 * @param NS        namespace to print
 * @param defType   default type of $api()
 */
const builder: BrokerBuilder<any> = (defType, NS) => {
    defType = defType || 'hello';
    //! namespace..
    NS = NS || $U.NS(`SNS`, 'yellow'); // NAMESPACE TO BE PRINTED.

    //! filter message body.
    const filterMessage = (subject: string, message: string | object): any => {
        subject = subject || '';
        message =
            typeof message === 'string' && message.startsWith('{') && message.endsWith('}')
                ? JSON.parse(message)
                : message;
        const body = message;
        const param = { subject };
        return { method: 'POST', id: `!${subject}`, cmd: 'event', param, body };
    };

    /**
     * process each record.
     *
     * @param node  data set
     * @param i     index in `.Records[]`
     */
    const do_process_record = async (node: SNSNode, i: number = 0) => {
        const context = Object.assign({}, node.context); // copy from origin context.
        const record = node.record;
        //! catch SNS Record.
        const sns = record && record.Sns;
        const subject = (sns && sns.Subject) || '';
        const message = (sns && sns.Message) || '';
        const data = filterMessage(subject, message);
        _log(NS, `! record[${i}].${subject} =`, typeof data, $U.json(data));

        //! extract parameters....
        const id = data.id;
        const param = data.param || {};
        const body = data.body || '';

        //--------------------------------------------------------
        //WARN! - do prevent error looping. call directly.
        return do_post_hello_event(id, param, body, context)
            .then((_: any) => {
                _log(NS, '>> res =', _);
                return `${_.statusCode || '000'} ${_.body || _}`;
            })
            .catch((e: any) => {
                _err(NS, '>> err =', e);
                _err(NS, '>> err.data =', $U.json(data));
                return `${e.message || e}`;
            });
    };

    //! Common SNS Handler for lemon-protocol integration.
    const SNS: CoreHandler<any> = (event, context, callback) => {
        //!WARN! allows for using callbacks as finish/error-handlers
        context.callbackWaitsForEmptyEventLoop = false;

        //! serialize records one by one.
        const nodes: SNSNode[] = (event.Records || []).map((record: any) => {
            return { record, context };
        });

        //! execute each records, and returns.
        do_parrallel(nodes, do_process_record, 1)
            .then((_: any) => {
                // _inf(NS, '! done =', $U.json(_));
                _inf(NS, '! done.len =', _.length);
                callback(null, _);
            })
            .catch((e: Error) => {
                _inf(NS, '! error =', e);
                callback(e);
            });
    };

    //! export default.
    return SNS;
};

//! export default.
export default builder;
