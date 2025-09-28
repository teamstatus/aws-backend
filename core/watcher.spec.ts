import assert from 'node:assert'
import { before, describe, it } from 'node:test'
import { ulid } from 'ulid'
import { notifier } from './notifier.ts'
import { acceptProjectInvitation } from './persistence/acceptProjectInvitation.ts'
import { createOrganization } from './persistence/createOrganization.ts'
import { createProject } from './persistence/createProject.ts'
import { createStatus, type Status } from './persistence/createStatus.ts'
import { createUser } from './persistence/createUser.ts'
import type { DbContext } from './persistence/DbContext.ts'
import { inviteToProject } from './persistence/inviteToProject.ts'
import { listStatus } from './persistence/listStatus.ts'
import { Role } from './Role.ts'
import { randomOrganization, randomUser } from './randomEntities.ts'
import { createTestDb } from './test/createTestDb.ts'
import { isNotAnError } from './test/isNotAnError.ts'
import { testDb } from './test/testDb.ts'

void describe('watchers', () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,
		TableName,
	}
	const { notify } = notifier()

	before(createTestDb(dbContext))

	const emerson = randomUser()
	const alex = randomUser()
	const acme = randomOrganization()
	const watchedProjectId = `${acme.id}#teamstatus`

	void it('should allow watchers read status of a project', async () => {
		// Users have to exist to be invited
		isNotAnError(
			await createUser(
				dbContext,
				notify,
			)({
				id: emerson.sub,
				authContext: emerson,
			}),
		)

		// Create the organization
		isNotAnError(
			await createOrganization(dbContext, notify)(
				{ id: acme.id, name: 'ACME Inc.' },
				alex,
			),
		)

		// ... and project
		isNotAnError(
			await createProject(dbContext, notify)(
				{ id: watchedProjectId, name: 'Teamstatus.' },
				alex,
			),
		)

		// Create a status
		const id = ulid()
		isNotAnError(
			await createStatus(dbContext, notify)(
				{
					id: id,
					projectId: watchedProjectId,
					message:
						'This status should be visible by all watchers of the project.',
				},
				alex,
			),
		)

		// Invite the watcher
		isNotAnError(
			await inviteToProject(dbContext, notify)(
				{
					invitedUserId: emerson.sub,
					projectId: watchedProjectId,
					role: Role.WATCHER,
				},
				alex,
			),
		)

		// Watcher accepts the invitation
		isNotAnError(
			await acceptProjectInvitation(dbContext, notify)(
				watchedProjectId,
				emerson,
			),
		)

		// Ensure the watcher sees the status

		const { status: statusList } = (await listStatus(dbContext)(
			{ projectId: watchedProjectId },
			emerson,
		)) as {
			status: Status[]
		}

		const status = statusList.find((p) => p.id === id)

		assert.partialDeepStrictEqual(
			status,
			{
				id,
				project: watchedProjectId,
				author: alex.sub,
				version: 1,
				reactions: [],
				message:
					'This status should be visible by all watchers of the project.',
			},
			'Watcher should see the status in the project.',
		)
	})
})
