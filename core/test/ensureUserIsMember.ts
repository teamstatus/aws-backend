import { arrayContaining, check, objectMatching } from 'tsmatchers'
import type { UserAuthContext } from '../auth.ts'
import type { DbContext } from '../persistence/DbContext.ts'
import type { Project } from '../persistence/createProject.ts'
import { listProjects } from '../persistence/listProjects.ts'
import { eventually } from './eventually.ts'
import { l } from '../persistence/l.ts'

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
