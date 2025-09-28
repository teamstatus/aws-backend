import { type AttributeValue, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { UserAuthContext } from '../auth.ts'
import { NotFoundError, type ProblemDetail } from '../ProblemDetail.ts'
import type { User } from './createUser.ts'
import type { DbContext } from './DbContext.ts'

export const getUser =
	(dbContext: DbContext) =>
	async (
		authContext: UserAuthContext,
	): Promise<{ user: User } | { error: ProblemDetail }> => {
		const { db, TableName } = dbContext

		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
				Key: {
					id: {
						S: authContext.sub,
					},
					type: {
						S: 'user',
					},
				},
			}),
		)

		if (Item === undefined) {
			return {
				error: NotFoundError(`User ${authContext.sub} not found!`),
			}
		}

		return {
			user: itemToUser(Item),
		}
	}

export const itemToUser = (item: Record<string, AttributeValue>): User => {
	const d = unmarshall(item)
	return {
		id: d.id,
		email: d.user__email,
		name: d.name ?? undefined,
		version: d.version,
		pronouns: d.pronouns ?? undefined,
	}
}
