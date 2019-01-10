/**
 * gulp configuration to build js
 * - minify /src to /dist
 * 
 * 
 * history:
 *  18.04.24 - 패키지 README.md 에서 변수 사용하여 출력하도록 수정.
 * 
 * usage:
 * $ gulp
 * 
 * @author Steve Jung <steve@lemoncloud.io>
 * @date   2019.JAN.10
 */
var path = require('path');
var gulp = require('gulp');
var concat = require('gulp-concat');
let babel = require('gulp-babel');          // for ES6
var uglify = require('gulp-uglify');
var empty = require("gulp-empty");
var change = require("gulp-change");
var fs = require("fs");
//var plug = require('gulp-load-plugins')();

// main configuration..
var conf = {
	'dist':{
		src: './src',
		dist: './dist',
		// dist: '../dist-host/test',
		tmp: '.tmp'
	},
}

//! main folder.
gulp.paths = conf['dist'];      // default as nano.
function set_conf(name){
	gulp.paths = conf[name]||{};
}

/////////////////////////////////////////////////////////////////////////////
// require('require-dir')('./gulp');
//- uglify the scripts files.
gulp.task('scripts', [], function() {
	//! function to build gulp pipe.
	function scripts(folder, noBabel){
		folder = folder ||'';
		return gulp.src([
			    path.join(gulp.paths.src, folder+'/*.js'),
			    '!'+path.join(gulp.paths.src, folder+'/*.min.js')
		    ])
            // .pipe(concat('all.min.js'))
            .pipe(noBabel ? empty() : babel({presets:['env']}))
            .pipe(uglify())
            .on('error', function (err) { console.error('error=', err); })
            //.pipe(uglify({preserveComments:'license'}))
            //.pipe(plug.uglify({preserveComments:'all'}))
            .pipe(gulp.dest(path.join(gulp.paths.dist, folder+'/')))
            // .pipe(gulp.dest(gulp.paths.dist))
	}

	//! returns target js files.
	return [scripts(''), scripts('/api'), scripts('/lib'), scripts('/service')];
	// return [scripts(''), scripts('/core')];
})

//- just copies of others
gulp.task('copy-all', function() {
	return gulp.src([
		path.join(gulp.paths.src, '/**/*'),
		'!'+path.join(gulp.paths.src, '/**/*.vscode'),
		'!'+path.join(gulp.paths.src, '/**/*.log')
	]).pipe(gulp.dest(gulp.paths.dist));
})

//- just copies of others
gulp.task('package', function() {
    const $pck0 = require('./package.json'); 
    const $pck2 = require('./src/package.json');

	const ver = $pck0.version||'0.0.1';
	console.log('#version =', ver);
	const readme = fs.readFileSync("README.md", "utf8");
	// console.log('#readme =', readme);

	const myChange = (body)=>{
		body = body.trim();
		// console.log('> body=', typeof body, body);
		if (body.startsWith('{') && body.endsWith('}')){        // must be 'package.json'
            //! load body & parse.
            const $body = JSON.parse(body);
            console.log('> '+($body.name||'')+'#version =', ver,'<-',$body.version);
            //! update version.
			if($body.version)
                $body.version = ver;
            //! sync dependencies version.
            if(!$body.dependencies)
                $body.dependencies = $pck0.dependencies;
            //! to json file.
			body = JSON.stringify($body, undefined, '  ');
		}
        else if(body.startsWith('# ')){			// it must be md file.
            const TAIL = '\n----------------';
			const a = body.lastIndexOf(TAIL);
			const b = a > 0 ? readme.lastIndexOf(TAIL) : 0;
			if (a > 0 && b > 0){
				body = body.substring(0, a) + readme.substring(b);
            }
            
            //! now replace variable.
            const date = (new Date()).toLocaleString();
            body = body.replace(/\{\{name\}\}/ig, $pck2.name);
            body = body.replace(/\{\{date\}\}/ig, date);
            body = body.replace(/\{\{version\}\}/ig, $pck0.version);
            body = body.replace(/\{\{description\}\}/ig, $pck2.description);
        }
        else {
            console.log('WARN! unknown text body=', typeof body, body);
        }
		return body;
	}
	//! run copy & replace.
	return gulp.src([
		path.join(gulp.paths.src, '/package.json'),
		path.join(gulp.paths.src, '/README.md'),
	])
	.pipe(change(myChange))
	.pipe(gulp.dest(gulp.paths.dist));
})

//- default to build.
gulp.task('default', ['scripts', 'package']);

//! simple build.
gulp.task('simple', () =>
    gulp.src([
            //'src/**/*.js'
            path.join(gulp.paths.src, '/**/*.js'),
            '!'+path.join(gulp.paths.src, '/sample/*'),
            '!'+path.join(gulp.paths.src, '/**/*.log')
        ])
        // .pipe(sourcemaps.init())
        // .pipe(babel({presets: ['env']}))     // problem in core module.
        // .pipe(concat('all.js'))              // NOT GOOD due to exports
		.pipe(uglify())
		.on('error', function (err) { console.error('error=', err); })
        // .pipe(sourcemaps.write('.'))
        .pipe(gulp.dest('dist'))
);

