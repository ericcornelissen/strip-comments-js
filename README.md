<!-- SPDX-License-Identifier: CC0-1.0 -->

# strip-comments-js

Strip comments from JavaScript and TypeScript code.

## Install

```shell
npm install --global strip-comments-js
```

## Usage

### CLI

```shell
strip-comments-js file-1.js file-2.js
```

```shell
strip-comments-js --pattern eslint-disable file-1.js file-2.js
```

For more information

```shell
strip-comments-js --help
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
- `line`: Whether to strip line comments. By default line comments are stripped.
- `block`: Whether to strip block comments. By default block comments are
  stripped.
- `jsdoc`: Whether to strip JSDoc comments (comments like `/** ... */`). By
  default JSDoc comments are stripped.
- `protected`: Whether to strip protected comments (comments like `//! ...` or
  `/*! ... */`). By default protected comments are stripped.
- `spdx`: Whether to strip SPDX short-form identifiers (comments like
  `// SPDX-License-Identifier: ...`). By default SPDX short-form identifiers are
  NOT stripped.

## Related

- [strip-assertions]
- [strip-directives]

[strip-assertions]: https://www.npmjs.com/package/strip-assertions
[strip-directives]: https://www.npmjs.com/package/strip-directives

## License

The source code is licensed under the `Apache-2.0` license, see [LICENSE] for
the full license text.

[license]: ./LICENSE
