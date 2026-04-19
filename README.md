<!-- SPDX-License-Identifier: CC0-1.0 -->

# strip-comments-js

Strip comments from JavaScript files

## Install

```shell
npm install strip-comments-js
```

## Usage

### CLI

```shell
strip-comments-js file-1.js file-2.js
```

### API

```javascript
import { stripComments } from "strip-comments-js";

stripComments("var x = y == z; // This checks if Y is equal to Z");
//=> "var x = y == z;"
```

## Related

- [strip-directives]

[strip-directives]: https://www.npmjs.com/package/strip-directives

## License

The source code is licensed under the `Apache-2.0` license, see [LICENSE] for
the full license text.

[license]: ./LICENSE
