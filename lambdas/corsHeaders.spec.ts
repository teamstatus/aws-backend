import assert from 'node:assert/strict'
import { describe, test as it } from 'node:test'
import { corsHeaders } from './corsHeaders.js'

describe('corsHeaders()', () => {
	it('should send the correct headers', () =>
		assert.deepEqual(
			corsHeaders({
				headers: {
					origin: 'https://teamstatus.space',
				},
			}),
			{
				'Access-Control-Allow-Credentials': true,
				'Access-Control-Allow-Headers': 'content-type, accept',
				'Access-Control-Allow-Methods': 'PUT, DELETE, POST, GET, OPTIONS',
				'Access-Control-Allow-Origin': 'https://teamstatus.space',
				'Access-Control-Max-Age': 600,
				Vary: 'Origin',
			},
		))

	it('should allow localhost', () =>
		assert.deepEqual(
			corsHeaders({
				headers: {
					origin: 'http://localhost:8080',
				},
			})['Access-Control-Allow-Origin'],
			'http://localhost:8080',
		))

	it('should not allow other domains', () =>
		assert.deepEqual(
			corsHeaders({
				headers: {
					origin: 'https://teamstatus-space.pages.dev',
				},
			})['Access-Control-Allow-Origin'],
			'https://teamstatus.space',
		))
})
