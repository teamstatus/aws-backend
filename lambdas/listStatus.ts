import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { listStatus } from '../core/persistence/listStatus.js'
import { userAuthRequestPipe } from './requestPipe.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const list = listStatus({
	db,
	TableName,
})

export const handler = userAuthRequestPipe(
	(event) => ({
		projectId: event.pathParameters?.projectId as string,
		inclusiveStartDate: event.pathParameters?.inclusiveStartDate,
		inclusiveEndDate: event.pathParameters?.inclusiveEndDate,
	}),
	async ({ projectId, inclusiveStartDate, inclusiveEndDate }, authContext) =>
		list(
			{
				projectId,
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
)
