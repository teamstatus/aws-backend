import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import assert from 'node:assert/strict'
import { before, describe, test as it } from 'node:test'
import {
	aString,
	check,
	definedValue,
	objectMatching,
	stringMatching,
	undefinedValue,
} from 'tsmatchers'
import { ulid } from 'ulid'
import { type CoreEvent } from './CoreEvent.js'
import { CoreEventType } from './CoreEventType.js'
import type { ProblemDetail } from './ProblemDetail.js'
import { Role } from './Role.js'
import { type EmailAuthContext, type UserAuthContext } from './auth.js'
import { notifier } from './notifier.js'
import type { DbContext } from './persistence/DbContext.js'
import { acceptProjectInvitation } from './persistence/acceptProjectInvitation.js'
import {
	createOrganization,
	type PersistedOrganization,
} from './persistence/createOrganization.js'
import {
	createProject,
	type PersistedProject,
} from './persistence/createProject.js'
import {
	createReaction,
	newVersionRelease,
	thumbsUp,
	type PersistedReaction,
} from './persistence/createReaction.js'
import {
	createStatus,
	type PersistedStatus,
} from './persistence/createStatus.js'
import { createTable } from './persistence/createTable.js'
import { createUser, type PersistedUser } from './persistence/createUser.js'
import { deleteStatus } from './persistence/deleteStatus.js'
import {
	emailLoginRequest,
	type EmailLoginRequest,
} from './persistence/emailLoginRequest.js'
import { emailPINLogin } from './persistence/emailPINLogin.js'
import {
	inviteToProject,
	type PersistedInvitation,
} from './persistence/inviteToProject.js'
import { listOrganizations } from './persistence/listOrganizations.js'
import { listProjects } from './persistence/listProjects.js'
import { listStatus } from './persistence/listStatus.js'
import { updateStatus } from './persistence/updateStatus.js'

const aUlid = () => stringMatching(/[0-7][0-9A-HJKMNP-TV-Z]{25}/gm) as any

const isCI = process.env.CI !== undefined
const testDb = () => {
	if (isCI) {
		return {
			table: process.env.TABLE_NAME ?? '',
			db: new DynamoDBClient({}),
		}
	}
	return {
		table: `teamstatus-${ulid()}`,
		db: new DynamoDBClient({
			endpoint: 'http://localhost:8000/',
			region: 'eu-west-1',
		}),
	}
}

