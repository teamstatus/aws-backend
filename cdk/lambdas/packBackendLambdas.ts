import {
	packLambdaFromPath,
	type PackedLambda,
} from '@bifravst/aws-cdk-lambda-helpers'

export type BackendLambdas = {
	loginRequest: PackedLambda
	logout: PackedLambda
	pinLogin: PackedLambda
	apiAuthorizer: PackedLambda
	me: PackedLambda
	getUserProfile: PackedLambda
	updateUser: PackedLambda
	createUser: PackedLambda
	listOrganizations: PackedLambda
	listOrganizationProjects: PackedLambda
	listProjects: PackedLambda
	listStatus: PackedLambda
	getStatus: PackedLambda
	createOrganization: PackedLambda
	updateOrganization: PackedLambda
	createProject: PackedLambda
	updateProject: PackedLambda
	deleteProject: PackedLambda
	listProjectMembers: PackedLambda
	createStatus: PackedLambda
	createReaction: PackedLambda
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
	deleteSync: PackedLambda
	listStatusInSync: PackedLambda
	listSyncs: PackedLambda
	getSync: PackedLambda
	emailForwarding: PackedLambda
	eventEmailNotifications: PackedLambda
	onboarding: PackedLambda
}
export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	loginRequest: await packLambdaFromPath({
		id: 'loginRequest',
		sourceFilePath: 'lambdas/loginRequest.ts',
	}),
	logout: await packLambdaFromPath({
		id: 'logout',
		sourceFilePath: 'lambdas/logout.ts',
	}),
	pinLogin: await packLambdaFromPath({
		id: 'pinLogin',
		sourceFilePath: 'lambdas/pinLogin.ts',
	}),
	apiAuthorizer: await packLambdaFromPath({
		id: 'apiAuthorizer',
		sourceFilePath: 'lambdas/apiAuthorizer.ts',
	}),
	me: await packLambdaFromPath({
		id: 'me',
		sourceFilePath: 'lambdas/me.ts',
	}),
	getUserProfile: await packLambdaFromPath({
		id: 'getUserProfile',
		sourceFilePath: 'lambdas/getUserProfile.ts',
	}),
	updateUser: await packLambdaFromPath({
		id: 'updateUser',
		sourceFilePath: 'lambdas/updateUser.ts',
	}),
	createUser: await packLambdaFromPath({
		id: 'createUser',
		sourceFilePath: 'lambdas/createUser.ts',
	}),
	listOrganizations: await packLambdaFromPath({
		id: 'listOrganizations',
		sourceFilePath: 'lambdas/listOrganizations.ts',
	}),
	listProjects: await packLambdaFromPath({
		id: 'listProjects',
		sourceFilePath: 'lambdas/listProjects.ts',
	}),
	listOrganizationProjects: await packLambdaFromPath({
		id: 'listOrganizationProjects',
		sourceFilePath: 'lambdas/listOrganizationProjects.ts',
	}),
	createOrganization: await packLambdaFromPath({
		id: 'createOrganization',
		sourceFilePath: 'lambdas/createOrganization.ts',
	}),
	updateOrganization: await packLambdaFromPath({
		id: 'updateOrganization',
		sourceFilePath: 'lambdas/updateOrganization.ts',
	}),
	createProject: await packLambdaFromPath({
		id: 'createProject',
		sourceFilePath: 'lambdas/createProject.ts',
	}),
	updateProject: await packLambdaFromPath({
		id: 'updateProject',
		sourceFilePath: 'lambdas/updateProject.ts',
	}),
	deleteProject: await packLambdaFromPath({
		id: 'deleteProject',
		sourceFilePath: 'lambdas/deleteProject.ts',
	}),
	listProjectMembers: await packLambdaFromPath({
		id: 'listProjectMembers',
		sourceFilePath: 'lambdas/listProjectMembers.ts',
	}),
	createStatus: await packLambdaFromPath({
		id: 'createStatus',
		sourceFilePath: 'lambdas/createStatus.ts',
	}),
	createReaction: await packLambdaFromPath({
		id: 'createReaction',
		sourceFilePath: 'lambdas/createReaction.ts',
	}),
	listStatus: await packLambdaFromPath({
		id: 'listStatus',
		sourceFilePath: 'lambdas/listStatus.ts',
	}),
	getStatus: await packLambdaFromPath({
		id: 'getStatus',
		sourceFilePath: 'lambdas/getStatus.ts',
	}),
	deleteStatus: await packLambdaFromPath({
		id: 'deleteStatus',
		sourceFilePath: 'lambdas/deleteStatus.ts',
	}),
	updateStatus: await packLambdaFromPath({
		id: 'updateStatus',
		sourceFilePath: 'lambdas/updateStatus.ts',
	}),
	createToken: await packLambdaFromPath({
		id: 'createToken',
		sourceFilePath: 'lambdas/createToken.ts',
	}),
	acceptProjectInvitation: await packLambdaFromPath({
		id: 'acceptProjectInvitation',
		sourceFilePath: 'lambdas/acceptProjectInvitation.ts',
	}),
	listInvitations: await packLambdaFromPath({
		id: 'listInvitations',
		sourceFilePath: 'lambdas/listInvitations.ts',
	}),
	inviteToProject: await packLambdaFromPath({
		id: 'inviteToProject',
		sourceFilePath: 'lambdas/inviteToProject.ts',
	}),
	deleteReaction: await packLambdaFromPath({
		id: 'deleteReaction',
		sourceFilePath: 'lambdas/deleteReaction.ts',
	}),
	wsOnConnect: await packLambdaFromPath({
		id: 'wsOnConnect',
		sourceFilePath: 'lambdas/ws/onConnect.ts',
	}),
	wsOnDisconnect: await packLambdaFromPath({
		id: 'wsOnDisconnect',
		sourceFilePath: 'lambdas/ws/onDisconnect.ts',
	}),
	wsOnMessage: await packLambdaFromPath({
		id: 'wsOnMessage',
		sourceFilePath: 'lambdas/ws/onMessage.ts',
	}),
	wsAuthorizer: await packLambdaFromPath({
		id: 'wsAuthorizer',
		sourceFilePath: 'lambdas/ws/authorizer.ts',
	}),
	createSync: await packLambdaFromPath({
		id: 'createSync',
		sourceFilePath: 'lambdas/createSync.ts',
	}),
	deleteSync: await packLambdaFromPath({
		id: 'deleteSync',
		sourceFilePath: 'lambdas/deleteSync.ts',
	}),
	listStatusInSync: await packLambdaFromPath({
		id: 'listStatusInSync',
		sourceFilePath: 'lambdas/listStatusInSync.ts',
	}),
	listSyncs: await packLambdaFromPath({
		id: 'listSyncs',
		sourceFilePath: 'lambdas/listSyncs.ts',
	}),
	getSync: await packLambdaFromPath({
		id: 'getSync',
		sourceFilePath: 'lambdas/getSync.ts',
	}),
	emailForwarding: await packLambdaFromPath({
		id: 'emailForwarding',
		sourceFilePath: 'lambdas/emailForwarding.ts',
	}),
	eventEmailNotifications: await packLambdaFromPath({
		id: 'eventEmailNotifications',
		sourceFilePath: 'lambdas/eventEmailNotifications.ts',
	}),
	onboarding: await packLambdaFromPath({
		id: 'onboarding',
		sourceFilePath: 'lambdas/onboarding.ts',
	}),
})
