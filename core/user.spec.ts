import { before, describe, test as it } from 'node:test'
import { check, objectMatching, undefinedValue } from 'tsmatchers'
import { notifier } from './notifier.ts'
import type { DbContext } from './persistence/DbContext.ts'
import { createUser } from './persistence/createUser.ts'
import { createTestDb } from './test/createTestDb.ts'
import { isNotAnError } from './test/isNotAnError.ts'
import { testDb } from './test/testDb.ts'
import { getUser } from './persistence/getUser.ts'
import type { CoreEvent } from './CoreEvent.ts'
import { CoreEventType } from './CoreEventType.ts'
import { updateUser } from './persistence/updateUser.ts'
import { getUserProfile } from './persistence/getUserProfile.ts'
import { randomUser } from './randomEntities.ts'

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
