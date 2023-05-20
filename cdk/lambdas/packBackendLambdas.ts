import { packLambdaFromPath, type PackedLambda } from './packLambdaFromPath.js'

export type BackendLambdas = {
	loginRequest: PackedLambda
	pinLogin: PackedLambda
	apiAuthorizer: PackedLambda
	me: PackedLambda
	createUser: PackedLambda
	listOrganizations: PackedLambda
	createOrganization: PackedLambda
	createProject: PackedLambda
	createStatus: PackedLambda
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
})
