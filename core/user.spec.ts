import assert from 'node:assert'
import { before, describe, test as it } from 'node:test'
import type { CoreEvent } from './CoreEvent.ts'
import { CoreEventType } from './CoreEventType.ts'
import { notifier } from './notifier.ts'
import { createUser } from './persistence/createUser.ts'
import type { DbContext } from './persistence/DbContext.ts'
import { getUser } from './persistence/getUser.ts'
import { getUserProfile } from './persistence/getUserProfile.ts'
import { updateUser } from './persistence/updateUser.ts'
import { randomUser } from './randomEntities.ts'
import { createTestDb } from './test/createTestDb.ts'
import { isNotAnError } from './test/isNotAnError.ts'
import { testDb } from './test/testDb.ts'

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
		assert.partialDeepStrictEqual(user, {
			id: demi.sub,
			email: demi.email,
			version: 1,
		})
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

		assert.partialDeepStrictEqual(events[0], {
			type: CoreEventType.USER_UPDATED,
			id: demi.sub,
			pronouns: 'they/them',
			name: 'Demi D. Doe',
			version: 2,
		})

		const { user } = isNotAnError(await getUser(dbContext)(demi))
		assert.partialDeepStrictEqual(user, {
			id: demi.sub,
			email: demi.email,
			pronouns: 'they/them',
			name: 'Demi D. Doe',
			version: 2,
		})
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
		assert.partialDeepStrictEqual(user, {
			id: finn.sub,
			pronouns: 'xey/xem',
			name: 'Finn Finnley',
		})
		assert(!('email' in user), 'email should not be in public profile')
	})
})
