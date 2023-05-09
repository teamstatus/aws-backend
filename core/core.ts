import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { acceptProjectInvitation } from './persistence/acceptProjectInvitation.js'
import { createOrganization } from './persistence/createOrganization.js'
import { createProject } from './persistence/createProject.js'
import { createReaction } from './persistence/createReaction.js'
import { createStatus } from './persistence/createStatus.js'
import { deleteStatus } from './persistence/deleteStatus.js'
import { inviteToProject } from './persistence/inviteToProject.js'
import { listOrganizations } from './persistence/listOrganizations.js'
import { listProjects } from './persistence/listProjects.js'
import { listStatus } from './persistence/listStatus.js'
import { updateStatus } from './persistence/updateStatus.js'

export type AuthContext = {
	userId: string
}

export enum CoreEventType {
	ORGANIZATION_CREATED = 'ORGANIZATION_CREATED',
	PROJECT_CREATED = 'PROJECT_CREATED',
	STATUS_CREATED = 'STATUS_CREATED',
	STATUS_UPDATED = 'STATUS_UPDATED',
	STATUS_DELETED = 'STATUS_DELETED',
	PROJECT_MEMBER_INVITED = 'PROJECT_MEMBER_INVITED',
	PROJECT_MEMBER_CREATED = 'PROJECT_MEMBER_CREATED',
	REACTION_CREATED = 'REACTION_CREATED',
}
export enum Role {
	OWNER = 'owner',
	MEMBER = 'member',
}
export type CoreEvent = {
	type: CoreEventType
	timestamp: Date
}
type listenerFn = (event: CoreEvent) => unknown
export const l = (s: string) => s.toLowerCase()

export type DbContext = { db: DynamoDBClient; table: string }

export type Notify = (event: CoreEvent) => void

export const core = (dbContext: DbContext) => {
	const listeners: { event: CoreEventType | '*'; fn: listenerFn }[] = []
	const notify = (event: CoreEvent) => {
		for (const { fn } of [
			...listeners.filter(({ event }) => event === '*'),
			...listeners.filter(({ event: e }) => e === event.type),
		]) {
			fn(event)
		}
	}

	return {
		on: (event: CoreEventType | '*', fn: listenerFn) => {
			listeners.push({ event, fn })
		},
		createReaction: createReaction(dbContext, notify),
		createProject: createProject(dbContext, notify),
		createOrganization: createOrganization(dbContext, notify),
		createStatus: createStatus(dbContext, notify),
		listStatus: listStatus(dbContext),
		listOrganizations: listOrganizations(dbContext),
		listProjects: listProjects(dbContext),
		inviteToProject: inviteToProject(dbContext, notify),
		acceptProjectInvitation: acceptProjectInvitation(dbContext, notify),
		updateStatus: updateStatus(dbContext, notify),
		deleteStatus: deleteStatus(dbContext, notify),
	}
}
