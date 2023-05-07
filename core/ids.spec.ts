import assert from 'node:assert/strict'
import { describe, test as it } from 'node:test'
import { check, objectMatching } from 'tsmatchers'
import { isOrganizationId, isProjectId, isUserId, projectId } from './ids.js'

describe('identifiers', async () => {
	describe('user IDs', async () => {
		for (const [id, isValid] of [
			['@alex', true],
			['@Alex123', true],
			['', false],
			['@', false],
			['@_', true],
			['@with space', false],
		]) {
			it(`ensures that ${JSON.stringify(id)} is ${
				isValid ? 'valid' : 'invalid'
			}`, () => assert.equal(isUserId(id as string), isValid))
		}
	})
	describe('organization IDs', async () => {
		for (const [id, isValid] of [
			['$acme', true],
			['$ACME2023', true],
			['', false],
			['$', false],
			['$_', true],
			['$with space', false],
		]) {
			it(`ensures that ${JSON.stringify(id)} is ${
				isValid ? 'valid' : 'invalid'
			}`, () => assert.equal(isOrganizationId(id as string), isValid))
		}
	})
	describe('project IDs', async () => {
		for (const [id, isValid] of [
			['$acme#teamsite', true],
			['$ACME2023#TeamSite', true],
			['$acme#test-01gzw0cfrx18n8gcdcf6rw351k', true],
			['', false],
			['$#', false],
			['$_#_', true],
			['$ACME#With Space', false],
		]) {
			it(`ensures that ${JSON.stringify(id)} is ${
				isValid ? 'valid' : 'invalid'
			}`, () => assert.equal(isProjectId(id as string), isValid))
		}
		describe('projectId()', () => {
			it('should extract the organization', () =>
				assert.equal(projectId('$acme#teamsite').organization, '$acme'))
			it('should extract the project', () =>
				assert.equal(projectId('$acme#teamsite').project, '#teamsite'))
			it('should not return if project id is invalid', () =>
				check(projectId('foo')).is(
					objectMatching({
						organization: null,
						project: null,
					}),
				))
		})
	})
})
