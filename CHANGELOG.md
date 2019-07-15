# Changelog

## [4.0.0](https://www.github.com/googleapis/teeny-request/compare/v3.11.3...v4.0.0) (2019-07-15)


### ⚠ BREAKING CHANGES

* **deps:** Node 6 is no longer supported.
* Previously, error messages were parsed from the response body in streaming mode, and emitted to the user. This did not match callback behavior or the `request` module's behavior. Errors will now have to be parsed from the response body.

### Bug Fixes

* allow string as body ([#6](https://www.github.com/googleapis/teeny-request/issues/6)) ([204c34e](https://www.github.com/googleapis/teeny-request/commit/204c34e))
* do not swallow errors ([#21](https://www.github.com/googleapis/teeny-request/issues/21)) ([4e0df25](https://www.github.com/googleapis/teeny-request/commit/4e0df25))
* don't parse response errors in stream mode ([#40](https://www.github.com/googleapis/teeny-request/issues/40)) ([2a4ad7a](https://www.github.com/googleapis/teeny-request/commit/2a4ad7a)), closes [#39](https://www.github.com/googleapis/teeny-request/issues/39)
* export types independent of @types/request ([#44](https://www.github.com/googleapis/teeny-request/issues/44)) ([fbe2b77](https://www.github.com/googleapis/teeny-request/commit/fbe2b77))
* include headers in the response ([#23](https://www.github.com/googleapis/teeny-request/issues/23)) ([0a9032d](https://www.github.com/googleapis/teeny-request/commit/0a9032d))
* make request event compatible with request ([#16](https://www.github.com/googleapis/teeny-request/issues/16)) ([5f77a66](https://www.github.com/googleapis/teeny-request/commit/5f77a66))
* make teenyRequest return Stream instead of PassThrough ([#26](https://www.github.com/googleapis/teeny-request/issues/26)) ([f239758](https://www.github.com/googleapis/teeny-request/commit/f239758))
* response event emits headers as an object of array, make it an object of strings ([#24](https://www.github.com/googleapis/teeny-request/issues/24)) ([8d5aed6](https://www.github.com/googleapis/teeny-request/commit/8d5aed6))
* response object is a readable stream ([#32](https://www.github.com/googleapis/teeny-request/issues/32)) ([a438c74](https://www.github.com/googleapis/teeny-request/commit/a438c74))
* return ref to request in response ([#20](https://www.github.com/googleapis/teeny-request/issues/20)) ([ad2a262](https://www.github.com/googleapis/teeny-request/commit/ad2a262))
* support uri and url options ([#10](https://www.github.com/googleapis/teeny-request/issues/10)) ([3421e31](https://www.github.com/googleapis/teeny-request/commit/3421e31))
* use optional request options for defaults ([#19](https://www.github.com/googleapis/teeny-request/issues/19)) ([5a386b5](https://www.github.com/googleapis/teeny-request/commit/5a386b5))
* use r.Request return type and fix events ([#28](https://www.github.com/googleapis/teeny-request/issues/28)) ([903c9a4](https://www.github.com/googleapis/teeny-request/commit/903c9a4))
* use RequestCallback interface from Request ([#11](https://www.github.com/googleapis/teeny-request/issues/11)) ([7abb703](https://www.github.com/googleapis/teeny-request/commit/7abb703))


### Miscellaneous Chores

* **deps:** update dependency gts to v1 ([#37](https://www.github.com/googleapis/teeny-request/issues/37)) ([aafbde3](https://www.github.com/googleapis/teeny-request/commit/aafbde3))
