import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { InternalError, type ProblemDetail } from '../ProblemDetail.js'
import { create, type UserAuthContext } from '../auth.js'
import type { DbContext } from './DbContext.js'

export const createToken =
	({ db, TableName }: DbContext) =>
	async (
		signingKey: string,
		authContext: UserAuthContext,
	): Promise<{ error: ProblemDetail } | { token: string }> => {
		try {
			const { email } = authContext

			const { Items } = await db.send(
				new QueryCommand({
					TableName,
					Limit: 1,
					IndexName: 'emailUser',
					KeyConditionExpression: '#email = :email',
					ExpressionAttributeNames: {
						'#email': 'user__email',
					},
					ExpressionAttributeValues: {
						':email': {
							S: email,
						},
					},
				}),
			)

			const userId =
				Items?.[0] !== undefined ? unmarshall(Items[0]).id : undefined
			return {
				token: create({ signingKey })({
					email,
					sub: userId,
				}),
			}
		} catch (error) {
			console.error((error as Error).message)
			return { error: InternalError() }
		}
	}
