import { GetItemCommand } from '@aws-sdk/client-dynamodb'
import { unmarshall, type NativeAttributeValue } from '@aws-sdk/util-dynamodb'
import type { DbContext } from './DbContext.ts'
import type { Project } from './createProject.ts'

export const getProject =
	({ db, TableName }: DbContext) =>
	async (projectId: string): Promise<Project | null> => {
		const { Item } = await db.send(
			new GetItemCommand({
				TableName,
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

		if (Item === undefined) {
			return null
		}
		const project = unmarshall(Item)

		return itemToProject(project)
	}

export const itemToProject = (
	item: Record<string, NativeAttributeValue>,
): Project => ({
	id: item.id,
	name: item.name ?? undefined,
	version: item.version,
})
