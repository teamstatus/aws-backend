import { AttributeValue, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { NotFoundError, type ProblemDetail } from '../ProblemDetail.js'
import { type DbContext } from './DbContext.js'
import type { User } from './createUser.js'
import { unmarshall } from '@aws-sdk/util-dynamodb'

type UserProfile = Pick<User, 'id' | 'name' | 'pronouns'>

/**
 * Returns the public user profile
 */
export const getUserProfile =
	(dbContext: DbContext) =>
	async (
		id: string,
	): Promise<{ user: UserProfile } | { error: ProblemDetail }> => {
		const { db, TableName } = dbContext

		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: {
					id: {
						S: id,
					},
					type: {
						S: 'user',
					},
				},
			}),
		)

		if (Item === undefined)
			return {
				error: NotFoundError(`User ${id} not found!`),
			}

		return {
			user: await itemToUserProfile()(Item),
		}
	}

export const itemToUserProfile =
	() =>
	async (item: Record<string, AttributeValue>): Promise<UserProfile> => {
		const d = unmarshall(item)
		return {
			id: d.id,
			name: d.name,
			pronouns: d.pronouns ?? undefined,
		}
	}
