<!-- SPDX-License-Identifier: CC0-1.0 -->

# strip-comments-js

Strip comments from JavaScript files.

## Install

```shell
npm install strip-comments-js
```

## Usage

### CLI

```shell
strip-comments-js file-1.js file-2.js
```

```shell
strip-comments-js --pattern eslint-disable file-1.js file-2.js
```

### API

```javascript
import { stripComments } from "strip-comments-js";

stripComments("var unicorns = false; // Only horses");
//=> "var unicorns = false;"

stripComments("var unicorns = false; // Only horses", /unicorn/);
//=> "var unicorns = false; // Only horses"
```

## Related

- [strip-directives]

[strip-directives]: https://www.npmjs.com/package/strip-directives

## License

The source code is licensed under the `Apache-2.0` license, see [LICENSE] for
the full license text.

[license]: ./LICENSE
