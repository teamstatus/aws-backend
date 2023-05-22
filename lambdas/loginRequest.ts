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
import { checksum } from './checksum.js'
import { problem, result } from './response.js'

// These email addresses (lowercase) are allowed to request logins
const allowedEmails = [
	// Me
	'bc1dec741233ec9c27c8f48700337ffab729a7934d9d577697dd9f5794fe391b',
]

// These domains (lowercase, without @) are allowed to request logins
const allowedDomains = [
	// Nordic
	'1e115f6998bbff78477fe6e267a4cf307824d3ef1d1c61cf549dc0a70ac7e438',
	// example.com
	process.env.IS_TEST !== undefined
		? 'a379a6f6eeafb9a55e378c118034e2751e682fab9f2d30ab13d2125586ce1947'
		: '',
]

const { tableName } = fromEnv({
	tableName: 'TABLE_NAME',
})(process.env)

const ses = new SESClient({})
const db = new DynamoDBClient({})

const { notify } = notifier()
const loginRequest = emailLoginRequest(
	{
		db,
		table: tableName,
	},
	notify,
)

export const handler = async (
	event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> => {
	try {
		const { email } = JSON.parse(event.body ?? '')
		const domain = email.split('@')[1]
		const emailChecksum = checksum(email.toLowerCase())
		const domainChecksum = checksum(domain?.toLowerCase() ?? '')

		if (
			!allowedDomains.includes(domainChecksum) &&
			!allowedEmails.includes(emailChecksum)
		)
			return problem(event)(
				BadRequestError(
					`Checksum for email ${email} (${emailChecksum}) or domain ${domain} (${domainChecksum}) not in allowed list.`,
				),
			)

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
				Source: 'teamstatus.space@gmail.com',
			}),
		)

		return result(event)(StatusCode.ACCEPTED)
	} catch (error) {
		return problem(event)(BadRequestError('Failed to parse JSON.'))
	}
}
