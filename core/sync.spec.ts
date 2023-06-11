import { before, beforeEach, describe, test as it } from 'node:test'
import { arrayMatching, check, not, objectMatching } from 'tsmatchers'
import { decodeTime, ulid } from 'ulid'
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
		const recentStatus: Record<string, string[]> = {}
		const olderStatus: Record<string, string[]> = {}
		const user: UserAuthContext = { email: 'alex@example.com', sub: '@alex' }
		const startDate = new Date()

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
					await Promise.all(
						[1, 2, 3, 4].map(async (i) => {
							const statusId = ulid()
							recentStatus[projectId] = [
								...(recentStatus[projectId] ?? []),
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
					// Create some older status that should not be in the sync
					const olderStatusId = ulid(startDate.getTime() - 5 * 1000)
					olderStatus[projectId] = [
						...(olderStatus[projectId] ?? []),
						olderStatusId,
					]
					isNotAnError(
						await createStatus(dbContext, notify)(
							olderStatusId,
							projectId,
							`Older status for project ${projectId}`,
							user,
						),
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
					{
						id: syncId,
						projectIds: [projectA, projectB],
						title: 'My sync',
						inclusiveStartDate: startDate,
					},
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

				const createdIds = statusInSync.status
					.map(({ id }) => id)
					.sort((a, b) => a.localeCompare(b))

				console.log(createdIds.map((id) => `${id}: ${decodeTime(id)}`))

				check(createdIds).is(
					arrayMatching(
						[
							...(recentStatus[projectA] ?? []),
							...(recentStatus[projectB] ?? []),
						].sort((a, b) => a.localeCompare(b)),
					),
				)

				check(createdIds).is(
					not(
						arrayMatching(
							[
								...(olderStatus[projectA] ?? []),
								...(olderStatus[projectB] ?? []),
							].sort((a, b) => a.localeCompare(b)),
						),
					),
				)
			})
		})
	})
})
