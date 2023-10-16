import { arrayContaining, check, objectMatching } from 'tsmatchers'
import { type UserAuthContext } from '../auth.js'
import type { DbContext } from '../persistence/DbContext.js'
import { type Project } from '../persistence/createProject.js'
import { listProjects } from '../persistence/listProjects.js'
import { eventually } from './eventually.js'
import { l } from '../persistence/l.js'

export const ensureUserIsMember = async (
	dbContext: DbContext,
	user: UserAuthContext,
	projectId: string,
) =>
	eventually(async () => {
		const { projects } = (await listProjects(dbContext)(user)) as {
			projects: Project[]
		}

		check(projects).is(arrayContaining(objectMatching({ id: l(projectId) })))
	})
