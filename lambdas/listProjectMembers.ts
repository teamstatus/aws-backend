import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { listProjectMembers } from '../core/persistence/listProjectMembers.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const list = listProjectMembers({
	db,
	TableName,
})

export const handler = userAuthRequestPipe(
	(event) => ({
		id: event.pathParameters?.id as string,
	}),
	async ({ id }, authContext) => list(id, authContext),
)
