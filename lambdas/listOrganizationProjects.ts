import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { listOrganizationProjects } from '../core/persistence/listOrganizationProjects.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const list = listOrganizationProjects({
	db,
	table: tableName,
})

export const handler = userAuthRequestPipe(
	(event) => ({
		organizationId: event.pathParameters?.organizationId as string,
	}),
	async ({ organizationId }, authContext) => list(organizationId, authContext),
)
