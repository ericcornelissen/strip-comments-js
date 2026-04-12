<!-- SPDX-License-Identifier: CC0-1.0 -->

# strip-directives

Strip directives (like `eslint-disable-line`) from your code to clean a package
before it is published.

## Install

```shell
npm install strip-directives
```

## Usage

### CLI

```shell
strip-directives file-1.js file-2.js
```

### API

```javascript
import { stripDirectives } from "strip-directives";

stripDirectives("var x = y == z; // eslint-disable-line eqeqeq");
//=> "var x = y == z;"
```

## Support

Directives from the following tooling is supported:

- [ESLint]
- [type-coverage]

[eslint]: https://eslint.org/
[type-coverage]: https://www.npmjs.com/package/type-coverage

## License

The source code is licensed under the `Apache-2.0` license, see [LICENSE] for
the full license text.

[license]: ./LICENSE
