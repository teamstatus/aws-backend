import { packLambdaFromPath, type PackedLambda } from './packLambdaFromPath.js'

export type BackendLambdas = {
	loginRequest: PackedLambda
	logout: PackedLambda
	pinLogin: PackedLambda
	apiAuthorizer: PackedLambda
	me: PackedLambda
	createUser: PackedLambda
	listOrganizations: PackedLambda
	listOrganizationProjects: PackedLambda
	listProjects: PackedLambda
	listStatus: PackedLambda
	getStatus: PackedLambda
	createOrganization: PackedLambda
	updateOrganization: PackedLambda
	createProject: PackedLambda
	createStatus: PackedLambda
	createReaction: PackedLambda
	cors: PackedLambda
	deleteStatus: PackedLambda
	deleteReaction: PackedLambda
	updateStatus: PackedLambda
	createToken: PackedLambda
	acceptProjectInvitation: PackedLambda
	listInvitations: PackedLambda
	inviteToProject: PackedLambda
	wsOnConnect: PackedLambda
	wsOnDisconnect: PackedLambda
	wsOnMessage: PackedLambda
	wsAuthorizer: PackedLambda
	createSync: PackedLambda
	listStatusInSync: PackedLambda
	listSyncs: PackedLambda
	getSync: PackedLambda
	emailForwarding: PackedLambda
	eventEmailNotifications: PackedLambda
}

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	loginRequest: await packLambdaFromPath(
		'loginRequest',
		'lambdas/loginRequest.ts',
	),
	logout: await packLambdaFromPath('logout', 'lambdas/logout.ts'),
	pinLogin: await packLambdaFromPath('pinLogin', 'lambdas/pinLogin.ts'),
	apiAuthorizer: await packLambdaFromPath(
		'apiAuthorizer',
		'lambdas/apiAuthorizer.ts',
	),
	me: await packLambdaFromPath('me', 'lambdas/me.ts'),
	createUser: await packLambdaFromPath('createUser', 'lambdas/createUser.ts'),
	listOrganizations: await packLambdaFromPath(
		'listOrganizations',
		'lambdas/listOrganizations.ts',
	),
	listProjects: await packLambdaFromPath(
		'listProjects',
		'lambdas/listProjects.ts',
	),
	listOrganizationProjects: await packLambdaFromPath(
		'listOrganizationProjects',
		'lambdas/listOrganizationProjects.ts',
	),
	createOrganization: await packLambdaFromPath(
		'createOrganization',
		'lambdas/createOrganization.ts',
	),
	updateOrganization: await packLambdaFromPath(
		'updateOrganization',
		'lambdas/updateOrganization.ts',
	),
	createProject: await packLambdaFromPath(
		'createProject',
		'lambdas/createProject.ts',
	),
	createStatus: await packLambdaFromPath(
		'createStatus',
		'lambdas/createStatus.ts',
	),
	createReaction: await packLambdaFromPath(
		'createReaction',
		'lambdas/createReaction.ts',
	),
	listStatus: await packLambdaFromPath('listStatus', 'lambdas/listStatus.ts'),
	getStatus: await packLambdaFromPath('getStatus', 'lambdas/getStatus.ts'),
	cors: await packLambdaFromPath('cors', 'lambdas/cors.ts'),
	deleteStatus: await packLambdaFromPath(
		'deleteStatus',
		'lambdas/deleteStatus.ts',
	),
	updateStatus: await packLambdaFromPath(
		'updateStatus',
		'lambdas/updateStatus.ts',
	),
	createToken: await packLambdaFromPath(
		'createToken',
		'lambdas/createToken.ts',
	),
	acceptProjectInvitation: await packLambdaFromPath(
		'acceptProjectInvitation',
		'lambdas/acceptProjectInvitation.ts',
	),
	listInvitations: await packLambdaFromPath(
		'listInvitations',
		'lambdas/listInvitations.ts',
	),
	inviteToProject: await packLambdaFromPath(
		'inviteToProject',
		'lambdas/inviteToProject.ts',
	),
	deleteReaction: await packLambdaFromPath(
		'deleteReaction',
		'lambdas/deleteReaction.ts',
	),
	wsOnConnect: await packLambdaFromPath(
		'wsOnConnect',
		'lambdas/ws/onConnect.ts',
	),
	wsOnDisconnect: await packLambdaFromPath(
		'wsOnDisconnect',
		'lambdas/ws/onDisconnect.ts',
	),
	wsOnMessage: await packLambdaFromPath(
		'wsOnMessage',
		'lambdas/ws/onMessage.ts',
	),
	wsAuthorizer: await packLambdaFromPath(
		'wsAuthorizer',
		'lambdas/ws/authorizer.ts',
	),
	createSync: await packLambdaFromPath('createSync', 'lambdas/createSync.ts'),
	listStatusInSync: await packLambdaFromPath(
		'listStatusInSync',
		'lambdas/listStatusInSync.ts',
	),
	listSyncs: await packLambdaFromPath('listSyncs', 'lambdas/listSyncs.ts'),
	getSync: await packLambdaFromPath('getSync', 'lambdas/getSync.ts'),
	emailForwarding: await packLambdaFromPath(
		'emailForwarding',
		'lambdas/emailForwarding.ts',
	),
	eventEmailNotifications: await packLambdaFromPath(
		'eventEmailNotifications',
		'lambdas/eventEmailNotifications.ts',
	),
})
