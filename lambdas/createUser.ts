import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { SNSClient } from '@aws-sdk/client-sns'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { createUser } from '../core/persistence/createUser.js'
import { emailAuthRequestPipe } from './requestPipe.js'
import { getPrivateKey } from './signingKeyPromise.js'
import { tokenCookie } from './tokenCookie.js'
import { snsNotifier } from './snsNotifier.js'

const { TableName, stackName, wsURL, topicArn } = fromEnv({
	TableName: 'TABLE_NAME',
	stackName: 'STACK_NAME',
	wsURL: 'WS_URL',
	topicArn: 'TOPIC_ARN',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})
const sns = new SNSClient({})

const { notify, on } = notifier()
snsNotifier({
	sns,
	topicArn,
})({ on })
const create = createUser(
	{
		db,
		TableName,
	},
	notify,
)

const privateKeyPromise = getPrivateKey({ ssm, stackName })

export const handler = emailAuthRequestPipe(
	(event) => JSON.parse(event.body ?? ''),
	async ({ id, name, pronouns }, authContext) =>
		create({ id, name, pronouns, authContext }),
	() => StatusCode.CREATED,
	async (input, authContext) => [
		await tokenCookie({
			signingKey: await privateKeyPromise,
			authContext: {
				email: authContext.email,
				sub: input.id,
			},
		}),
		await tokenCookie({
			signingKey: await privateKeyPromise,
			authContext: {
				email: authContext.email,
				sub: input.id,
			},
			cookieProps: [`Domain=${new URL(wsURL).hostname}`],
		}),
	],
)
