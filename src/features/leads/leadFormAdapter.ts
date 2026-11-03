import {
    parseLeadFormConfig,
    type LeadFormConfiguration,
} from './leadFormConfig'

/**
 * D-GATE Silver CRM
 * Company-specific Lead Form Adapter
 *
 * Frontend only.
 * Backend authentication, authorization,
 * company isolation, and validation
 * remain separate responsibilities.
 */

export type LeadFormConfigLoader = (
    signal: AbortSignal
) => Promise<unknown>

export type LeadFormLoadResult =
    | {
          readonly status: 'ready'
          readonly config: LeadFormConfiguration
      }
    | {
          readonly status: 'invalid'
          readonly errors: readonly string[]
      }
    | {
          readonly status: 'unavailable'
          readonly errors: readonly string[]
      }
    | {
          readonly status: 'cancelled'
          readonly errors: readonly string[]
      }

function cancelledResult(): LeadFormLoadResult {
    return {
        status: 'cancelled',
        errors: ['Configuration request cancelled.'],
    }
}

/**
 * Loads a configured lead form through an
 * injected, authenticated frontend loader.
 *
 * Does not assume an API endpoint or
 * provide fallback demo fields.
 */
export async function loadCompanyLeadFormConfig(
    loader: LeadFormConfigLoader,
    signal: AbortSignal
): Promise<LeadFormLoadResult> {
    if (signal.aborted) {
        return cancelledResult()
    }

    try {
        const response: unknown = await loader(signal)

        if (signal.aborted) {
            return cancelledResult()
        }

        const parsed = parseLeadFormConfig(response)

        // Explicit discriminant comparison for TypeScript.
        if (parsed.ok === false) {
            return {
                status: 'invalid',
                errors: parsed.errors,
            }
        }

        return {
            status: 'ready',
            config: parsed.config,
        }
    } catch {
        if (signal.aborted) {
            return cancelledResult()
        }

        return {
            status: 'unavailable',
            errors: [
                'Lead form configuration is currently unavailable.',
            ],
        }
    }
}