import { before, beforeEach, describe, test as it } from 'node:test'
import { arrayMatching, check, objectMatching } from 'tsmatchers'
import { ulid } from 'ulid'
import type { CoreEvent } from './CoreEvent.js'
import { CoreEventType } from './CoreEventType.js'
import type { UserAuthContext } from './auth.js'
import { notifier } from './notifier.js'
import type { DbContext } from './persistence/DbContext.js'
import { createOrganization } from './persistence/createOrganization.js'
import { createProject } from './persistence/createProject.js'
import { createStatus } from './persistence/createStatus.js'
import { createSync } from './persistence/createSync.js'
import { getStatusInSync } from './persistence/getStatusInSync.js'
import { createTestDb } from './test/createTestDb.js'
import { eventually } from './test/eventually.js'
import { isNotAnError } from './test/isNotAnError.js'
import { testDb } from './test/testDb.js'

describe('sync', async () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,

		TableName,
	}

	before(createTestDb(dbContext))

	const { on, notify } = notifier()
	describe('create a new sync', () => {
		const organizationId = `$test-${ulid()}`
		const projectA = `${organizationId}#test-${ulid()}`
		const projectB = `${organizationId}#test-${ulid()}`
		const projectC = `${organizationId}#test-${ulid()}`
		const projectIds = [projectA, projectB, projectC]
		const createdStatus: Record<string, string[]> = {}
		const user: UserAuthContext = { email: 'alex@example.com', sub: '@alex' }

		// Given there is a project with status
		beforeEach(async () => {
			isNotAnError(
				await createOrganization(dbContext, notify)(
					{ id: organizationId, name: `Organization ${organizationId}` },
					user,
				),
			)
			return Promise.all(
				projectIds.map(async (projectId) => {
					isNotAnError(
						await createProject(dbContext, notify)(
							{ id: projectId, name: `Project ${projectId}` },
							user,
						),
					)
					return Promise.all(
						[1, 2, 3, 4].map(async (i) => {
							const statusId = ulid()
							createdStatus[projectId] = [
								...(createdStatus[projectId] ?? []),
								statusId,
							]
							isNotAnError(
								await createStatus(dbContext, notify)(
									statusId,
									projectId,
									`Status ${i} for project ${projectId}`,
									user,
								),
							)
						}),
					)
				}),
			)
		})

		// For now, syncs are just a saved query ... a start and end date and a given set of projects
		// which acts as a "view" on all the status
		it('should create a new sync that contains all the status so far', async () => {
			const events: CoreEvent[] = []
			on(CoreEventType.SYNC_CREATED, (e) => events.push(e))

			const syncId = ulid()
			isNotAnError(
				await createSync(dbContext, notify)(
					syncId,
					[projectA, projectB],
					'My sync',
					user,
				),
			)

			check(events[0]).is(
				objectMatching({
					type: CoreEventType.SYNC_CREATED,
					projects: [projectA, projectB],
					title: 'My sync',
					author: '@alex',
					id: syncId,
				}),
			)

			await eventually(async () => {
				const statusInSync = isNotAnError(
					await getStatusInSync(dbContext, user)(syncId),
				)

				const expectedStatusIds: string[] = [
					...(createdStatus[projectA] ?? []),
					...(createdStatus[projectB] ?? []),
				].sort((a, b) => a.localeCompare(b))

				const createdIds = statusInSync.status
					.map(({ id }) => id)
					.sort((a, b) => a.localeCompare(b))

				check(createdIds).is(arrayMatching(expectedStatusIds))
			})
		})
	})
})
