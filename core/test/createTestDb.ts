import type { DbContext } from '../persistence/DbContext.ts'
import { createTable } from '../persistence/test/createTable.ts'
import { isCI } from './testDb.ts'

export const createTestDb =
	({ TableName, db }: DbContext) =>
	async (): Promise<void> => {
		if (isCI) {
			return
		}
		await createTable(db, TableName)
	}
