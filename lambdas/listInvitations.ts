import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { listInvitations } from '../core/persistence/listInvitations.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const list = listInvitations({
	db,
	TableName,
})

export const handler = userAuthRequestPipe(
	() => ({}),
	async (_, authContext) => list(authContext),
)
