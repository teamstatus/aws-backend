import assert from 'node:assert/strict'
import { before, describe, test as it } from 'node:test'
import {
	aString,
	arrayContaining,
	check,
	definedValue,
	objectMatching,
	stringMatching,
	undefinedValue,
} from 'tsmatchers'
import { ulid } from 'ulid'
import type { CoreEvent } from './CoreEvent.js'
import { CoreEventType } from './CoreEventType.js'
import type { ProblemDetail } from './ProblemDetail.js'
import { Role } from './Role.js'
import { type EmailAuthContext, type UserAuthContext } from './auth.js'
import { notifier } from './notifier.js'
import type { DbContext } from './persistence/DbContext.js'
import { acceptProjectInvitation } from './persistence/acceptProjectInvitation.js'
import {
	createOrganization,
	type Organization,
} from './persistence/createOrganization.js'
import { createProject, type Project } from './persistence/createProject.js'
import { createReaction, type Reaction } from './persistence/createReaction.js'
import { createStatus, type Status } from './persistence/createStatus.js'
import { createUser } from './persistence/createUser.js'
import { deleteReaction } from './persistence/deleteReaction.js'
import { deleteStatus } from './persistence/deleteStatus.js'
import {
	emailLoginRequest,
	type EmailLoginRequest,
} from './persistence/emailLoginRequest.js'
import { emailPINLogin } from './persistence/emailPINLogin.js'
import type {
	Invitation,
	MemberInvitedEvent,
} from './persistence/inviteToProject.js'
import { inviteToProject } from './persistence/inviteToProject.js'
import { listOrganizationProjects } from './persistence/listOrganizationProjects.js'
import { listOrganizations } from './persistence/listOrganizations.js'
import { listProjects } from './persistence/listProjects.js'
import { listStatus } from './persistence/listStatus.js'
import { updateStatus } from './persistence/updateStatus.js'
import { aUlid } from './test/aUlid.js'
import { createTestDb } from './test/createTestDb.js'
import { isNotAnError } from './test/isNotAnError.js'
import { testDb } from './test/testDb.js'
import { listInvitations } from './persistence/listInvitations.js'
import { eventually } from './test/eventually.js'
import { updateOrganization } from './persistence/updateOrganization.js'
import { getStatus } from './persistence/getStatus.js'
import { updateProject } from './persistence/updateProject.js'
import { deleteProject } from './persistence/deleteProject.js'
import type { ProjectMember } from './persistence/createProjectMember.js'
import { listProjectMembers } from './persistence/listProjectMembers.js'
import { randomOrganization, randomUser } from './randomEntities.js'
import { ensureUserIsMember } from './test/ensureUserIsMember.js'
import { storeEvent } from './test/storeEvent.js'

