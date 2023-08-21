import { fromEnv } from '@nordicsemiconductor/from-env'
import type { UserAuthContext } from '../core/auth.js'
import { emailAuthRequestPipe } from './requestPipe.js'
import { getUser } from '../core/persistence/getUser.js'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const get = getUser({
	db,
	TableName,
})

export const handler = emailAuthRequestPipe(
	() => ({}),
	async (_, authContext) => {
		if ((authContext as UserAuthContext).sub === undefined)
			return {
				user: {
					email: authContext.email,
				},
			}

		return await get(authContext as UserAuthContext)
	},
)
