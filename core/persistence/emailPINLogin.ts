import { GetItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb'
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
		const { db, table } = dbContext
		const { Item } = await db.send(
			new GetItemCommand({
				TableName: table,
				Key: {
					id: {
						S: email,
					},
					type: {
						S: 'emailLoginRequest',
					},
				},
			}),
		)
		if (Item === undefined)
			return { error: new Error(`No entry for '${email}' found.`) }

		const request = unmarshall(Item)

		if (request.ttl * 1000 < Date.now())
			return { error: new Error(`Request expired.`) }

		if (pin !== request.pin)
			return { error: new Error(`PIN ${pin} does not match.`) }

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
					email: request.id,
				},
				signingKey,
				options,
			),
		}
	}