describe('core', async () => {
	const { table, db } = testDb()

	const dbContext: DbContext = {
		db,
		table,
	}

	const { on, notify } = notifier()

	before(async () => {
		if (isCI) {
			console.log(`Using existing table ${table}.`)
			return
		}
		try {
			await createTable(db, table)
		} catch (err) {
			console.error(`Failed to create table: ${(err as Error).message}!`)
			throw err
		}
		console.log(`Table ${table} created.`)
	})

	describe('user management', async () => {
		describe('allows users to log-in with their email', async () => {
			let pin: string
			it('generates a login request', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.EMAIL_LOGIN_REQUESTED, (e) => events.push(e))
				const { loginRequest, pin: p } = (await emailLoginRequest(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
				})) as { loginRequest: EmailLoginRequest; pin: string }
				check(loginRequest).is(
					objectMatching({
						email: 'alex@example.com',
					}),
				)
				check(events[0]).is(
					objectMatching({
						type: CoreEventType.EMAIL_LOGIN_REQUESTED,
						email: 'alex@example.com',
					}),
				)
				check(p).is(stringMatching(/^[0-9]{8}$/))
				pin = p
			})

			it('prevents spamming log-in requests', async () => {
				const { error } = (await emailLoginRequest(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
				})) as { error: ProblemDetail }

				check(error).is(definedValue)
			})

			it('logs a user in using a PIN', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.EMAIL_LOGIN_PIN_SUCCESS, (e) => events.push(e))
				const { authContext } = (await emailPINLogin(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
					pin,
				})) as { authContext: EmailAuthContext }

				check(events[0]).is(
					objectMatching({
						type: CoreEventType.EMAIL_LOGIN_PIN_SUCCESS,
						email: 'alex@example.com',
					}),
				)

				check(authContext).is(
					objectMatching({
						email: 'alex@example.com',
						sub: undefinedValue,
					}),
				)
			})

			it('prevents re-using PINs', async () => {
				const { error } = (await emailPINLogin(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
					pin,
				})) as { error: ProblemDetail }

				check(error).is(definedValue)
			})

			it('allows users to claim a user ID', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.USER_CREATED, (e) => events.push(e))
				const { user } = (await createUser(
					dbContext,
					notify,
				)({
					id: '@alex',
					name: 'Alex Doe',
					authContext: { email: 'alex@example.com' },
				})) as { user: PersistedUser }
				check(user).is(
					objectMatching({
						id: '@alex',
						name: 'Alex Doe',
						email: 'alex@example.com',
					}),
				)
				check(events[0]).is(
					objectMatching({
						type: CoreEventType.USER_CREATED,
						id: '@alex',
						name: 'Alex Doe',
						email: 'alex@example.com',
					}),
				)
			})

			it(`adds the user's ID to the token after they have claimed a user ID`, async () => {
				const { pin } = (await emailLoginRequest(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
				})) as { loginRequest: EmailLoginRequest; pin: string }
				const { authContext } = (await emailPINLogin(
					dbContext,
					notify,
				)({
					email: 'alex@example.com',
					pin,
				})) as { authContext: UserAuthContext }
				check(authContext).is(
					objectMatching({
						email: 'alex@example.com',
						sub: '@alex',
					}),
				)
			})
		})
	})

	describe('organizations', async () => {
		it('can create a new organization', async () => {
			const events: CoreEvent[] = []
			on(CoreEventType.ORGANIZATION_CREATED, (e) => events.push(e))
			const { organization } = (await createOrganization(dbContext, notify)(
				{ id: '$acme', name: 'ACME Inc.' },
				{ email: 'alex@example.com', sub: '@alex' },
			)) as { organization: PersistedOrganization }
			check(organization).is(
				objectMatching({
					id: '$acme',
					name: 'ACME Inc.',
				}),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.ORGANIZATION_CREATED,
					id: '$acme',
					name: 'ACME Inc.',
					owner: '@alex',
				}),
			)
		})

		it('ensures that organizations are unique', async () => {
			const { error } = (await createOrganization(dbContext, notify)(
				{ id: '$acme' },
				{ email: 'alex@example.com', sub: '@alex' },
			)) as { error: ProblemDetail }

			assert.equal(error?.title, `Organization '$acme' already exists.`)
		})

		it('can list organizations for a user', async () => {
			const { organizations } = (await listOrganizations(dbContext)({
				email: 'alex@example.com',
				sub: '@alex',
			})) as {
				organizations: PersistedOrganization[]
			}
			check(organizations?.[0]).is(
				objectMatching({
					id: '$acme',
				}),
			)
		})
	})

	describe('projects', async () => {
		it('can create a new project', async () => {
			const events: CoreEvent[] = []
			on(CoreEventType.PROJECT_CREATED, (e) => events.push(e))
			on(CoreEventType.PROJECT_MEMBER_CREATED, (e) => events.push(e))

			const { project } = (await createProject(dbContext, notify)(
				{ id: '$acme#teamstatus', name: 'Teamstatus', color: '#ff0000' },
				{ email: 'alex@example.com', sub: '@alex' },
			)) as { project: PersistedProject }

			check(project).is(
				objectMatching({
					id: '$acme#teamstatus',
					name: 'Teamstatus',
					color: '#ff0000',
				}),
			)
			check(events[0]).is(
				objectMatching({
					type: CoreEventType.PROJECT_CREATED,
					id: '$acme#teamstatus',
					name: 'Teamstatus',
					color: '#ff0000',
				}),
			)
			check(events[1]).is(
				objectMatching({
					type: CoreEventType.PROJECT_MEMBER_CREATED,
					project: '$acme#teamstatus',
					user: '@alex',
				}),
			)
		})

		it('ensures that projects are unique', async () => {
			const res = (await createProject(dbContext, notify)(
				{ id: '$acme#teamstatus' },
				{ email: 'alex@example.com', sub: '@alex' },
			)) as { error: ProblemDetail }

			assert.equal(
				res.error?.title,
				`Project '$acme#teamstatus' already exists.`,
			)
		})

		it('can list projects for a user', async () => {
			const { projects } = (await listProjects(dbContext)('$acme', {
				email: 'alex@example.com',
				sub: '@alex',
			})) as { projects: PersistedProject[] }
			check(projects?.[0]).is(
				objectMatching({
					id: '$acme#teamstatus',
					name: 'Teamstatus',
					color: '#ff0000',
				}),
			)
		})

		describe('member', async () => {
			let invitationId: string
			it('allows project owners to invite other users to a project', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.PROJECT_MEMBER_INVITED, (e) => events.push(e))

				const { invitation } = (await inviteToProject(dbContext, notify)(
					'@cameron',
					'$acme#teamstatus',
					{ email: 'alex@example.com', sub: '@alex' },
				)) as { invitation: PersistedInvitation }

				check(invitation).is(
					objectMatching({
						project: '$acme#teamstatus',
						invitee: '@cameron',
						inviter: '@alex',
						role: Role.MEMBER,
						id: aString,
					}),
				)
				check(events[0]).is(
					objectMatching({
						type: CoreEventType.PROJECT_MEMBER_INVITED,
						project: '$acme#teamstatus',
						invitee: '@cameron',
						inviter: '@alex',
						role: Role.MEMBER,
						id: aString,
					}),
				)

				invitationId = invitation?.id ?? ''
			})

			describe('invited member', async () => {
				it('should not allow an uninvited user to post a status to a project', async () => {
					const { error } = (await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Should not work',
						{ email: 'cameron@example.com', sub: '@cameron' },
					)) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '$acme#teamstatus' are allowed to create status.`,
					)
				})

				it('allows users to accept invitations', async () => {
					const { error } = (await acceptProjectInvitation(dbContext, notify)(
						invitationId,
						{ email: 'cameron@example.com', sub: '@cameron' },
					)) as { error: ProblemDetail }
					assert.equal(error, undefined)
				})

				it('should allow user after accepting their invitation to post a status to a project', async () => {
					const { error } = (await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Should work now!',
						{ email: 'cameron@example.com', sub: '@cameron' },
					)) as { error: ProblemDetail }
					assert.equal(error, undefined)
				})
			})
		})

		describe('status', async () => {
			describe('create', async () => {
				it('can post a new status update', async () => {
					const events: CoreEvent[] = []
					on(CoreEventType.STATUS_CREATED, (e) => events.push(e))

					const id = ulid()
					const { status } = (await createStatus(dbContext, notify)(
						id,
						'$acme#teamstatus',
						'Implemented ability to persist status updates for projects.',
						{ email: 'alex@example.com', sub: '@alex' },
					)) as { status: PersistedStatus }

					check(status).is(
						objectMatching({
							project: '$acme#teamstatus',
							message:
								'Implemented ability to persist status updates for projects.',
							id,
						}),
					)
					check(events[0]).is(
						objectMatching({
							type: CoreEventType.STATUS_CREATED,
							project: '$acme#teamstatus',
							message:
								'Implemented ability to persist status updates for projects.',
							author: '@alex',
							id,
						}),
					)
				})

				it('allows posting status only for organization members', async () => {
					const { error } = (await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'I am not a member of the $acme organization, so I should not be allowed to create a status.',
						{ email: 'blake@example.com', sub: '@blake' },
					)) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '$acme#teamstatus' are allowed to create status.`,
					)
				})
			})

			describe('edit', async () => {
				let statusId: string
				it('allows status to be edited by the author', async () => {
					// Create the status
					const { status } = (await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Status with an typo',
						{ email: 'alex@example.com', sub: '@alex' },
					)) as { status: PersistedStatus }
					statusId = status.id

					// Updated
					const { status: updated } = (await updateStatus(dbContext, notify)(
						statusId,
						'Status with a typo',
						1,
						{ email: 'alex@example.com', sub: '@alex' },
					)) as { status: PersistedStatus }
					check(updated).is(
						objectMatching({
							version: 2,
						}),
					)

					// Fetch
					const { status: statusList } = (await listStatus(dbContext)(
						'$acme#teamstatus',
						{ email: 'alex@example.com', sub: '@alex' },
					)) as {
						status: PersistedStatus[]
					}
					assert.equal(statusList?.[0]?.message, 'Status with a typo')
				})

				it('allows status to be deleted by the author', async () => {
					const { error } = (await deleteStatus(dbContext, notify)(statusId, {
						email: 'alex@example.com',
						sub: '@alex',
					})) as { error: ProblemDetail }

					assert.equal(error, undefined)
				})
			})

			describe('list', async () => {
				it('can list status for a project', async () => {
					const { status } = (await listStatus(dbContext)('$acme#teamstatus', {
						email: 'alex@example.com',
						sub: '@alex',
					})) as { status: PersistedStatus[] }
					check(status?.[0]).is(
						objectMatching({
							id: aString,
							message:
								'Implemented ability to persist status updates for projects.',
							author: '@alex',
							project: '$acme#teamstatus',
						}),
					)
				})

				it('sorts status by creation time', async () => {
					await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Status 1',
						{ email: 'alex@example.com', sub: '@alex' },
					)
					await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Status 2',
						{ email: 'alex@example.com', sub: '@alex' },
					)
					await createStatus(dbContext, notify)(
						ulid(),
						'$acme#teamstatus',
						'Status 3',
						{ email: 'alex@example.com', sub: '@alex' },
					)

					const { status } = (await listStatus(dbContext)('$acme#teamstatus', {
						email: 'alex@example.com',
						sub: '@alex',
					})) as {
						status: PersistedStatus[]
					}

					assert.equal(status?.length, 5)

					// Newest status first
					assert.equal(status?.[0]?.message, 'Status 3')
				})

				it('allows only organization members to list status', async () => {
					const { error } = (await listStatus(dbContext)('$acme#teamstatus', {
						email: 'blake@example.com',
						sub: '@blake',
					})) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '$acme' are allowed to list status.`,
					)
				})
			})

			describe('reactions', async () => {
				const projectId = `#test-${ulid()}`
				let statusId: string
				it('allows authors to attach a reaction', async () => {
					const events: CoreEvent[] = []
					on(CoreEventType.REACTION_CREATED, (e) => events.push(e))

					await createProject(dbContext, notify)(
						{ id: `$acme${projectId}` },
						{ email: 'alex@example.com', sub: '@alex' },
					)

					const { status } = (await createStatus(dbContext, notify)(
						ulid(),
						`$acme${projectId}`,
						`I've released a new version!`,
						{ email: 'alex@example.com', sub: '@alex' },
					)) as { status: PersistedStatus }

					statusId = status.id

					const id = ulid()

					const { reaction } = (await createReaction(dbContext, notify)(
						id,
						statusId,
						newVersionRelease,
						{ email: 'alex@example.com', sub: '@alex' },
					)) as { reaction: PersistedReaction }

					check(reaction).is(
						objectMatching({
							status: statusId,
							id,
							...newVersionRelease,
						}),
					)
					check(events[0]).is(
						objectMatching({
							type: CoreEventType.REACTION_CREATED,
							status: statusId,
							author: '@alex',
							id,
							...newVersionRelease,
						}),
					)
				})

				it('allows project members to attach a reaction', async () => {
					const { invitation } = (await inviteToProject(dbContext, notify)(
						'@blake',
						`$acme${projectId}`,
						{ email: 'alex@example.com', sub: '@alex' },
					)) as { invitation: PersistedInvitation }
					await acceptProjectInvitation(dbContext, notify)(invitation.id, {
						email: 'blake@example.com',
						sub: '@blake',
					})

					const { error } = (await createReaction(dbContext, notify)(
						ulid(),
						statusId,
						thumbsUp,
						{ email: 'blake@example.com', sub: '@blake' },
					)) as { error: ProblemDetail }

					assert.equal(error, undefined)
				})

				it('returns reactions with the status', async () => {
					const { status } = (await listStatus(dbContext)(`$acme${projectId}`, {
						email: 'alex@example.com',
						sub: '@alex',
					})) as { status: PersistedStatus[] }

					console.log(status[0]?.reactions[0])

					check(status[0]?.reactions[0]).is(
						objectMatching({
							author: '@alex',
							id: aUlid(),
							...newVersionRelease,
						}),
					)

					check(status[0]?.reactions[1]).is(
						objectMatching({
							author: '@blake',
							id: aUlid(),
							...thumbsUp,
						}),
					)
				})
			})
		})
	})
})
