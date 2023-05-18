import {
	ConditionalCheckFailedException,
	QueryCommand,
	UpdateItemCommand,
} from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import type { SignOptions } from 'jsonwebtoken'
import jwt from 'jsonwebtoken'
import {
	CoreEventType,
	type CoreEvent,
	type DbContext,
	type Notify,
} from '../core.js'

export type LoggedInWithEmailAndPin = CoreEvent & {
	type: CoreEventType.EMAIL_LOGIN_PIN_SUCCESS
	email: string
}

export const emailPINLogin =
	(dbContext: DbContext, notify: Notify, signingKey: string) =>
	async ({
		email,
		pin,
	}: {
		email: string
		pin: string
	}): Promise<{ error: Error } | { token: string }> => {
		try {
			const { db, table } = dbContext
			await db.send(
				new UpdateItemCommand({
					TableName: table,
					Key: {
						id: {
							S: email,
						},
						type: {
							S: 'emailLoginRequest',
						},
					},
					UpdateExpression: 'SET #ttl = :now, #deletedAt = :deletedAt',
					ConditionExpression:
						'attribute_not_exists(#deletedAt) AND #ttl > :now AND #pin = :pin',
					ExpressionAttributeNames: {
						'#ttl': 'ttl',
						'#pin': 'pin',
						'#deletedAt': 'deletedAt',
					},
					ExpressionAttributeValues: {
						':now': {
							N: `${Math.floor(Date.now() / 1000)}`,
						},
						':pin': {
							S: pin,
						},
						':deletedAt': {
							S: new Date().toISOString(),
						},
					},
					ReturnValues: 'NONE',
				}),
			)

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

			const event: LoggedInWithEmailAndPin = {
				type: CoreEventType.EMAIL_LOGIN_PIN_SUCCESS,
				email,
				timestamp: new Date(),
			}
			notify(event)
			const options: SignOptions = {
				algorithm: 'ES256',
				allowInsecureKeySizes: false,
				expiresIn: 24 * 60 * 60, // seconds
			}
			if (Items?.[0] !== undefined) {
				const user = unmarshall(Items[0])
				options.subject = user.id
			}
			return {
				token: jwt.sign(
					{
						email,
					},
					signingKey,
					options,
				),
			}
		} catch (error) {
			if ((error as Error).name === ConditionalCheckFailedException.name)
				return {
					error: new Error(`Login failed.`),
				}
			return { error: error as Error }
		}
	}
