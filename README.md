<!-- SPDX-License-Identifier: CC0-1.0 -->

# strip-comments-js

Strip comments from JavaScript and TypeScript code.

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

stripComments("var unicorns = false; // Only horses", { pattern: /unicorn/ });
//=> "var unicorns = false; // Only horses"

stripComments("var unicorns = false; // Only horses", { pattern: /horses/ });
//=> "var unicorns = false;"

stripComments("var unicorns = false; // Only horses", { line: false });
//=> "var unicorns = false; // Only horses"
```

#### Options

`stripComments(code, [options])`

- `pattern`: The pattern of comments to strip. By default all comments are
  stripped.
- `block`: Whether to strip block comments. By default block comments are
  stripped.
- `jsdoc`: Whether to strip JSDoc comments. By default JSDoc comments are
  stripped.
- `line`: Whether to strip line comments. By default line comments are stripped.

## Related

- [strip-directives]

[strip-directives]: https://www.npmjs.com/package/strip-directives

## License

The source code is licensed under the `Apache-2.0` license, see [LICENSE] for
the full license text.

[license]: ./LICENSE
