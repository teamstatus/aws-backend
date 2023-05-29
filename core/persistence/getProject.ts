import { GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall } from '@aws-sdk/util-dynamodb'
import { type DbContext } from './DbContext.js'
import type { Project } from './createProject.js'

export const getProject =
	({ db, table }: DbContext) =>
	async (projectId: string): Promise<Project | null> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName: table,
				Key: {
					id: {
						S: projectId,
					},
					type: {
						S: 'project',
					},
				},
			}),
		)

		if (Item === undefined) return null
		const project = unmarshall(Item)

		return {
			id: projectId,
			name: project.name,
		}
	}
