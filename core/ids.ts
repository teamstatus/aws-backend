import { Type } from '@sinclair/typebox'

const slugPart = '[a-z0-9_-]+'
const userIdRegex = new RegExp(`^@${slugPart}$`, 'i')
export const UserId = Type.RegExp(userIdRegex, { title: 'User ID' })
/**
 * A user ID is a slug that starts with an `@` sign
 */
export const isUserId = (id?: string): id is string =>
	userIdRegex.test(id ?? '')
const organizationIdRegex = new RegExp(`^\\$${slugPart}$`, 'i')
/**
 * An organization ID is a slug that starts with a `$` sign
 */
export const isOrganizationId = (id?: string): id is string =>
	organizationIdRegex.test(id ?? '')
const projectIdRegex = new RegExp(
	`^(?<organization>\\$${slugPart})(?<project>#${slugPart})$`,
	'i',
)
export const ProjectId = Type.RegExp(projectIdRegex, { title: 'Project ID' })
/**
 * A project ID is a slug that starts with a `#` sign, prefixed with the organization ID it belongs to.
 */
export const isProjectId = (id?: string): id is string =>
	projectIdRegex.test(id ?? '')
export const parseProjectId = (
	projectId?: string,
): { organization: string | null; project: string | null } => {
	const { organization, project } =
		projectIdRegex.exec(projectId ?? '')?.groups ?? {}
	return {
		organization: organization ?? null,
		project: project ?? null,
	}
}
