import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { createStatus } from '../core/persistence/createStatus.js'
import { userAuthRequestPipe } from './requestPipe.js'
import { ULID, verifyRecentULID } from './verifyULID.js'
import { validate } from './validate.js'
import { Type } from '@sinclair/typebox'
import { ProjectId } from '../core/ids.js'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const db = new DynamoDBClient({})

const { notify } = notifier()
const create = createStatus(
	{
		db,
		TableName,
	},
	notify,
)

const Message = Type.String({ minLength: 1, title: 'Message' })

export const handler = userAuthRequestPipe(
	(event) => {
		const { id, message, attributeTo } = JSON.parse(event.body ?? '')
		return validate(
			Type.Object({
				id: ULID,
				message: Message,
				projectId: ProjectId,
				attributeTo: Type.Optional(
					Type.String({ minLength: 1, title: 'Non-empty string' }),
				),
			}),
		)({
			id: verifyRecentULID(id),
			message,
			attributeTo,
			projectId: event.pathParameters?.projectId as string,
		})
	},
	async ({ id, message, projectId, attributeTo }, authContext) =>
		create({ id, projectId, message, attributeTo }, authContext),
	() => StatusCode.CREATED,
)
