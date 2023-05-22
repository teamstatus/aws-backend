import { packLambdaFromPath, type PackedLambda } from './packLambdaFromPath.js'

export type BackendLambdas = {
	loginRequest: PackedLambda
	pinLogin: PackedLambda
	apiAuthorizer: PackedLambda
	me: PackedLambda
	createUser: PackedLambda
	listOrganizations: PackedLambda
	listProjects: PackedLambda
	listStatus: PackedLambda
	createOrganization: PackedLambda
	createProject: PackedLambda
	createStatus: PackedLambda
	createReaction: PackedLambda
	cors: PackedLambda
}

export const packBackendLambdas = async (): Promise<BackendLambdas> => ({
	loginRequest: await packLambdaFromPath(
		'loginRequest',
		'lambdas/loginRequest.ts',
	),
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
	createOrganization: await packLambdaFromPath(
		'createOrganization',
		'lambdas/createOrganization.ts',
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
	cors: await packLambdaFromPath('cors', 'lambdas/cors.ts'),
})
