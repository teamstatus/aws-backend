import { describe, it, before } from 'node:test'
import type { CoreEvent } from './CoreEvent.tsx'
import { testDb } from './test/testDb.ts'
import type { DbContext } from './persistence/DbContext.tsx'
import { notifier } from './notifier.ts'
import { createTestDb } from './test/createTestDb.ts'
import { CoreEventType } from './CoreEventType.ts'
import { storeEvent } from './test/storeEvent.ts'
import { ensureUserIsMember } from './test/ensureUserIsMember.ts'
import { ulid } from 'ulid'
import { isNotAnError } from './test/isNotAnError.ts'
import { createStatus } from './persistence/createStatus.ts'
import { createOrganization } from './persistence/createOrganization.ts'
import { aString, arrayContaining, check, objectMatching } from 'tsmatchers'
import { createProject } from './persistence/createProject.ts'
import { getStatus } from './persistence/getStatus.ts'
import {
	randomUser,
	randomOrganization,
	randomProject,
} from './randomEntities.ts'

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
