import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.ts'
import { notifier } from '../core/notifier.ts'
import { createStatus } from '../core/persistence/createStatus.ts'
import { userAuthRequestPipe } from './requestPipe.ts'
import { ULID, verifyRecentULID } from './verifyULID.ts'
import { validate } from './validate.ts'
import { Type } from '@sinclair/typebox'
import { ProjectId } from '../core/ids.ts'
import middy from '@middy/core'
import type { APIGatewayProxyResultV2 } from 'aws-lambda'
import type { AuthorizedEvent } from './AuthorizedEvent.ts'
import type { UserAuthContext } from '../core/auth.ts'
import inputOutputLogger from '@middy/input-output-logger'

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

export const handler = middy<
	AuthorizedEvent<UserAuthContext>,
	APIGatewayProxyResultV2
>()
	.use(inputOutputLogger())
	.handler(
		userAuthRequestPipe(
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
		),
	)
