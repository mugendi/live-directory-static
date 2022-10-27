<!--
 Copyright (c) 2022 Anthony Mugendi

 This software is released under the MIT License.
 https://opensource.org/licenses/MIT
-->

# live-directory-static

Before diving in, you should read about [LiveDirectory](https://github.com/kartikk221/live-directory) by [Kartik](https://github.com/kartikk221) to see why you really want to use it!

This module does two things:
1. It extends LiveDirectory to be able to take an array of directory paths, because static files can be in multiple directories after all.
2. It borrows from modules like [serve-static](https://www.npmjs.com/package/serve-static) to build the rest of the logic needed to serve static files via LiveDirectory.

Well tested with [hyper-express](https://www.npmjs.com/package/hyper-express) but should in theory work with [express](https://www.npmjs.com/package/express) too. Let me know if it doesn't.

## How to use


```javascript
const HyperExpress = require('hyper-express');
const webserver = new HyperExpress.Server();
const liveDirectoryStatic = require('live-directory-static');

// options you can add to your static files middleware
// example below includes all the default values
let staticOptions = {
	// extensions of files we expect to serve
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
	],
	// the default extension to server if path has no extension
	defaultExtension: '.html',
	// this allows any other methods other than GET to pass through without attempting to serve static files
	// static files are only served via GET anyway
	fallThrough: true,
};

// set it before any routes
webserver.use(liveDirectoryStatic(['path/to/dir1', 'path/to/dir2'], staticOptions));

// Create GET route to serve 'Hello World'
webserver.get('/', (request, response) => {
	response.send('Hello World');
});

// Activate webserver by calling .listen(port, callback);
webserver
	.listen(80)
	.then((socket) => console.log('Webserver started on port 80'))
	.catch((error) => console.log('Failed to start webserver on port 80'));
```
