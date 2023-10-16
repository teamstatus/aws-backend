import { describe, it, before } from 'node:test'
import type { CoreEvent } from './CoreEvent'
import { testDb } from './test/testDb'
import type { DbContext } from './persistence/DbContext'
import { notifier } from './notifier'
import { createTestDb } from './test/createTestDb'
import { CoreEventType } from './CoreEventType'
import { storeEvent } from './test/storeEvent'
import { ensureUserIsMember } from './test/ensureUserIsMember'
import { ulid } from 'ulid'
import { isNotAnError } from './test/isNotAnError'
import { createStatus } from './persistence/createStatus'
import { createOrganization } from './persistence/createOrganization'
import { aString, arrayContaining, check, objectMatching } from 'tsmatchers'
import { createProject } from './persistence/createProject'
import { getStatus } from './persistence/getStatus'
import { randomUser, randomOrganization, randomProject } from './randomEntities'

describe('status', async () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,
		TableName,
	}

	const { on, notify } = notifier()

	before(createTestDb(dbContext))

	await it("can be created on behalf of other's", async () => {
		const events: CoreEvent[] = []
		on(CoreEventType.STATUS_CREATED, storeEvent(events))

		const user = randomUser()
		const org = randomOrganization()
		const project = randomProject(org)
		isNotAnError(await createOrganization(dbContext, notify)(org, user))
		isNotAnError(await createProject(dbContext, notify)(project, user))
		await ensureUserIsMember(dbContext, user, project.id)

		const id = ulid()
		isNotAnError(
			await createStatus(dbContext, notify)(
				{
					id,
					projectId: project.id,
					message: `This is a status update by Blake`,
					attributeTo: 'Blake',
				},
				user,
			),
		)
		check(events).is(
			arrayContaining(
				objectMatching({
					type: CoreEventType.STATUS_CREATED,
					project: project.id,
					message: `This is a status update by Blake`,
					author: user.sub,
					id,
					attributeTo: 'Blake',
				}),
			),
		)

		const { status } = isNotAnError(
			await getStatus(dbContext)(
				{
					statusId: id,
					projectId: project.id,
				},
				user,
			),
		)
		check(status).is(
			objectMatching({
				id: aString,
				attributeTo: 'Blake',
			}),
		)
	})
})
