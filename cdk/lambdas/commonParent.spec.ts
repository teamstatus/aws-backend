import assert from 'node:assert/strict'
import { describe, test as it } from 'node:test'
import { commonParent } from './commonParent.js'

describe('commonParent()', () => {
	it('should return the common parent directory', () =>
		assert.equal(
			commonParent([
				'/some/dir/lambda/onMessage.ts',
				'/some/dir/lambda/notifyClients.ts',
				'/some/dir/lambda/wirepasPublish.ts',
				'/some/dir/wirepas-5g-mesh-gateway/protobuf/ts/data_message.ts',
			]),
			'/some/dir/',
		))
	it('should return the entire parent tree for a single file', () =>
		assert.equal(
			commonParent(['/some/dir/lambda/onMessage.ts']),
			'/some/dir/lambda/',
		))
	it('should return "/" if files have no common directory', () =>
		assert.equal(
			commonParent([
				'/some/dir/lambda/onMessage.ts',
				'/other/dir/lambda/onMessage.ts',
			]),
			'/',
		))
})
