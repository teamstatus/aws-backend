import assert from 'node:assert'
import { before, describe, it } from 'node:test'
import { ulid } from 'ulid'
import type { CoreEvent } from './CoreEvent.tsx'
import { CoreEventType } from './CoreEventType.ts'
import { notifier } from './notifier.ts'
import { createOrganization } from './persistence/createOrganization.ts'
import { createProject } from './persistence/createProject.ts'
import { createStatus } from './persistence/createStatus.ts'
import type { DbContext } from './persistence/DbContext.tsx'
import { getStatus } from './persistence/getStatus.ts'
import {
	randomOrganization,
	randomProject,
	randomUser,
} from './randomEntities.ts'
import { createTestDb } from './test/createTestDb.ts'
import { ensureUserIsMember } from './test/ensureUserIsMember.ts'
import { isNotAnError } from './test/isNotAnError.ts'
import { storeEvent } from './test/storeEvent.ts'
import { testDb } from './test/testDb.ts'

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

		const maybeEvent = events.find(
			(e) =>
				e.type === CoreEventType.STATUS_CREATED &&
				'id' in e &&
				e.id === id &&
				'project' in e &&
				e.project === project.id &&
				'message' in e &&
				e.message === `This is a status update by Blake` &&
				'author' in e &&
				e.author === user.sub &&
				'attributeTo' in e &&
				e.attributeTo === 'Blake',
		)

		assert(maybeEvent, 'Expected STATUS_CREATED event to be emitted')

		const { status } = isNotAnError(
			await getStatus(dbContext)(
				{
					statusId: id,
					projectId: project.id,
				},
				user,
			),
		)
		assert.partialDeepStrictEqual(status, {
			attributeTo: 'Blake',
		})
		assert.equal(status.attributeTo, 'Blake')
		assert(typeof status.id === 'string')
	})
})
