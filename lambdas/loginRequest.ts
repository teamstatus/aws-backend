import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { fromEnv } from '@nordicsemiconductor/from-env'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { BadRequestError } from '../core/ProblemDetail.js'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { emailLoginRequest } from '../core/persistence/emailLoginRequest.js'
import { problem, result } from './response.js'

const fromEmail = process.env.FROM_EMAIL ?? 'notification@teamstatus.space'

const { TableName } = fromEnv({
	TableName: 'TABLE_NAME',
})(process.env)

const ses = new SESClient({})
const db = new DynamoDBClient({})

const { notify } = notifier()
const loginRequest = emailLoginRequest(
	{
		db,
		TableName,
	},
	notify,
)

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	console.log(JSON.stringify({ event }))
	try {
		const { email } = JSON.parse(event.body ?? '')
		const r = await loginRequest({ email })

		if ('error' in r) {
			return problem(event)(r.error)
		}

		await ses.send(
			new SendEmailCommand({
				Destination: {
					ToAddresses: [email],
				},
				Message: {
					Body: {
						Text: { Data: `Your PIN: ${r.pin}` },
					},
					Subject: {
						Data: `[Teamstatus.space] Please verify your email`,
					},
				},
				Source: fromEmail,
			}),
		)

		return result(event)(StatusCode.ACCEPTED)
	} catch (error) {
		return problem(event)(BadRequestError((error as Error).message))
	}
}
