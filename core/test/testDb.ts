import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { ulid } from 'ulid'

export const isCI = process.env.CI !== undefined
export const testDb = (): { TableName: string; db: DynamoDBClient } => {
	if (isCI) {
		return {
			TableName: process.env.TABLE_NAME ?? '',
			db: new DynamoDBClient({}),
		}
	}
	return {
		TableName: `teamstatus-${ulid()}`,
		db: new DynamoDBClient({
			endpoint: 'http://localhost:8000/',
			region: 'eu-west-1',
		}),
	}
}
