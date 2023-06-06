import type { DbContext } from '../persistence/DbContext.js'
import { createTable } from '../persistence/test/createTable.js'
import { isCI } from './testDb.js'

export const createTestDb =
	({ TableName, db }: DbContext) =>
	async () => {
		if (isCI) {
			console.log(`Using existing table ${TableName}.`)
			return
		}
		try {
			await createTable(db, TableName)
		} catch (err) {
			console.error(`Failed to create table: ${(err as Error).message}!`)
			throw err
		}
		console.log(`Table ${TableName} created.`)
	}
