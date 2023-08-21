import { CloudFormationClient } from '@aws-sdk/client-cloudformation'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { stackOutput } from '@nordicsemiconductor/cloudformation-helpers'
import { getAllUsers } from '../core/persistence/getAllUsers.js'

const stackName = `${process.env.STACK_PREFIX ?? 'teamstatus'}-backend`
const { tableName: TableName } = await stackOutput(
	new CloudFormationClient({}),
)<{
	tableName: string
}>(stackName)

const db = new DynamoDBClient({})
const list = getAllUsers({ db, TableName })

console.log()
for (const user of await list()) {
	console.log(
		`- ${user.id} ${user.name}${
			user.pronouns !== undefined ? ` (${user.pronouns})` : ''
		} <${user.email}>`,
	)
}
