import { before, describe, test as it } from 'node:test'
import { aString, check, objectMatching } from 'tsmatchers'
import { ulid } from 'ulid'
import type { CoreEvent } from './CoreEvent.js'
import { CoreEventType } from './CoreEventType.js'
import type { UserAuthContext } from './auth.js'
import { notifier } from './notifier.js'
import type { DbContext } from './persistence/DbContext.js'
import { createSync } from './persistence/createSync.js'
import { getSync } from './persistence/getSync.js'
import { createTestDb } from './test/createTestDb.js'
import { isNotAnError } from './test/isNotAnError.js'
import { testDb } from './test/testDb.js'
import { newOrg, newProject } from './sync.spec.js'
import type { ProblemDetail } from './ProblemDetail.js'
import { shareSync } from './persistence/shareSync.js'
import { generateSharingToken } from './generateSharingToken.js'

describe('sync', async () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,

		TableName,
	}

	before(createTestDb(dbContext))

	const { on, notify } = notifier()

	describe('sharing a sync', () => {
		const organizationId = `$test-${ulid()}`
		const projectA = `${organizationId}#test-${ulid()}`
		const projectIds = [projectA]
		const user: UserAuthContext = { email: 'alex@example.com', sub: '@alex' }
		const syncId = ulid()

		// Create a sync
		before(async () => {
			await newOrg(dbContext, notify, organizationId, user)
			await newProject(dbContext, notifier, projectA, user)
			isNotAnError(
				await createSync(dbContext, notify)(
					{
						id: syncId,
						projectIds: new Set(projectIds),
					},
					user,
				),
			)
		})

		it('should not share syncs by default', async () => {
			const { error } = (await getSync(dbContext)(
				{ syncId },
				{
					email: 'blake@example.com',
					sub: '@blake',
				},
			)) as { error: ProblemDetail }
			check(error?.title).is(`Access to sync ${syncId} denied.`)
		})

		const sharingToken = generateSharingToken()

		it('should allow the owner to share a sync', async () => {
			const events: CoreEvent[] = []
			on(CoreEventType.SYNC_SHARED, (e) => events.push(e))

			isNotAnError(
				await shareSync(dbContext, notify)(syncId, sharingToken, 1, user),
			)

			check(events[0]).is(
				objectMatching({
					type: CoreEventType.SYNC_SHARED,
					id: syncId,
					version: 2,
					sharingToken: aString,
				}),
			)
		})

		it('should allow non-onwers to access the sync using the sharing token', async () => {
			const { sync } = isNotAnError(
				await getSync(dbContext)(
					{ syncId, sharingToken },
					{
						email: 'blake@example.com',
						sub: '@blake',
					},
				),
			)

			check(sync).is(
				objectMatching({
					id: syncId,
					version: 2,
				}),
			)
		})
	})
})
