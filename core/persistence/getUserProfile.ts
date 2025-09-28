import { type AttributeValue, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { NotFoundError, type ProblemDetail } from '../ProblemDetail.ts'
import type { User } from './createUser.ts'
import type { DbContext } from './DbContext.ts'

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

		if (Item === undefined) {
			return {
				error: NotFoundError(`User ${id} not found!`),
			}
		}

		return {
			user: await itemToUserProfile()(Item),
		}
	}

export const itemToUserProfile =
	() =>
	(item: Record<string, AttributeValue>): UserProfile => {
		const d = unmarshall(item)
		return {
			id: d.id,
			name: d.name ?? undefined,
			pronouns: d.pronouns ?? undefined,
		}
	}
