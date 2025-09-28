import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SNSClient } from '@aws-sdk/client-sns'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@bifravst/from-env'
import { notifier } from '../core/notifier.ts'
import { createUser } from '../core/persistence/createUser.ts'
import { StatusCode } from '../core/StatusCode.ts'
import { emailAuthRequestPipe } from './requestPipe.ts'
import { getPrivateKey } from './signingKeyPromise.ts'
import { snsNotifier } from './snsNotifier.ts'
import { tokenCookie } from './tokenCookie.ts'

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
