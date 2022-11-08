/**
 * Copyright (c) 2022 Anthony Mugendi
 *
 * This software is released under the MIT License.
 * https://opensource.org/licenses/MIT
 */

const _ = require('lodash'),
	{ PurgeCSS } = require('purgecss'),
	CleanCSS = require('clean-css'),
	path = require('path'),
	fs = require('fs');

async function optimize_css(file, referer, opts) {
	//
	try {
		// if we have a cache dir
		// then lets start by purging unused css
		if (
			// if we need to remove unused css
			opts.optimize.removeUnusedCss &&
			// and we have a cache directory to work with
			opts.cacheDir &&
			// and that cache directory actually exists
			fs.existsSync(opts.cacheDir)
		) {
			const templateFileName = referer_to_filename(referer);
			const templateFilePath = path.join(opts.cacheDir, templateFileName);
			const cssOptimizeFile = path.join(opts.cacheDir, 'purge-css.json');
			const staticFile = _.snakeCase(file.name);
			// build file optimize file

			const purgeCssFileData = read_json(cssOptimizeFile);

			const purgeCssOpts = purgeCssFileData;

			purgeCssOpts[staticFile] = purgeCssOpts[staticFile] || {
				content: [],
				css: [file.path],
			};

			// add this content file
			purgeCssOpts[staticFile].content = _.uniq(
				purgeCssOpts[staticFile].content.concat([templateFilePath])
			)
				// filter out missing template cache files
				.filter((f) => fs.existsSync(f));

			// if we have some templates to work with
			if (purgeCssOpts[staticFile].content.length) {
				// call memoized method
				content = await purge_css(
					purgeCssOpts,
					staticFile,
					cssOptimizeFile
				);

				if (content) {
					return Buffer.from(content);
				}
			}
		}

		return null;
	} catch (error) {
		// console.error(error);
		// don't break site because of an error
		// always return some content
		return content;
	}
}

async function purge_css(purgeCssOpts, staticFile, cssOptimizeFile) {
	try {
		let purgedCss = await new PurgeCSS()
			.purge(purgeCssOpts[staticFile])
			.then((resp) => {
				let css = resp[0].css.toString();
				return css;
			});

		// clean up the css
		let {styles} = new CleanCSS({}).minify(purgedCss);

		// save new file
		// update  cssOptimizeFile
		fs.writeFileSync(cssOptimizeFile, JSON.stringify(purgeCssOpts, 0, 4));

		return styles || purgedCss;

	} catch (error) {
		throw error;
	}
}

function referer_to_filename(referer) {
	if(!referer) return ''
	let URLObj = new URL(referer);
	return _.snakeCase(URLObj.hostname + ' ' + URLObj.pathname);
}

function read_json(filePath) {
	if (!fs.existsSync(filePath)) return {};

	// console.log({filePath});
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8'));
	} catch (error) {
		// console.error(error);
		return {};
	}
}

module.exports = optimize_css;
