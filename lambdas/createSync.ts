import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { createSync } from '../core/persistence/createSync.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const create = createSync(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = userAuthRequestPipe(
	(event) => JSON.parse(event.body ?? ''),
	async (
		{ id, title, projectIds, inclusiveStartDate, inclusiveEndDate },
		authContext,
	) =>
		create(
			{
				id,
				projectIds,
				title,
				inclusiveStartDate:
					inclusiveStartDate !== undefined
						? new Date(inclusiveStartDate)
						: undefined,
				inclusiveEndDate:
					inclusiveEndDate !== undefined
						? new Date(inclusiveEndDate)
						: undefined,
			},
			authContext,
		),
	() => StatusCode.CREATED,
)
