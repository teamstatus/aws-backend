export const indexes: Record<
	string,
	{ keys: [hash: string, range: string]; include?: string[] }
> = {
	organizationMember: {
		keys: ['organizationMember__user', 'organizationMember__organization'],
		include: ['role', 'id'],
	},
	projectMember: {
		keys: ['projectMember__user', 'projectMember__project'],
		include: ['role', 'id', 'version'],
	},
	projectMembers: {
		keys: ['projectMember__project', 'id'],
		include: ['role', 'projectMember__user', 'version'],
	},
	projectStatus: {
		keys: ['projectStatus__project', 'id'],
		include: ['author', 'message', 'version'],
	},
	statusReaction: {
		keys: ['statusReaction__status', 'id'],
		include: ['author', 'emoji', 'role', 'description'],
	},
	emailUser: {
		keys: ['user__email', 'id'],
	},
	syncOwner: {
		keys: ['sync__owner', 'id'],
	},
	projectSyncProject: { keys: ['sync__project', 'id'] },
	invitationsForUser: {
		keys: ['projectInvitation__invitee', 'id'],
		include: ['role', 'projectInvitation__inviter'],
	},
}
