import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { notifier, type onFn } from './notifier.js'
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
import { verifyToken, verifyUserToken } from './token.js'

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
export const l = (s: string): string => s.toLowerCase()

export type DbContext = { db: DynamoDBClient; table: string }

export const core = (
	dbContext: DbContext,
	publicKey: string,
): {
	on: onFn
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
	const userTokenVerify = verifyUserToken({ verificationKey: publicKey })
	const authTokenVerify = verifyToken({ verificationKey: publicKey })

	const { on, notify } = notifier()

	return {
		on,
		createReaction: createReaction(userTokenVerify, dbContext, notify),
		createProject: createProject(userTokenVerify, dbContext, notify),
		createOrganization: createOrganization(userTokenVerify, dbContext, notify),
		createStatus: createStatus(userTokenVerify, dbContext, notify),
		listStatus: listStatus(userTokenVerify, dbContext),
		listOrganizations: listOrganizations(userTokenVerify, dbContext),
		listProjects: listProjects(userTokenVerify, dbContext),
		inviteToProject: inviteToProject(userTokenVerify, dbContext, notify),
		acceptProjectInvitation: acceptProjectInvitation(
			userTokenVerify,
			dbContext,
			notify,
		),
		updateStatus: updateStatus(userTokenVerify, dbContext, notify),
		deleteStatus: deleteStatus(userTokenVerify, dbContext, notify),
		emailLoginRequest: emailLoginRequest(dbContext, notify),
		emailPINLogin: emailPINLogin(dbContext, notify),
		createUser: createUser(authTokenVerify, dbContext, notify),
	}
}
