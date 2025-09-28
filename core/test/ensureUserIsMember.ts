import assert from 'node:assert'
import type { UserAuthContext } from '../auth.ts'
import type { Project } from '../persistence/createProject.ts'
import type { DbContext } from '../persistence/DbContext.ts'
import { l } from '../persistence/l.ts'
import { listProjects } from '../persistence/listProjects.ts'
import { eventually } from './eventually.ts'

export const ensureUserIsMember = async (
	dbContext: DbContext,
	user: UserAuthContext,
	projectId: string,
) =>
	eventually(async () => {
		const { projects } = (await listProjects(dbContext)(user)) as {
			projects: Project[]
		}

		const maybeProject = projects.find((p) => p.id === l(projectId))

		assert(
			maybeProject,
			`Expected user ${user.sub} to be member of project ${projectId}, but they are not`,
		)
	})
