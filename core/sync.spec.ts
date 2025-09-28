import assert from 'node:assert'
import { before, describe, test as it } from 'node:test'
import { ulid } from 'ulid'
import type { UserAuthContext } from './auth.ts'
import type { CoreEvent } from './CoreEvent.ts'
import { CoreEventType } from './CoreEventType.ts'
import { type Notify, notifier } from './notifier.ts'
import type { ProblemDetail } from './ProblemDetail.ts'
import { createOrganization } from './persistence/createOrganization.ts'
import { createProject } from './persistence/createProject.ts'
import { createProjectMember } from './persistence/createProjectMember.ts'
import { createStatus, type Status } from './persistence/createStatus.ts'
import { createSync } from './persistence/createSync.ts'
import type { DbContext } from './persistence/DbContext.ts'
import { deleteSync } from './persistence/deleteSync.ts'
import { getSync, type SerializedSync } from './persistence/getSync.ts'
import { l } from './persistence/l.ts'
import { listStatusInSync } from './persistence/listStatusInSync.ts'
import { listSyncs } from './persistence/listSyncs.ts'
import { Role } from './Role.ts'
import { assertArrayContaining } from './test/assertArrayContaining.ts'
import { createTestDb } from './test/createTestDb.ts'
import { eventually } from './test/eventually.ts'
import { isNotAnError } from './test/isNotAnError.ts'
import { testDb } from './test/testDb.ts'

