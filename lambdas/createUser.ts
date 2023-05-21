import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SSMClient } from '@aws-sdk/client-ssm'
import { fromEnv } from '@nordicsemiconductor/from-env'
import { StatusCode } from '../core/StatusCode.js'
import { notifier } from '../core/notifier.js'
import { createUser } from '../core/persistence/createUser.js'
import { emailAuthRequestPipe } from './requestPipe.js'
import { getPrivateKey } from './signingKeyPromise.js'
import { tokenCookie } from './tokenCookie.js'

const { tableName, stackName } = fromEnv({
	tableName: 'TABLE_NAME',
	stackName: 'STACK_NAME',
})(process.env)

const db = new DynamoDBClient({})
const ssm = new SSMClient({})

const { notify } = notifier()
const create = createUser(
	{
		db,
		table: tableName,
	},
	notify,
)

const privateKeyPromise = getPrivateKey({ ssm, stackName })

export const handler = emailAuthRequestPipe(
	(event) => JSON.parse(event.body ?? ''),
	async ({ id, name }, authContext) => create({ id, name, authContext }),
	() => StatusCode.CREATED,
	async (input, authContext) =>
		tokenCookie({
			signingKey: await privateKeyPromise,
			authContext: {
				email: authContext.email,
				sub: input.id,
			},
		}),
)
