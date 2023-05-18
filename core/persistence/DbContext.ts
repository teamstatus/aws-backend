import { DynamoDBClient } from '@aws-sdk/client-dynamodb'

export type DbContext = { db: DynamoDBClient; table: string }
