import { before, beforeEach, describe, test as it } from 'node:test'
import {
	arrayContaining,
	check,
	objectMatching,
	undefinedValue,
} from 'tsmatchers'
import { ulid } from 'ulid'
import type { CoreEvent } from './CoreEvent'
import { CoreEventType } from './CoreEventType'
import type { UserAuthContext } from './auth'
import { notifier } from './notifier'
import type { DbContext } from './persistence/DbContext'
import { createOrganization } from './persistence/createOrganization'
import { createProject } from './persistence/createProject'
import { createStatus } from './persistence/createStatus'
import { createSync } from './persistence/createSync'
import { getStatusInSync } from './persistence/getStatusInSync'
import { createTestDb } from './test/createTestDb'
import { testDb } from './test/testDb'

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
			check(
				await createOrganization(dbContext, notify)(
					{ id: organizationId, name: `Organization ${organizationId}` },
					user,
				),
			).is(
				objectMatching({
					error: undefinedValue,
				}),
			)
			return Promise.all(
				projectIds.map(async (projectId) => {
					check(
						await createProject(dbContext, notify)(
							{ id: projectId, name: `Project ${projectId}` },
							user,
						),
					).is(
						objectMatching({
							error: undefinedValue,
						}),
					)
					return Promise.all([
						...[1, 2, 3, 4].map((i) => async () => {
							const statusId = ulid()
							createdStatus[projectId] = [
								...(createdStatus[projectId] ?? []),
								statusId,
							]
							check(
								await createStatus(dbContext, notify)(
									statusId,
									projectId,
									`Status ${i} for project ${projectId}`,
									user,
								),
							).is(
								objectMatching({
									error: undefinedValue,
								}),
							)
						}),
					])
				}),
			)
		})

		// For now, syncs are just a saved query ... a start and end date and a given set of projects
		// which acts as a "view" on all the status
		it('should create a new sync that contains all the status so far', async () => {
			const events: CoreEvent[] = []
			on(CoreEventType.SYNC_CREATED, (e) => events.push(e))

			const syncId = ulid()
			const res = await createSync(dbContext, notify)(
				syncId,
				[projectA, projectB],
				'My sync',
				user,
			)

			check(res).is(
				objectMatching({
					error: undefinedValue,
				}),
			)
			check(events[0]).is(
				objectMatching({
					id: syncId,
					type: CoreEventType.SYNC_CREATED,
					projects: [projectA, projectB],
					title: 'My sync',
					author: '@alex',
				}),
			)

			const statusInSync = await getStatusInSync(dbContext, user)(syncId)

			const expectedStatusIds: string[] = [
				...(createdStatus[projectA] ?? []),
				...(createdStatus[projectB] ?? []),
			]

			console.log(statusInSync)

			check(statusInSync).is(
				objectMatching({
					status: arrayContaining(expectedStatusIds.map((id) => ({ id }))),
				}),
			)
		})
	})
})
