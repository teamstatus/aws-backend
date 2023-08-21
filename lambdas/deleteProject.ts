import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { deleteProject } from '../core/persistence/deleteProject.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const del = deleteProject(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => ({
		id: event.pathParameters?.id as string,
		version: parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ id, version }, authContext) => del(id, version, authContext),
	() => StatusCode.ACCEPTED,
)
