import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { fromEnv } from '@bifravst/from-env'
import type {
	APIGatewayProxyEventV2,
	APIGatewayProxyResultV2,
} from 'aws-lambda'
import { notifier } from '../core/notifier.ts'
import { BadRequestError } from '../core/ProblemDetail.ts'
import { emailLoginRequest } from '../core/persistence/emailLoginRequest.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { problem, result } from './response.ts'

const fromEmail = process.env.FROM_EMAIL ?? 'notification@teamstatus.space'

const { TableName, IS_TEST } = fromEnv({
	TableName: 'TABLE_NAME',
	IS_TEST: 'IS_TEST',
})(process.env)

const isTest = IS_TEST === '1'

const ses = new SESClient({})
const db = new DynamoDBClient({})

const { notify } = notifier()
const loginRequest = emailLoginRequest(
	{
		db,
		TableName,
	},
	notify,
	isTest ? () => `12345678` : undefined,
)

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	try {
		const { email } = JSON.parse(event.body ?? '')
		const r = await loginRequest({ email })

		if ('error' in r) {
			return problem(r.error)
		}

		if (!isTest) {
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
							Data: `[teamstatus.space] Please verify your email`,
						},
					},
					Source: fromEmail,
				}),
			)
		}

		return result(StatusCode.ACCEPTED)
	} catch (error) {
		return problem(BadRequestError((error as Error).message))
	}
}
