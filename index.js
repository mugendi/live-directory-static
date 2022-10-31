/**
 * Copyright (c) 2022 Anthony Mugendi
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

const path = require('path'),
	fs = require('fs'),
	{ md5 } = require('./lib/utils'),
	{ wrap } = require('./lib/cache')(),
	optimizedLiveDir = require('optimized-live-directory');

const optimize_css = require('./lib/optimize-css');

module.exports = static;

function arrify(v) {
	if (v === undefined) return [];
	return Array.isArray(v) ? v : [v];
}

function is_object(value) {
	if (!value) return false;
	return value.toString() === '[object Object]';
}

function static(assetDirs, opts) {
	if (!is_object(opts)) throw new Error(`Options must be an object.`);

	assetDirs = arrify(assetDirs);
	// remove training slashes
	assetDirs = assetDirs.map((p) => p.replace(/\/+$/, ''));

	// console.log(assetDirs);

	opts = Object.assign(
		{
			fallThrough: true,
			cacheDir: path.resolve(module.parent.path, '.cache'),
			optimize: {
				css: true,
				removeUnusedCss: true,
			},
			
			// This option helps us control how much memory we let LiveDirectory Gobble up.
			// If you have 1 million static file, you don't want all of them on memory
			memory: {
				// maximum memory we will allow live directory to use
				maxUsed: '500mb',
				// maximum size of file we load into live directory
				bufferLimit: '500kb',
			},

			// Filters help to determine which files we accept/whitelist for Live Directory

			filter: {
				extensions: [
					'.js',
					'.png',
					'.jpg',
					'.jpeg',
					'.gif',
					'.svg',
					'.webp',
					'.html',
				],
			},

			// Details on how various static files are minified
			minify: {
				// minify html
				html: {
					collapseWhitespace: true,
					conservativeCollapse: true,
					continueOnParseError: false,
					keepClosingSlash: true,
					removeComments: true,
					removeScriptTypeAttributes: true,
					sortAttributes: true,
					sortClassName: true,
				},
				// minify css with default options
				css: {},
				// js is null because we do not minify javascript by default.
				js: null,
				// optimize svg using defaults
				svg: {},
				// optimize png
				png: {
					quality: [0.6, 0.8],
				},
				// optimize jpg
				jpg: {},
				// optimize gif
				gif: {
					optimizationLevel: 3,
				},
			},
		},
		opts
	);

	// this will load all the files within the directories
	// you can pass options to determine how it works
	let optiDir = new optimizedLiveDir(assetDirs, opts);

	return (request, response, next) => {
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			if (opts.fallThrough) {
				return next();
			}

			response
				.status(403) // Set the response HTTP status code
				.header('Allow', 'GET, HEAD') // Sets some random header
				.header('Content-Length', '0') // Sets some random
				.end();
			return;
		}

		// Let OptiDir get our files
		let resp = optiDir.fetch(request);

		// if successful, then we have found our file...
		if (resp.status == 'Successful') {
			//  resp.optimization

			// inspect if mode is fileStream, then stream
			if (resp.mode == 'fileStream') {
				response.type(resp.extension).stream(resp.stream);
			}
			// if buffer then send
			else if (resp.mode == 'fileBuffer') {
				// we can further optimize css
				if (resp.extension == 'css') {
					try {


						// console.log(fs.statSync(resp.path).mtimeMs);

						// optimize only once per page per css
						let cacheKey = md5([
							request.headers.referer,
							resp.path,
							fs.statSync(resp.path).mtimeMs
						]);

						// wrap to cache
						wrap(cacheKey, async function () {
							try {
								// console.log(`Optimizing ${resp.name}...`);
								// run the optimize function
								return await optimize_css(
									resp,
									request.headers.referer,
									opts
								);
							} catch (error) {
								throw error;
							}
						})
							.then((cssBuffer) => {
								// console.log(resp.name, Buffer.byteLength(cssBuffer));
								// if we have purged css
								if (cssBuffer) {
									response
										.type(resp.extension)
										.send(cssBuffer);
								} else {
									response
										.type(resp.extension)
										.send(resp.content);
								}

								return cssBuffer;
							})
							.catch((error) => {
								throw error;
							});
					} catch (error) {
						// console.error(error);
						// just render un-optimized
						response.type(resp.extension).send(resp.content);
					}
				} else {
					response.type(resp.extension).send(resp.content);
				}

			}
		}
		// We couldn't find file so we fall through...
		else {
			// send 404
			return next();
		}
	};
}

