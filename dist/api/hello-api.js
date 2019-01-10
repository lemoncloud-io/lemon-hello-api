"use strict";var _slicedToArray=function(r,e){if(Array.isArray(r))return r;if(Symbol.iterator in Object(r))return function(r,e){var o=[],t=!0,n=!1,i=void 0;try{for(var s,d=r[Symbol.iterator]();!(t=(s=d.next()).done)&&(o.push(s.value),!e||o.length!==e);t=!0);}catch(r){n=!0,i=r}finally{try{!t&&d.return&&d.return()}finally{if(n)throw i}}return o}(r,e);throw new TypeError("Invalid attempt to destructure non-iterable instance")},_typeof="function"==typeof Symbol&&"symbol"==typeof Symbol.iterator?function(r){return typeof r}:function(r){return r&&"function"==typeof Symbol&&r.constructor===Symbol&&r!==Symbol.prototype?"symbol":typeof r};exports=module.exports=function(r,e){if(!r)throw new Error("_$(global instance pool) is required!");r._;var y=r.U;if(!y)throw new Error("$U is required!");var g=y.NS(e||"GOOD","yellow");function p(r){return v(404,r)}function b(r){return v(503,r)}function v(r,e){return{statusCode:r,headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Credentials":!0},body:JSON.stringify(e)}}var o=function(r,e,o){e.callbackWaitsForEmptyEventLoop=!1;var t=r.queryStringParameters||{},n=r.pathParameters||{},i=decodeURIComponent(n.type||""),s=decodeURIComponent(n.id||""),d=(s||"GET"!==r.httpMethod?r.httpMethod:"LIST")||"",a=decodeURIComponent(n.cmd||""),u=!d&&r.Records?"EVENT":{LIST:"LIST",GET:"GET",PUT:"PUT",POST:"POST",DELETE:"DELETE"}[d],c=r.body&&("string"==typeof r.body&&(r.body.startsWith("{")||r.body.startsWith("["))?JSON.parse(r.body):r.body)||r.Records&&{records:r.Records}||null;!c&&_log(g,"#"+u+":"+a+" ("+d+", "+i+"/"+s+")...."),c&&_log(g,"#"+u+":"+a+" ("+d+", "+i+"/"+s+").... body.len=",c?y.json(c).length:-1);var l={_id:s,_param:t,_body:c,_ctx:e},_=Promise.resolve(l),f=function(r,e,o){var t=null;switch(r){case"LIST":t=m;break;case"GET":t=E;break;case"PUT":t=S;break;case"POST":t=h;break;case"DELETE":t=O}return t}(u);if(!f)return o(null,p({MODE:u}));try{_.then(function(r){var e=r._id,o=r._param,t=r._body,n=r._ctx;return f(e,o,t,n)}).then(function(r){return r&&"object"===(void 0===r?"undefined":_typeof(r))&&(r=y.cleanup(r)),o(null,v(200,r)),!0}).catch(function(r){return _err(g,"!!! callback@1 with err",r),0<=(r&&r.message||"").indexOf("404 NOT FOUND")?o(null,p(r.message)):o(null,b(r.message||r)),!1})}catch(r){o(r,b(r.message))}};o.do_list_goods=m,o.do_get_goods=E,o.do_put_goods=S,o.do_post_goods=h,o.do_delete_goods=O;require("url");var s=function(t){t=t||{};var r=Object.keys(PROPERTIES).reduce(function(r,e,o){return void 0!==t[e]&&(r[e]=t[e]),r},{});return void 0!==t._id&&(r.id=t._id),r};function m(r,e,o,t){_log(g,"do_list_goods("+r+")....");var n=Object.assign({},e||{});if(e.aggs){var i=function(r){var e=r;{if(e){var o={aggs:{group:{terms:{field:e+".keyword"}}}};return _log(g,"queryObject",o),JSON.stringify(o)}return""}}(e.aggs);i?(n.Q=i,n.ipp=0):_log(g,"aggregations query requires 'keyword'")}return $GDS.do_search(r,n)}function E(r,e,o,t){_log(g,"do_get_goods("+r+")....");var n=Object.assign({},e||{});return $GDS.do_read(r,n)}function S(r,e,o,t){if(_log(g,"do_put_goods("+r+")...."),"0"===r||0===r)return Promise.reject(new Error("Invalid ID:"+r));e=e||{};var n=Object.assign({},o||{});return void 0!==e.increment?$GDS.do_increment(r,n):$GDS.do_update(r,n)}function h(r,e,o,t){if(_log(g,"do_post_goods("+r+")...."),"0"===r||0===r)return Promise.reject(new Error("Invalid ID:"+r));e=e||{};var n=Object.assign({},o||{});return $GDS.do_create(r,n)}function O(e,r,o,t){if(_log(g,"do_delete_goods("+e+")...."),"0"===e||0===e)return Promise.reject(new Error("Invalid ID:"+e));var n=void 0!==(r=r||{}).destroy,i=Object.assign({},o||{});return i?Promise.resolve(i).then(s).then(function(r){return n?$GDS.do_destroy(e,r):$GDS.do_delete(e,r)}):Promise.reject(new Error("node is required!"))}return o};