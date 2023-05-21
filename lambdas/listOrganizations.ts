import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { listOrganizations } from '../core/persistence/listOrganizations.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const list = listOrganizations({
	db,
	table: tableName,
})

export const handler = userAuthRequestPipe(
	(_) => ({}),
	async (_, authContext) => list(authContext),
)
