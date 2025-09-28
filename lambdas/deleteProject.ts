import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { notifier } from '../core/notifier.ts'
import { deleteProject } from '../core/persistence/deleteProject.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { userAuthRequestPipe } from './requestPipe.ts'

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
		version: Number.parseInt(event.headers['if-match'] ?? '0', 10),
	}),
	async ({ id, version }, authContext) => del(id, version, authContext),
	() => StatusCode.ACCEPTED,
)
