import type { UserAuthContext } from '../auth.js'
import { type DbContext } from './DbContext.js'
import { isProjectMember } from './getProjectMember.js'

export const canReadProjects =
	(dbContext: DbContext) =>
	async (
		projectIds: string[],
		{ sub: userId }: UserAuthContext,
	): Promise<boolean> => {
		const memberCheck = isProjectMember(dbContext)
		const allMember = await Promise.all(
			projectIds.map(async (projectId) => ({
				projectId,
				isMember: await memberCheck(projectId, userId),
			})),
		)

		const notMemberOf = allMember.find(({ isMember }) => isMember === false)
		return notMemberOf === undefined
	}
