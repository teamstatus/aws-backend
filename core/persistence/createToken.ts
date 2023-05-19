import { QueryCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { type CoreEvent } from '../CoreEvent.js'
import { CoreEventType } from '../CoreEventType.js'
import { InternalError, type ProblemDetail } from '../ProblemDetail.js'
import { create, type VerifyTokenFn } from '../token.js'
import type { DbContext } from './DbContext.js'

export type LoggedInWithEmailAndPin = CoreEvent & {
	type: CoreEventType.EMAIL_LOGIN_PIN_SUCCESS
	email: string
}

export const createToken =
	(verifyToken: VerifyTokenFn, { db, table }: DbContext, signingKey: string) =>
	async ({
		token,
	}: {
		token: string
	}): Promise<{ error: ProblemDetail } | { token: string }> => {
		try {
			const { email } = verifyToken(token)

			const { Items } = await db.send(
				new QueryCommand({
					TableName: table,
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
