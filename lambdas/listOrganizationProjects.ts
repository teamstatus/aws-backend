import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@bifravst/from-env'
import { listOrganizationProjects } from '../core/persistence/listOrganizationProjects.ts'
import { userAuthRequestPipe } from './requestPipe.ts'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const list = listOrganizationProjects({
	db,
	TableName,
})

export const handler = userAuthRequestPipe(
	(event) => ({
		organizationId: event.pathParameters?.organizationId as string,
	}),
	async ({ organizationId }, authContext) => list(organizationId, authContext),
)
