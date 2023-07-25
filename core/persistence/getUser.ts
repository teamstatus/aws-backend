import { AttributeValue, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { NotFoundError, type ProblemDetail } from '../ProblemDetail.js'
import type { UserAuthContext } from '../auth.js'
import { type DbContext } from './DbContext.js'
import type { User } from './createUser.js'
import { unmarshall } from '@aws-sdk/util-dynamodb'

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

		if (Item === undefined)
			return {
				error: NotFoundError(`User ${authContext.sub} not found!`),
			}

		return {
			user: await itemToUser()(Item),
		}
	}

export const itemToUser =
	() =>
	async (item: Record<string, AttributeValue>): Promise<User> => {
		const d = unmarshall(item)
		return {
			id: d.id,
			email: d.user__email,
			name: d.name,
			version: d.version,
			pronouns: d.pronouns ?? undefined,
		}
	}
