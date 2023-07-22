import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { getStatus } from '../core/persistence/getStatus.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const get = getStatus({
	db,
	TableName,
})

export const handler = userAuthRequestPipe(
	(event) => ({
		projectId: event.pathParameters?.projectId as string,
		statusId: event.pathParameters?.statusId as string,
	}),
	async ({ projectId, statusId }, authContext) =>
		get({ projectId, statusId }, authContext),
)
