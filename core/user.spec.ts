import { before, describe, test as it } from 'node:test'
import { check, objectMatching, undefinedValue } from 'tsmatchers'
import { notifier } from './notifier.js'
import type { DbContext } from './persistence/DbContext.js'
import { createUser } from './persistence/createUser.js'
import { createTestDb } from './test/createTestDb.js'
import { isNotAnError } from './test/isNotAnError.js'
import { testDb } from './test/testDb.js'
import { getUser } from './persistence/getUser.js'
import type { CoreEvent } from './CoreEvent.js'
import { CoreEventType } from './CoreEventType.js'
import { updateUser } from './persistence/updateUser.js'
import { getUserProfile } from './persistence/getUserProfile.js'
import { randomUser } from './randomEntities.js'

describe('user', async () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,
		TableName,
	}

	const { on, notify } = notifier()

	before(createTestDb(dbContext))

	const demi = randomUser()

	const finn = randomUser()

	await it('allows users to get their profile', async () => {
		isNotAnError(
			await createUser(
				dbContext,
				notify,
			)({
				id: demi.sub,
				authContext: demi,
			}),
		)

		const { user } = isNotAnError(await getUser(dbContext)(demi))
		check(user).is(
			objectMatching({
				id: demi.sub,
				email: demi.email,
				version: 1,
			}),
		)
	})

	await it('allows users to update their profile', async () => {
		const events: CoreEvent[] = []
		on(CoreEventType.USER_UPDATED, async (e) => events.push(e))
		isNotAnError(
			await updateUser(dbContext, notify)(
				{ pronouns: 'they/them', name: 'Demi D. Doe' },
				1,
				demi,
			),
		)

		check(events[0]).is(
			objectMatching({
				type: CoreEventType.USER_UPDATED,
				id: demi.sub,
				pronouns: 'they/them',
				name: 'Demi D. Doe',
				version: 2,
			}),
		)

		const { user } = isNotAnError(await getUser(dbContext)(demi))
		check(user).is(
			objectMatching({
				id: demi.sub,
				email: demi.email,
				pronouns: 'they/them',
				name: 'Demi D. Doe',
				version: 2,
			}),
		)
	})

	await it('allows users to get the profile of another user', async () => {
		isNotAnError(
			await createUser(
				dbContext,
				notify,
			)({
				id: finn.sub,
				name: 'Finn Finnley',
				pronouns: 'xey/xem',
				authContext: finn,
			}),
		)

		const { user } = isNotAnError(await getUserProfile(dbContext)(finn.sub))
		check(user).is(
			objectMatching({
				id: finn.sub,
				email: undefinedValue,
				pronouns: 'xey/xem',
				name: 'Finn Finnley',
			}),
		)
	})
})
