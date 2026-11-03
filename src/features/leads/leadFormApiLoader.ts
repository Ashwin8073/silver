import type {
    LeadFormConfigLoader,
} from './leadFormAdapter'

/**
 * D-GATE Silver CRM
 * Authenticated Lead Form API Loader
 *
 * No API endpoint or credentials are hardcoded.
 * The calling application supplies trusted configuration.
 *
 * Backend responsibilities:
 * - Authenticate the request
 * - Identify the active company
 * - Enforce permissions and company isolation
 * - Return authorized form configuration
 */

export type LeadFormApiAuth =
    | {
          readonly mode: 'bearer'
          readonly getAccessToken: (
              signal: AbortSignal
          ) =>
              | string
              | null
              | Promise<string | null>
      }
    | {
          readonly mode: 'cookie'
          readonly credentials: 'same-origin' | 'include'
      }

export interface LeadFormApiLoaderOptions {
    readonly endpoint: string
    readonly auth: LeadFormApiAuth
    readonly fetchImpl?: typeof fetch
}

/**
 * Creates a loader compatible with leadFormAdapter.ts.
 *
 * The endpoint must come from trusted application
 * configuration, never directly from user input.
 */
export function createLeadFormApiLoader(
    options: LeadFormApiLoaderOptions
): LeadFormConfigLoader {
    const endpoint = options.endpoint.trim()

    if (!endpoint) {
        throw new Error(
            'Lead form configuration endpoint is required.'
        )
    }

    if (
        /^[a-z][a-z0-9+.-]*:/i.test(endpoint) &&
        !/^https?:\/\//i.test(endpoint)
    ) {
        throw new Error(
            'Lead form endpoint must use HTTP or HTTPS.'
        )
    }

    return async (signal: AbortSignal): Promise<unknown> => {
        if (signal.aborted) {
            throw new DOMException(
                'Request cancelled.',
                'AbortError'
            )
        }

        const headers = new Headers({
            Accept: 'application/json',
        })

        let credentials: RequestCredentials = 'omit'

        if (options.auth.mode === 'bearer') {
            const token =
                await options.auth.getAccessToken(signal)

            if (signal.aborted) {
                throw new DOMException(
                    'Request cancelled.',
                    'AbortError'
                )
            }

            if (!token || !token.trim()) {
                throw new Error(
                    'An authenticated session is required.'
                )
            }

            headers.set(
                'Authorization',
                `Bearer ${token.trim()}`
            )
        } else {
            credentials = options.auth.credentials
        }

        const request = options.fetchImpl ?? fetch

        const response = await request(endpoint, {
            method: 'GET',
            headers,
            credentials,
            signal,
            cache: 'no-store',
            redirect: 'error',
        })

        if (signal.aborted) {
            throw new DOMException(
                'Request cancelled.',
                'AbortError'
            )
        }

        if (!response.ok) {
            throw new Error(
                'Lead form configuration request failed.'
            )
        }

        const contentType =
            response.headers.get('content-type') ?? ''

        if (
            !contentType.includes('application/json') &&
            !contentType.includes('+json')
        ) {
            throw new Error(
                'Unexpected configuration response format.'
            )
        }

        const data: unknown = await response.json()

        if (signal.aborted) {
            throw new DOMException(
                'Request cancelled.',
                'AbortError'
            )
        }

        return data
    }
}