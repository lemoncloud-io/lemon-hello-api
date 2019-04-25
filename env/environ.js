/**
 * express 실행시, 환경 변수를 로딩하는 부분만 따로 빼놓음.
 * 
 * ex:
 * const $env = require('environ')(process)
 * 
 * NOTE! - may required for `express`
 * 
 * @author Steve Jung <steve@lemoncloud.io>
 * @date   2019.JAN.30
 */
exports = module.exports = (process)=>{
    ////////////////////////////////////////////////////////////////////////
    //! determine source target.
    //  1. ENV 로부터, 로딩할 `env.yml` 파일을 지정함.
    //  2. STAGE 로부터, `env.yml`내 로딩할 환경 그룹을 지정함.
    //  ex: ENV=lemon STAGE=dev nodemon express.js --port 8081
    const $env  = process && process.env || {};
    const ENV   = $env['ENV'] || 'none.yml';                                 // Environment file.
    const STAGE = $env['STAGE'] || $env['NODE_ENV'] || 'local';             // Global STAGE/NODE_ENV For selecting.
    const IS_OP = STAGE === 'prod' || STAGE === 'production';               //NOTE! - use 'dist' for production.
    const SRC   = $env['SRC'] && ($env['SRC'].startsWith('./') ? $env['SRC'] : `./${$env['SRC']}/`) || (IS_OP ? './dist/' : './src/');
    console.log('! ENV=', ENV,', STAGE=', STAGE,', SRC=', SRC);
    $env.SRC    = SRC;

    //! initialize environment via 'env.yml'
    return (function($det){
        const file = ENV;
        const fs   = require('fs');
        const yaml = require('js-yaml');
        const path = './env/'+file+(file.endsWith('.yml') ? '' : '.yml');
        if (!fs.existsSync(path)) throw new Error('FILE NOT FOUND:'+path);
        try {
            console.log(`! loading file: "${path}"`);
            const $doc = yaml.safeLoad(fs.readFileSync(path, 'utf8'));
            const $src = $doc && $doc[STAGE]||{};
            const $new = Object.keys($src).reduce(($O, key)=>{
                const val = $src[key];
                // console.log('!',key,':=', typeof val, val);
                if (typeof val == 'string' && val.startsWith('!')){         //! force to update environ.
                    $O[key] = val.substring(1);
                } else if (typeof val == 'object' && Array.isArray(val)){   //! 배열 데이터인경우, 호환성을 위해서 ', ' 으로 붙여준다.
                    $O[key] = val.join(', ');
                } else if ($det[key] === undefined){                        //! override if undefined.
                    $O[key] = val;
                } else {
                    //TODO - unknown exception.
                }
                return $O;
            }, {})
            $new.STAGE = $new.STAGE||STAGE;                                 //! confirm STAGE.
            // console.log('! env :=', JSON.stringify($new));
            Object.assign($det, $new);
        } catch (e) {
            console.error('ERROR FOR ENV: ', e);
        }
        return $det;
    })($env);
}