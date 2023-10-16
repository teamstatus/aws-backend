export const projectStatusIndex = 'projectStatusIndex-2'
export const organizationMemberIndex = 'organizationMember'
export const projectMemberIndex = 'projectMember'
export const projectMembersIndex = 'projectMembers'
export const statusReactionIndex = 'statusReaction'
export const emailUserIndex = 'emailUser'
export const syncOwnerIndex = 'syncOwner'
export const projectSyncProjectIndex = 'projectSyncProject'
export const invitationsForUserIndex = 'invitationsForUser'

export const indexes: Record<
	string,
	{ keys: [hash: string, range: string]; include?: string[] }
> = {
	[organizationMemberIndex]: {
		keys: ['organizationMember__user', 'organizationMember__organization'],
		include: ['role', 'id'],
	},
	[projectMemberIndex]: {
		keys: ['projectMember__user', 'projectMember__project'],
		include: ['role', 'id', 'version'],
	},
	[projectMembersIndex]: {
		keys: ['projectMember__project', 'id'],
		include: ['role', 'projectMember__user', 'version'],
	},
	[projectStatusIndex]: {
		keys: ['projectStatus__project', 'id'],
		include: ['author', 'message', 'attributeTo', 'version'],
	},
	[statusReactionIndex]: {
		keys: ['statusReaction__status', 'id'],
		include: ['author', 'emoji', 'role', 'description'],
	},
	[emailUserIndex]: {
		keys: ['user__email', 'id'],
	},
	[syncOwnerIndex]: {
		keys: ['sync__owner', 'id'],
	},
	[projectSyncProjectIndex]: { keys: ['sync__project', 'id'] },
	[invitationsForUserIndex]: {
		keys: ['projectInvitation__invitee', 'id'],
		include: ['role', 'projectInvitation__inviter'],
	},
}
