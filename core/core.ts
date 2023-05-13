import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { acceptProjectInvitation } from './persistence/acceptProjectInvitation.js'
import { createOrganization } from './persistence/createOrganization.js'
import { createProject } from './persistence/createProject.js'
import { createReaction } from './persistence/createReaction.js'
import { createStatus } from './persistence/createStatus.js'
import { createUser } from './persistence/createUser.js'
import { deleteStatus } from './persistence/deleteStatus.js'
import { emailLoginRequest } from './persistence/emailLoginRequest.js'
import { emailPINLogin } from './persistence/emailPINLogin.js'
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
	EMAIL_LOGIN_REQUESTED = 'EMAIL_LOGIN_REQUESTED',
	EMAIL_LOGIN_PIN_SUCCESS = 'EMAIL_LOGIN_PIN_SUCCESS',
	USER_CREATED = 'USER_CREATED',
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
export const l = (s: string): string => s.toLowerCase()

export type DbContext = { db: DynamoDBClient; table: string }

export type Notify = (event: CoreEvent) => void

export const core = (
	dbContext: DbContext,
	{
		privateKey,
	}: {
		privateKey: string
		publicKey: string
	},
): {
	on: (event: CoreEventType | '*', fn: listenerFn) => void
	createReaction: ReturnType<typeof createReaction>
	createProject: ReturnType<typeof createProject>
	createOrganization: ReturnType<typeof createOrganization>
	createStatus: ReturnType<typeof createStatus>
	listStatus: ReturnType<typeof listStatus>
	listOrganizations: ReturnType<typeof listOrganizations>
	listProjects: ReturnType<typeof listProjects>
	inviteToProject: ReturnType<typeof inviteToProject>
	acceptProjectInvitation: ReturnType<typeof acceptProjectInvitation>
	updateStatus: ReturnType<typeof updateStatus>
	deleteStatus: ReturnType<typeof deleteStatus>
	emailLoginRequest: ReturnType<typeof emailLoginRequest>
	emailPINLogin: ReturnType<typeof emailPINLogin>
	createUser: ReturnType<typeof createUser>
} => {
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
		on: (event, fn) => {
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
		emailLoginRequest: emailLoginRequest(dbContext, notify),
		emailPINLogin: emailPINLogin(dbContext, notify, privateKey),
		createUser: createUser(dbContext, notify),
	}
}
