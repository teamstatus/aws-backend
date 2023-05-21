import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { createOrganization } from '../core/persistence/createOrganization.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const create = createOrganization(
	{
		db,
		table: tableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => JSON.parse(event.body ?? ''),
	async ({ id, name }, authContext) =>
		create(
			{
				id,
				name,
			},
			authContext,
		),
	() => StatusCode.CREATED,
)