describe('sync', async () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,

		TableName,
	}

	const { on, notify } = notifier()
	const organizationId = `$test-${ulid()}`
	const projectA = `${organizationId}#test-${ulid()}`
	const projectB = `${organizationId}#test-${ulid()}`
	const projectC = `${organizationId}#test-${ulid()}`
	const projectIds = [projectA, projectB, projectC]
	const recentStatus: Record<string, string[]> = {}
	const olderStatus: Record<string, string[]> = {}
	const newerStatus: Record<string, string[]> = {}
	const user: UserAuthContext = { email: 'alex@example.com', sub: '@alex' }
	const startDate = new Date()
	const syncId = ulid()

	// Given there is a project with status
	before(async () => {
		await createTestDb(dbContext)()
		await newOrg(dbContext, notify, organizationId, user)
		return Promise.all(
			projectIds.map(async (projectId) => {
				await newProject(dbContext, notify, projectId, user)
				await Promise.all(
					[1, 2, 3, 4].map(async (i) => {
						const statusId = ulid()
						recentStatus[projectId] = [
							...(recentStatus[projectId] ?? []),
							statusId,
						]
						isNotAnError(
							await createStatus(dbContext, notify)(
								{
									id: statusId,
									projectId: projectId,
									message: `Status ${i} for project ${projectId}`,
								},
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
						{
							id: olderStatusId,
							projectId: projectId,
							message: `Older status for project ${projectId}`,
						},
						user,
					),
				)
				// Create some future status that should not be in the sync
				const newerStatusId = ulid(startDate.getTime() + 5 * 60 * 1000)
				newerStatus[projectId] = [
					...(newerStatus[projectId] ?? []),
					newerStatusId,
				]
				isNotAnError(
					await createStatus(dbContext, notify)(
						{
							id: newerStatusId,
							projectId: projectId,
							message: `Newer status for project ${projectId}`,
						},
						user,
					),
				)
			}),
		)
	})

	// For now, syncs are just a saved query ... a start and end date and a given set of projects
	// which acts as a "view" on all the status
	await it('should create a new sync that contains all the status so far', async () => {
		const events: CoreEvent[] = []
		on(CoreEventType.SYNC_CREATED, async (e) => events.push(e))

		isNotAnError(
			await createSync(dbContext, notify)(
				{
					id: syncId,
					projectIds: new Set([projectA, projectB]),
					title: 'My sync',
					inclusiveStartDate: startDate,
					inclusiveEndDate: new Date(startDate.getTime() + 60 * 1000),
				},
				user,
			),
		)

		assert.partialDeepStrictEqual(events[0], {
			type: CoreEventType.SYNC_CREATED,
			projectIds: new Set([projectA, projectB]),
			title: 'My sync',
			owner: user.sub,
			id: syncId,
			inclusiveStartDate: startDate,
			inclusiveEndDate: new Date(startDate.getTime() + 60 * 1000),
		})

		await eventually(async () => {
			const statusInSync = isNotAnError(
				await listStatusInSync(dbContext)(syncId, user),
			)

			const statusIdsInSync = statusInSync.status
				.map(({ id }) => id)
				.sort((a, b) => a.localeCompare(b))

			const syncStatusIds = new Set(statusIdsInSync)
			const olderStatusIds = new Set([
				...(olderStatus[projectA] ?? []),
				...(olderStatus[projectB] ?? []),
			])
			const newerStatusIds = new Set([
				...(newerStatus[projectA] ?? []),
				...(newerStatus[projectB] ?? []),
			])
			const recentStatusIds = new Set([
				...(recentStatus[projectA] ?? []),
				...(recentStatus[projectB] ?? []),
			])

			// Ensure recent status is in the sync
			for (const id of recentStatusIds) {
				assert.ok(
					syncStatusIds.has(id),
					`Recent status ${id} should be in sync`,
				)
			}

			// Ensure no older or newer status is in the sync
			for (const id of olderStatusIds) {
				assert.ok(
					!syncStatusIds.has(id),
					`Older status ${id} should not be in sync`,
				)
			}
			for (const id of newerStatusIds) {
				assert.ok(
					!syncStatusIds.has(id),
					`Newer status ${id} should not be in sync`,
				)
			}
		})
	})

	await describe('list syncs', async () => {
		await it('should list syncs owned by the user', async () => {
			const { syncs } = (await listSyncs(dbContext)(user)) as {
				syncs: SerializedSync[]
			}

			assert.partialDeepStrictEqual(syncs?.[0], {
				title: 'My sync',
				owner: user.sub,
			})
			assert(typeof syncs?.[0]?.id === 'string')

			const projectIdsInSync = new Set(syncs?.[0]?.projectIds)
			const expectedProjectIds = new Set([projectA, projectB].map(l))
			assert.deepStrictEqual(projectIdsInSync, expectedProjectIds)
		})

		await it('should list syncs that the user has access to', async () => {
			const organizationId = `$test-user-sync-${ulid()}`
			const projectA = `${organizationId}#test-${ulid()}`
			const projectB = `${organizationId}#test-${ulid()}`
			const projectC = `${organizationId}#test-${ulid()}`
			const projectIds = [projectA, projectB, projectC]

			// This user will be invited to the projects as a member and should see the syncs
			const jo: UserAuthContext = {
				email: 'jo@example.com',
				sub: '@jo',
			}

			// Create the organization
			isNotAnError(
				await createOrganization(dbContext, notify)(
					{
						id: organizationId,
						name: `Organization ${organizationId}`,
					},
					user,
				),
			)

			// Create the projects
			const syncIds: string[] = []
			for (const projectId of projectIds) {
				// Create the project
				isNotAnError(
					await createProject(dbContext, notify)(
						{
							id: projectId,
							name: `Project ${projectId}`,
						},
						user,
					),
				)
				// Create a sync
				const id = ulid()
				syncIds.push(id)
				isNotAnError(
					await createSync(dbContext, notify)(
						{
							id,
							projectIds: new Set([projectId]),
						},
						user,
					),
				)
				// Create a member
				await createProjectMember(dbContext, notify)(
					projectId,
					jo.sub,
					Role.WATCHER,
				)
			}
			eventually(async () => {
				const { syncs } = (await listSyncs(dbContext)(jo)) as {
					syncs: SerializedSync[]
				}

				const syncIds = new Set(syncs.map((s) => s.id))
				const expectedSyncIds = new Set(syncIds)
				assert.deepStrictEqual(syncIds, expectedSyncIds)
			})
		})
	})

	await describe('accessing syncs', async () => {
		await it('should allow owners to access a sync', async () => {
			const { sync } = (await getSync(dbContext)(syncId, user)) as {
				sync: SerializedSync
			}
			assert.partialDeepStrictEqual(sync, {
				title: 'My sync',
				id: syncId,
			})
		})

		const blake: UserAuthContext = {
			email: 'blake@example.com',
			sub: '@blake',
		}

		await it('users who have not related project should not be allowed to access a sync', async () => {
			const { error } = (await getSync(dbContext)(syncId, blake)) as {
				error: ProblemDetail
			}
			assert.equal(error?.title, `Access to sync ${syncId} denied.`)
		})

		await it('should allow users to access the sync if they have at least one project in the sync', async () => {
			await createProjectMember(dbContext, notify)(
				projectA,
				blake.sub,
				Role.MEMBER,
			)

			eventually(async () => {
				const { sync } = (await getSync(dbContext)(syncId, blake)) as {
					sync: SerializedSync
				}
				assert.partialDeepStrictEqual(sync, {
					title: 'My sync',
					id: syncId,
				})
				assert(new Set(sync.projectIds).has(l(projectA)))
				assert(!new Set(sync.projectIds).has(l(projectB)))
			})
		})

		await it('should allow users to fetch status in the sync if they have at least one project in the sync', () => {
			eventually(async () => {
				const { status } = (await listStatusInSync(dbContext)(
					syncId,
					blake,
				)) as {
					status: Status[]
				}

				recentStatus[projectA]?.map((id) =>
					assertArrayContaining(status, { id }),
				)
			})
		})
	})

	await describe('deleting syncs', async () => {
		await it('should allow deleting syncs', async () => {
			const syncId = ulid()
			const events: CoreEvent[] = []
			on(CoreEventType.SYNC_DELETED, async (e) => events.push(e))

			isNotAnError(
				await createSync(dbContext, notify)(
					{
						id: syncId,
						projectIds: new Set([projectA]),
					},
					user,
				),
			)

			const { sync } = (await getSync(dbContext)(syncId, user)) as {
				sync: SerializedSync
			}
			assert.partialDeepStrictEqual(sync, {
				id: syncId,
			})

			isNotAnError(await deleteSync(dbContext, notify)(syncId, 1, user))

			assert.partialDeepStrictEqual(events[0], {
				type: CoreEventType.SYNC_DELETED,
				id: syncId,
			})

			const { error } = (await getSync(dbContext)(syncId, user)) as {
				error: ProblemDetail
			}
			assert.equal(error?.title, `Sync ${syncId} not found!`)
		})
	})
})

const newProject = async (
	dbContext: DbContext,
	notify: Notify,
	projectId: string,
	user: UserAuthContext,
): Promise<void> => {
	isNotAnError(
		await createProject(dbContext, notify)(
			{ id: projectId, name: `Project ${projectId}` },
			user,
		),
	)
}

const newOrg = async (
	dbContext: DbContext,
	notify: Notify,
	organizationId: string,
	user: UserAuthContext,
): Promise<void> => {
	isNotAnError(
		await createOrganization(dbContext, notify)(
			{ id: organizationId, name: `Organization ${organizationId}` },
			user,
		),
	)
}
