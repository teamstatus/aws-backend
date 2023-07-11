/**
 * @see https://en.wikipedia.org/wiki/List_of_HTTP_status_codes
 */

export enum StatusCode {
	/**
	 * Standard response for successful HTTP requests. The actual response will depend on the request method used. In a GET request, the response will contain an entity corresponding to the requested resource. In a POST request, the response will contain an entity describing or containing the result of the action.
	 */
	OK = 200,
	/**
	 * The request has been fulfilled, resulting in the creation of a new resource.
	 */
	CREATED = 201,
	/**
	 * The request has been accepted for processing, but the processing has not been completed. The request might or might not be eventually acted upon, and may be disallowed when processing occurs.
	 */
	ACCEPTED = 202,
	/**
	 * The server cannot or will not process the request due to an apparent client error
	 * (e.g., malformed request syntax, too large size, invalid request message framing, or deceptive request routing).
	 */
	BAD_REQUEST = 400,
	/**
	 * The request contained valid data and was understood by the server, but
	 * the server is refusing action. This may be due to the user not having the
	 * necessary permissions for a resource or needing an account of some sort,
	 * or attempting a prohibited action (e.g. creating a duplicate record where
	 * only one is allowed).
	 */
	FORBIDDEN = 403,
	/**
	 * The requested resource could not be found but may be available in the future.
	 * Subsequent requests by the client are permissible.
	 */
	NOT_FOUND = 404,
	/**
	 * Indicates that the request could not be processed because of conflict in the request,
	 * such as an edit conflict between multiple simultaneous updates.
	 */
	CONFLICT = 409,
	/**
	 * A generic error message, given when an unexpected condition was encountered and no more specific message is suitable.
	 */
	INTERNAL_SERVER_ERROR = 500,
}