describe('core', async () => {
	const { TableName, db } = testDb()

	const dbContext: DbContext = {
		db,
		TableName,
	}

	const { on, notify } = notifier()

	before(createTestDb(dbContext))

	const acme = randomOrganization()
	const alex = randomUser()
	const blake = randomUser()
	const cameron = randomUser()
	const emerson = randomUser()

	await describe('user management', async () => {
		await describe('allows users to log-in with their email', async () => {
			let pin: string
			await it('generates a login request', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.EMAIL_LOGIN_REQUESTED, storeEvent(events))
				const { loginRequest, pin: p } = (await emailLoginRequest(
					dbContext,
					notify,
				)(alex)) as { loginRequest: EmailLoginRequest; pin: string }
				check(loginRequest).is(
					objectMatching({
						email: alex.email,
					}),
				)
				check(events).is(
					arrayContaining(
						objectMatching({
							type: CoreEventType.EMAIL_LOGIN_REQUESTED,
							email: alex.email,
						}),
					),
				)
				check(p).is(stringMatching(/^[0-9]{8}$/))
				pin = p
			})

			await it('prevents spamming log-in requests', async () => {
				const { error } = (await emailLoginRequest(
					dbContext,
					notify,
				)({
					email: alex.email,
				})) as { error: ProblemDetail }

				check(error).is(definedValue)
			})

			await it('logs a user in using a PIN', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.EMAIL_LOGIN_PIN_SUCCESS, storeEvent(events))
				const { authContext } = (await emailPINLogin(
					dbContext,
					notify,
				)({
					email: alex.email,
					pin,
				})) as { authContext: EmailAuthContext }

				check(events).is(
					arrayContaining(
						objectMatching({
							type: CoreEventType.EMAIL_LOGIN_PIN_SUCCESS,
							email: alex.email,
						}),
					),
				)

				check(authContext).is(
					objectMatching({
						email: alex.email,
						sub: undefinedValue,
					}),
				)
			})

			await it('prevents re-using PINs', async () => {
				const { error } = (await emailPINLogin(
					dbContext,
					notify,
				)({
					email: alex.email,
					pin,
				})) as { error: ProblemDetail }

				check(error).is(definedValue)
			})

			await it('allows users to claim a user ID', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.USER_CREATED, storeEvent(events))
				isNotAnError(
					await createUser(
						dbContext,
						notify,
					)({
						id: alex.sub,
						authContext: { email: alex.email },
					}),
				)
				check(events).is(
					arrayContaining(
						objectMatching({
							type: CoreEventType.USER_CREATED,
							id: alex.sub,
							email: alex.email,
						}),
					),
				)
			})

			await it(`adds the user's ID to the token after they have claimed a user ID`, async () => {
				const { pin } = (await emailLoginRequest(
					dbContext,
					notify,
				)({
					email: alex.email,
				})) as { loginRequest: EmailLoginRequest; pin: string }
				const { authContext } = (await emailPINLogin(
					dbContext,
					notify,
				)({
					email: alex.email,
					pin,
				})) as { authContext: UserAuthContext }
				check(authContext).is(objectMatching(alex))
			})
		})
	})

	await describe('organizations', async () => {
		await it('can create a new organization', async () => {
			const events: CoreEvent[] = []
			on(CoreEventType.ORGANIZATION_CREATED, storeEvent(events))
			isNotAnError(
				await createOrganization(dbContext, notify)(
					{ id: acme.id, name: 'ACME Inc.' },
					alex,
				),
			)
			check(events).is(
				arrayContaining(
					objectMatching({
						type: CoreEventType.ORGANIZATION_CREATED,
						id: acme.id,
						name: 'ACME Inc.',
						owner: alex.sub,
					}),
				),
			)
		})

		await it('ensures that organizations are unique', async () => {
			const { error } = (await createOrganization(dbContext, notify)(
				{ id: acme.id, name: 'ACME Inc.' },
				alex,
			)) as { error: ProblemDetail }

			assert.equal(error?.title, `Organization '${acme.id}' already exists.`)
		})

		await it('can list organizations for a user', async () => {
			const { organizations } = (await listOrganizations(dbContext)(alex)) as {
				organizations: Organization[]
			}
			check(organizations?.[0]).is(
				objectMatching({
					id: acme.id,
				}),
			)
		})

		await describe('update', async () => {
			await it('allows organizations to be updated by an owner', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.ORGANIZATION_UPDATED, storeEvent(events))
				isNotAnError(
					await updateOrganization(dbContext, notify)(
						acme.id,
						{ name: 'ACME Inc!' },
						1,
						alex,
					),
				)

				check(events).is(
					arrayContaining(
						objectMatching({
							type: CoreEventType.ORGANIZATION_UPDATED,
							id: acme.id,
							name: 'ACME Inc!',
							version: 2,
						}),
					),
				)
			})
		})
	})

	await describe('projects', async () => {
		await it('can create a new project', async () => {
			const events: CoreEvent[] = []
			on(CoreEventType.PROJECT_CREATED, storeEvent(events))
			on(CoreEventType.PROJECT_MEMBER_CREATED, storeEvent(events))
			isNotAnError(
				await createProject(dbContext, notify)(
					{ id: `${acme.id}#teamstatus`, name: 'Teamstatus.' },
					alex,
				),
			)
			check(events).is(
				arrayContaining(
					objectMatching({
						type: CoreEventType.PROJECT_CREATED,
						id: `${acme.id}#teamstatus`,
						name: 'Teamstatus.',
						version: 1,
					}),
				),
			)
			check(events).is(
				arrayContaining(
					objectMatching({
						type: CoreEventType.PROJECT_MEMBER_CREATED,
						project: `${acme.id}#teamstatus`,
						user: alex.sub,
					}),
				),
			)
		})

		await describe('update', async () => {
			await it('allows projects to be updated by an owner', async () => {
				const events: CoreEvent[] = []
				on(CoreEventType.PROJECT_UPDATED, storeEvent(events))
				isNotAnError(
					await updateProject(dbContext, notify)(
						`${acme.id}#teamstatus`,
						{ name: 'Teamstatus' },
						1,
						alex,
					),
				)

				check(events).is(
					arrayContaining(
						objectMatching({
							type: CoreEventType.PROJECT_UPDATED,
							id: `${acme.id}#teamstatus`,
							name: 'Teamstatus',
							version: 2,
						}),
					),
				)
			})
		})

		await it('ensures that projects are unique', async () => {
			const res = (await createProject(dbContext, notify)(
				{ id: `${acme.id}#teamstatus`, name: 'Teamstatus' },
				alex,
			)) as { error: ProblemDetail }
			assert.equal(
				res.error?.title,
				`Project '${acme.id}#teamstatus' already exists.`,
			)
		})

		await it('allows owners to delete projects', async () => {
			const events: CoreEvent[] = []
			on(CoreEventType.PROJECT_DELETED, storeEvent(events))
			isNotAnError(
				await createProject(dbContext, notify)(
					{
						id: `${acme.id}#teamstatus-to-be-deleted-by-owner`,
						name: 'Teamstatus',
					},
					alex,
				),
			)

			isNotAnError(
				await deleteProject(dbContext, notify)(
					`${acme.id}#teamstatus-to-be-deleted-by-owner`,
					1,
					alex,
				),
			)

			check(events).is(
				arrayContaining(
					objectMatching({
						type: CoreEventType.PROJECT_DELETED,
						id: `${acme.id}#teamstatus-to-be-deleted-by-owner`,
					}),
				),
			)
		})

		await it('can list projects for an organization', async () => {
			const { projects } = (await listOrganizationProjects(dbContext)(
				acme.id,
				alex,
			)) as { projects: Project[] }
			check(projects?.[0]).is(
				objectMatching({
					id: `${acme.id}#teamstatus`,
					name: 'Teamstatus',
				}),
			)
		})

		await describe('member', async () => {
			await it('allows project owners to invite other users as members to a project', async () => {
				// Users have to exist to be invited
				await createUser(
					dbContext,
					notify,
				)({
					id: cameron.sub,
					authContext: cameron,
				})

				const events: CoreEvent[] = []
				on(CoreEventType.PROJECT_MEMBER_INVITED, async (e) =>
					events.push(e as MemberInvitedEvent),
				)

				isNotAnError(
					await inviteToProject(dbContext, notify)(
						{
							invitedUserId: cameron.sub,
							projectId: `${acme.id}#teamstatus`,
							role: Role.MEMBER,
						},
						alex,
					),
				)
				check(events).is(
					arrayContaining(
						objectMatching({
							type: CoreEventType.PROJECT_MEMBER_INVITED,
							project: `${acme.id}#teamstatus`,
							invitee: cameron.sub,
							inviter: alex.sub,
							role: Role.MEMBER,
						}),
					),
				)
			})

			await it('should not allow to invite non-existing users', async () => {
				const { error } = (await inviteToProject(dbContext, notify)(
					{
						invitedUserId: '@nobody',
						projectId: `${acme.id}#teamstatus`,
						role: Role.MEMBER,
					},
					alex,
				)) as { error: ProblemDetail }
				assert.equal(error?.title, `User @nobody does not exist.`)
			})

			await describe('invited member', async () => {
				await it('should not allow an uninvited user to post a status to a project', async () => {
					const { error } = (await createStatus(dbContext, notify)(
						{
							id: ulid(),
							projectId: `${acme.id}#teamstatus`,
							message: 'Should not work',
						},
						cameron,
					)) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '${acme.id}#teamstatus' are allowed to create status.`,
					)
				})

				await it('should list open invites for a user', async () => {
					const { invitations } = (await listInvitations(dbContext)(
						cameron,
					)) as { invitations: Invitation[] }
					assert.deepEqual(invitations, [
						{
							id: `${acme.id}#teamstatus${cameron.sub}`,
							role: Role.MEMBER,
							inviter: alex.sub,
						},
					])
				})

				await it('allows users to accept invitations', async () => {
					const { error } = (await acceptProjectInvitation(dbContext, notify)(
						`${acme.id}#teamstatus`,
						cameron,
					)) as { error: ProblemDetail }
					assert.equal(error, undefined)
				})

				await it('should allow user after accepting their invitation to post a status to a project', async () => {
					const { error } = (await createStatus(dbContext, notify)(
						{
							id: ulid(),
							projectId: `${acme.id}#teamstatus`,
							message: 'Should work now!',
						},
						cameron,
					)) as { error: ProblemDetail }
					assert.equal(error, undefined)
				})
			})

			await it('allows owners to list project members', async () => {
				const { members } = (await listProjectMembers(dbContext)(
					`${acme.id}#teamstatus`,
					alex,
				)) as { members: ProjectMember[] }
				check(members).is(
					arrayContaining(
						objectMatching({
							project: `${acme.id}#teamstatus`,
							user: cameron.sub,
							role: Role.MEMBER,
						}),
					),
				)
			})
		})

		await describe('watcher', async () => {
			await it('allows project owners to invite other users as watchers to a project', async () => {
				// Users have to exist to be invited
				await createUser(
					dbContext,
					notify,
				)({
					id: emerson.sub,
					authContext: emerson,
				})

				const events: CoreEvent[] = []
				on(CoreEventType.PROJECT_MEMBER_INVITED, async (e) =>
					events.push(e as MemberInvitedEvent),
				)

				isNotAnError(
					await inviteToProject(dbContext, notify)(
						{
							invitedUserId: emerson.sub,
							projectId: `${acme.id}#teamstatus`,
							role: Role.WATCHER,
						},
						alex,
					),
				)
				check(events).is(
					arrayContaining(
						objectMatching({
							type: CoreEventType.PROJECT_MEMBER_INVITED,
							project: `${acme.id}#teamstatus`,
							invitee: emerson.sub,
							inviter: alex.sub,
							role: Role.WATCHER,
						}),
					),
				)
			})

			await it('should list open invites for a user', async () => {
				const { invitations } = (await listInvitations(dbContext)(emerson)) as {
					invitations: Invitation[]
				}
				assert.deepEqual(invitations, [
					{
						id: `${acme.id}#teamstatus${emerson.sub}`,
						role: Role.WATCHER,
						inviter: alex.sub,
					},
				])
			})

			await it('allows users to accept invitations', async () => {
				const { error } = (await acceptProjectInvitation(dbContext, notify)(
					`${acme.id}#teamstatus`,
					emerson,
				)) as { error: ProblemDetail }
				assert.equal(error, undefined)
			})

			await it('should not allow watchers to post a status to a project', async () => {
				const { error } = (await createStatus(dbContext, notify)(
					{
						id: ulid(),
						projectId: `${acme.id}#teamstatus`,
						message: 'Should not work',
					},
					emerson,
				)) as { error: ProblemDetail }
				assert.equal(
					error?.title,
					`Only members of '${acme.id}#teamstatus' are allowed to create status.`,
				)
			})

			await it('should allow watchers read status of a project', async () => {
				eventually(async () => {
					const { status } = (await listStatus(dbContext)(
						{ projectId: `${acme.id}#teamstatus` },
						emerson,
					)) as { status: Status[] }
					check(status).is(
						arrayContaining(
							objectMatching({
								id: aString,
								message:
									'Implemented ability to persist status updates for projects.',
								author: alex.sub,
								project: `${acme.id}#teamstatus`,
							}),
						),
					)
				})
			})
		})

		await describe('status', async () => {
			await describe('create', async () => {
				await it('can post a new status update', async () => {
					const events: CoreEvent[] = []
					on(CoreEventType.STATUS_CREATED, storeEvent(events))

					const id = ulid()
					isNotAnError(
						await createStatus(dbContext, notify)(
							{
								id: id,
								projectId: `${acme.id}#teamstatus`,
								message:
									'Implemented ability to persist status updates for projects.',
							},
							alex,
						),
					)
					check(events).is(
						arrayContaining(
							objectMatching({
								type: CoreEventType.STATUS_CREATED,
								project: `${acme.id}#teamstatus`,
								message:
									'Implemented ability to persist status updates for projects.',
								author: alex.sub,
								id,
							}),
						),
					)
				})

				await it('allows posting status only for organization members', async () => {
					const { error } = (await createStatus(dbContext, notify)(
						{
							id: ulid(),
							projectId: `${acme.id}#teamstatus`,
							message: `I am not a member of the ${acme.id} organization, so I should not be allowed to create a status.`,
						},
						blake,
					)) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '${acme.id}#teamstatus' are allowed to create status.`,
					)
				})
			})

			await describe('update', async () => {
				const statusId = ulid()
				await it('allows status to be updated by the author', async () => {
					// Create the status
					isNotAnError(
						await createStatus(dbContext, notify)(
							{
								id: statusId,
								projectId: `${acme.id}#teamstatus`,
								message: 'Status with an typo',
							},
							alex,
						),
					)

					// Updated
					isNotAnError(
						await updateStatus(dbContext, notify)(
							statusId,
							'Status with a typo',
							1,
							alex,
						),
					)
					// Fetch
					const { status: statusList } = (await listStatus(dbContext)(
						{ projectId: `${acme.id}#teamstatus` },
						alex,
					)) as {
						status: Status[]
					}
					check(statusList).is(
						arrayContaining(
							objectMatching({
								message: 'Status with a typo',
								version: 2,
							}),
						),
					)
				})

				await it('allows status to be deleted by the author', async () => {
					const { error } = (await deleteStatus(dbContext, notify)(
						statusId,
						2,
						alex,
					)) as { error: ProblemDetail }

					assert.equal(error, undefined)
				})
			})

			await describe('list', async () => {
				await it('can list status for a project', async () => {
					const { status } = (await listStatus(dbContext)(
						{ projectId: `${acme.id}#teamstatus` },
						alex,
					)) as { status: Status[] }
					check(status?.[0]).is(
						objectMatching({
							id: aString,
							message:
								'Implemented ability to persist status updates for projects.',
							author: alex.sub,
							project: `${acme.id}#teamstatus`,
						}),
					)
				})

				await it('sorts status by creation time', async () => {
					await createStatus(dbContext, notify)(
						{
							id: ulid(),
							projectId: `${acme.id}#teamstatus`,
							message: 'Status 1',
						},
						alex,
					)
					await createStatus(dbContext, notify)(
						{
							id: ulid(),
							projectId: `${acme.id}#teamstatus`,
							message: 'Status 2',
						},
						alex,
					)
					await createStatus(dbContext, notify)(
						{
							id: ulid(),
							projectId: `${acme.id}#teamstatus`,
							message: 'Status 3',
						},
						alex,
					)

					const { status } = (await listStatus(dbContext)(
						{ projectId: `${acme.id}#teamstatus` },
						alex,
					)) as {
						status: Status[]
					}

					assert.equal(status?.length, 5)

					// Newest status first
					assert.equal(status?.[0]?.message, 'Status 3')
				})

				await it('allows only organization members to list status', async () => {
					const { error } = (await listStatus(dbContext)(
						{ projectId: `${acme.id}#teamstatus` },
						blake,
					)) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '${acme.id}#teamstatus' are allowed to list status.`,
					)
				})

				await it('paginates', async () => {
					const projectId = ulid()
					const user = randomUser()

					const org = randomOrganization()

					isNotAnError(
						await createOrganization(dbContext, notify)(
							{ id: org.id, name: 'Pagination test5' },
							user,
						),
					)

					isNotAnError(
						await createProject(dbContext, notify)(
							{
								id: `${org.id}#test-${projectId}`,
								name: `Project ${projectId}`,
							},
							user,
						),
					)

					await ensureUserIsMember(
						dbContext,
						user,
						`${org.id}#test-${projectId}`,
					)

					for (let i = 0; i < 30; i++) {
						isNotAnError(
							await createStatus(dbContext, notify)(
								{
									id: ulid(),
									projectId: `${org.id}#test-${projectId}`,
									message: `Status for pagination ${i}`,
								},
								user,
							),
						)
					}

					const { status, nextStartKey } = (await listStatus(dbContext)(
						{
							projectId: `${org.id}#test-${projectId}`,
						},
						user,
					)) as { status: Status[]; nextStartKey: string }

					check(status.length).is(25)
					check(nextStartKey).is(aString)

					// Fetch next page

					const { status: restStatus, nextStartKey: lastStartKey } =
						(await listStatus(dbContext)(
							{
								projectId: `${org.id}#test-${projectId}`,
								startKey: nextStartKey,
							},
							user,
						)) as { status: Status[]; nextStartKey: string }

					check(restStatus.length).is(5)
					check(lastStartKey).is(undefinedValue)
				})
			})

			await describe('get', async () => {
				const statusId = ulid()
				await it('allows getting individual status', async () => {
					// useful if it is an older status, or in case we need the latest version

					isNotAnError(
						await createStatus(dbContext, notify)(
							{
								id: statusId,
								projectId: `${acme.id}#teamstatus`,
								message: `A new status!`,
							},
							alex,
						),
					)
					const { status } = isNotAnError(
						await getStatus(dbContext)(
							{
								statusId,
								projectId: `${acme.id}#teamstatus`,
							},
							alex,
						),
					)
					check(status).is(
						objectMatching({
							id: aString,
							message: `A new status!`,
							author: alex.sub,
							project: `${acme.id}#teamstatus`,
						}),
					)
				})
				await it('allows only organization members to get status', async () => {
					const { error } = (await getStatus(dbContext)(
						{
							statusId,
							projectId: `${acme.id}#teamstatus`,
						},
						blake,
					)) as { error: ProblemDetail }
					assert.equal(
						error?.title,
						`Only members of '${acme.id}#teamstatus' are allowed to list status.`,
					)
				})
			})

			await describe('reactions', async () => {
				// Reactions can have special roles
				enum ReactionRole {
					// A significant thing happened, makes the status stand out from others in the list of status
					SIGNIFICANT = 'SIGNIFICANT',
					// The status needs to be discussed during the next sync meeting, this will collect this status in a separate list of open questions during the next sync meeting
					QUESTION = 'QUESTION',
				}

				const newVersionRelease: Reaction = {
					description: 'A new version was released',
					emoji: '🚀',
					role: ReactionRole.SIGNIFICANT,
				}

				const thumbsUp = {
					emoji: '👍',
				}

				const projectId = `#test-${ulid()}`
				const statusId = ulid()
				const reactionId = ulid()

				await it('allows authors to attach a reaction', async () => {
					const events: CoreEvent[] = []
					on(CoreEventType.REACTION_CREATED, storeEvent(events))

					await createProject(dbContext, notify)(
						{ id: `${acme.id}${projectId}`, name: `Project ${projectId}` },
						alex,
					)

					isNotAnError(
						await createStatus(dbContext, notify)(
							{
								id: statusId,
								projectId: `${acme.id}${projectId}`,
								message: `I've released a new version!`,
							},
							alex,
						),
					)

					isNotAnError(
						await createReaction(dbContext, notify)(
							{
								id: reactionId,
								status: statusId,
								...newVersionRelease,
							},
							alex,
						),
					)

					check(events).is(
						arrayContaining(
							objectMatching({
								type: CoreEventType.REACTION_CREATED,
								status: statusId,
								author: alex.sub,
								id: reactionId,
								...newVersionRelease,
							}),
						),
					)
				})

				await it('allows project members to attach a reaction', async () => {
					// Users have to exist to be invited
					await createUser(
						dbContext,
						notify,
					)({
						id: blake.sub,
						authContext: blake,
					})

					isNotAnError(
						await inviteToProject(dbContext, notify)(
							{
								invitedUserId: blake.sub,
								projectId: `${acme.id}${projectId}`,
								role: Role.MEMBER,
							},
							alex,
						),
					)

					await acceptProjectInvitation(dbContext, notify)(
						`${acme.id}${projectId}`,
						blake,
					)

					const { error } = (await createReaction(dbContext, notify)(
						{
							id: ulid(),
							status: statusId,
							...thumbsUp,
						},
						blake,
					)) as { error: ProblemDetail }

					assert.equal(error, undefined)
				})

				await it('returns reactions with the status', async () => {
					const { status } = (await listStatus(dbContext)(
						{ projectId: `${acme.id}${projectId}` },
						alex,
					)) as { status: Status[] }

					check(status[0]?.reactions[0]).is(
						objectMatching({
							author: alex.sub,
							id: aUlid(),
							...newVersionRelease,
						}),
					)

					check(status[0]?.reactions[1]).is(
						objectMatching({
							author: blake.sub,
							id: aUlid(),
							...thumbsUp,
						}),
					)
				})

				await it('allows reactions to be deleted by the author', async () => {
					const { error } = (await deleteReaction(dbContext, notify)(
						reactionId,
						alex,
					)) as { error: ProblemDetail }

					assert.equal(error, undefined)

					const { status } = (await listStatus(dbContext)(
						{ projectId: `${acme.id}${projectId}` },
						alex,
					)) as { status: Status[] }

					assert.equal(
						status.find(({ id }) => id === statusId)?.reactions.length,
						1,
					)
				})
			})
		})

		await describe('projects', async () => {
			await it('can list projects for a user', async () => {
				const { projects } = (await listProjects(dbContext)(alex)) as {
					projects: Project[]
				}
				check(projects).is(
					arrayContaining(
						objectMatching({
							id: `${acme.id}#teamstatus`,
							name: 'Teamstatus',
							version: 2,
						}),
					),
				)
			})

			await it('allows project members to list status', async () => {
				const { status } = (await listStatus(dbContext)(
					{ projectId: `${acme.id}#teamstatus` },
					cameron,
				)) as { status: Status[] }
				assert.equal(status.length, 6)
			})
		})
	})
})
