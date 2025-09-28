import {
	ConditionalCheckFailedException,
	DeleteItemCommand,
	QueryCommand,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { EmailAuthContext, UserAuthContext } from '../auth.ts'
import type { CoreEvent } from '../CoreEvent.ts'
import { CoreEventType } from '../CoreEventType.ts'
import type { Notify } from '../notifier.ts'
import {
	ConflictError,
	InternalError,
	type ProblemDetail,
} from '../ProblemDetail.ts'
import type { DbContext } from './DbContext.ts'
import { emailUserIndex } from './db.ts'
import { l } from './l.ts'

export type LoggedInWithEmailAndPin = CoreEvent & {
	type: CoreEventType.EMAIL_LOGIN_PIN_SUCCESS
	email: string
}

export const emailPINLogin =
	(dbContext: DbContext, notify: Notify) =>
	async ({
		email,
		pin,
	}: {
		email: string
		pin: string
	}): Promise<
		| { error: ProblemDetail }
		| { authContext: EmailAuthContext | UserAuthContext }
	> => {
		try {
			const { db, TableName } = dbContext
			await db.send(
				new DeleteItemCommand({
					TableName,
					Key: {
						id: {
							S: email,
						},
						type: {
							S: 'emailLoginRequest',
						},
					},
					ConditionExpression: '#ttl > :now AND #pin = :pin',
					ExpressionAttributeNames: {
						'#ttl': 'ttl',
						'#pin': 'pin',
					},
					ExpressionAttributeValues: {
						':now': {
							N: `${Math.floor(Date.now() / 1000)}`,
						},
						':pin': {
							S: pin,
						},
					},
					ReturnValues: 'NONE',
				}),
			)

			const { Items } = await db.send(
				new QueryCommand({
					TableName,
					Limit: 1,
					IndexName: emailUserIndex,
					KeyConditionExpression: '#email = :email',
					ExpressionAttributeNames: {
						'#email': 'user__email',
					},
					ExpressionAttributeValues: {
						':email': {
							S: l(email),
						},
					},
				}),
			)

			const event: LoggedInWithEmailAndPin = {
				type: CoreEventType.EMAIL_LOGIN_PIN_SUCCESS,
				email,
				timestamp: new Date(),
			}

			const userId =
				Items?.[0] !== undefined ? unmarshall(Items[0]).id : undefined
			const authContext: UserAuthContext = {
				email,
				sub: userId,
			}
			await notify(event)

			return {
				authContext,
			}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name) {
				return {
					error: ConflictError(`Login failed.`),
				}
			}
			return { error: InternalError() }
		}
	}
