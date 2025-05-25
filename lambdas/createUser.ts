import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { SNSClient } from '@aws-sdk/client-sns'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.ts'
import { notifier } from '../core/notifier.ts'
import { createUser } from '../core/persistence/createUser.ts'
import { emailAuthRequestPipe } from './requestPipe.ts'
import { getPrivateKey } from './signingKeyPromise.ts'
import { tokenCookie } from './tokenCookie.ts'
import { snsNotifier } from './snsNotifier.ts'

const { TableName, stackName, topicArn } = fromEnv({
	TableName: 'TABLE_NAME',
	stackName: 'STACK_NAME',
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
	],
)
