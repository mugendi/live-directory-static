/**
 * Copyright (c) 2022 Anthony Mugendi
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

const LiveDirectory = require('./lib/liveDirectory'),
	expand = require('brace-expansion'),
	path = require('path'),
	fs = require('fs');

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

function static(paths, opts) {
	if (!is_object(opts)) throw new Error(`Options must be an object.`);

	paths = arrify(paths);
	// remove training slashes
	paths = paths.map((p) => p.replace(/\/+$/, ''));

	opts = Object.assign(
		{
			allowedExtensions: [
				'.html',
				'.htm',
				'.css',
				'.js',
				'.json'
			],
			defaultExtension: '.html',
			fallThrough: true,
			cacheDir: path.resolve(module.parent.path, '.cache'),
			optimize: {
				css: true,
				removeUnusedCss: true,
			},
		},
		opts
	);

	// Create a LiveDirectory instance to virtualize directory with our assets
	const LiveAssets = new LiveDirectory({
		paths, // We want to provide the system path to the folder. Avoid using relative paths.
		keep: {
			extensions: opts.allowedExtensions, // We only want to serve files with these extensions
		},
		ignore: (path) => {
			return path.startsWith('.'); // We want to ignore dotfiles for safety
		},
	});

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

		let filePath = request.path;

		// add default extension if need be
		if ('' == path.extname(filePath) && opts.defaultExtension) {
			filePath += opts.defaultExtension;
		}

		const file = LiveAssets.get(filePath);

		if (file) {
			let staticFileData = file.buffer;

			// optimize css
			if (
				// if css file
				file.extension == 'css' &&
				// and we the optimize css flag is true
				opts.optimize.css
			) {
				// optimize css
				optimize_css(file, request.headers.referer, opts)
					.then((css) => {
						return response.type(file.extension).send(css);
					})
					.catch(console.error);

				// load file if exists
			} else {
				// Set appropriate mime-type and serve file buffer as response body
				return response.type(file.extension).send(staticFileData);
			}
		} else {
			let filePath = find_file(paths, request.path, opts);

			// if we found a file
			if (filePath) {
				// ths could be a large file,
				//  we cannot risk loading to memory so we stream it
				// Create a readable stream for the file
				const readable = fs.createReadStream(filePath);

				// Handle any errors from the readable
				readable.on('error', (error) => {
					return next(error);
				});

				// Easily stream the video data to receiver
				return response
					.type(path.extname(filePath) || 'txt')
					.stream(readable);
			}

			// file missing!
			return next(404);
		}

		// optimize js Do we want to???
		// too many gotchas with js??
	};
}

function find_file(paths, requestPath, opts) {
	// console.log(requestPath);
	// add default extension if missing
	if (!path.extname(requestPath)) {
		requestPath = requestPath + opts.defaultExtension;
	}
	// generate possible paths
	let possiblePaths = expand(`{${paths.join(',')}}${requestPath}`);
	// find which of these paths exist
	let existingPaths = possiblePaths.filter(fs.existsSync);

	if (existingPaths.length) return existingPaths[0];
	return null;
}
