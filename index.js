/**
 * Copyright (c) 2022 Anthony Mugendi
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

const LiveDirectory = require('./lib/liveDirectory'),
	path = require('path'),
	fs = require('fs');

const optimize_css = require('./lib/optimize-css');

module.exports = static;

function static(paths, opts) {
	opts = Object.assign(
		{
			allowedExtensions: [
				'.html',
				'.htm',
				'.css',
				'.js',
				'.json',
				'.gif',
				'.png',
				'.jpg',
				'.jpeg',
				'.ico',
				'.svg',
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

		// Return a 404 if no asset/file exists on the derived path
		if (file === undefined) return next();

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

		// optimize js Do we want to???
		// too many gotchas with js??
	};
}

// memoize purge css method
