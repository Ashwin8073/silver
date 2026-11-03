import type {
    LeadFieldDefinition,
    LeadFieldOption,
    LeadFieldType,
} from './LeadForm'

/**
 * Frontend configuration contract.
 *
 * The backend remains authoritative for:
 * - Company isolation
 * - System-required fields
 * - Field permissions
 * - Form versions
 * - Validation before persistence
 */

export interface LeadFormConfiguration {
    readonly fields: readonly LeadFieldDefinition[]
}

export type LeadFormConfigResult =
    | {
          readonly ok: true
          readonly config: LeadFormConfiguration
      }
    | {
          readonly ok: false
          readonly errors: readonly string[]
      }

const allowedTypes = new Set<LeadFieldType>([
    'text',
    'email',
    'phone',
    'number',
    'date',
    'textarea',
    'select',
    'checkbox',
])

function isRecord(
    value: unknown
): value is Record<string, unknown> {
    return (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
    )
}

/**
 * Validate untrusted configuration before passing
 * its fields to the reusable LeadForm component.
 *
 * This is presentation-layer validation only.
 */
export function parseLeadFormConfig(
    input: unknown
): LeadFormConfigResult {
    if (!isRecord(input) || !Array.isArray(input.fields)) {
        return {
            ok: false,
            errors: ['Invalid lead form configuration.'],
        }
    }

    const errors: string[] = []
    const ids = new Set<string>()
    const fields: LeadFieldDefinition[] = []

    for (const [index, raw] of input.fields.entries()) {
        const location = `Field ${index + 1}`

        if (!isRecord(raw)) {
            errors.push(`${location}: invalid field definition.`)
            continue
        }

        const errorCount = errors.length

        const id = raw.id
        const label = raw.label
        const type = raw.type

        if (typeof id !== 'string' || !id.trim()) {
            errors.push(`${location}: field ID is required.`)
        } else {
            const normalizedId = id.trim().toLowerCase()

            if (ids.has(normalizedId)) {
                errors.push(`${location}: duplicate field ID.`)
            }

            ids.add(normalizedId)
        }

        if (
            typeof label !== 'string' ||
            !label.trim()
        ) {
            errors.push(`${location}: label is required.`)
        }

        if (
            typeof type !== 'string' ||
            !allowedTypes.has(type as LeadFieldType)
        ) {
            errors.push(`${location}: unsupported field type.`)
        }

        if (
            raw.required !== undefined &&
            typeof raw.required !== 'boolean'
        ) {
            errors.push(`${location}: invalid required flag.`)
        }

        if (
            raw.placeholder !== undefined &&
            typeof raw.placeholder !== 'string'
        ) {
            errors.push(`${location}: invalid placeholder.`)
        }

        if (
            raw.description !== undefined &&
            typeof raw.description !== 'string'
        ) {
            errors.push(`${location}: invalid description.`)
        }

        const options: LeadFieldOption[] = []

        if (type === 'select') {
            if (
                !Array.isArray(raw.options) ||
                raw.options.length === 0
            ) {
                errors.push(
                    `${location}: dropdown options are required.`
                )
            } else {
                const optionValues = new Set<string>()

                for (const option of raw.options) {
                    if (
                        !isRecord(option) ||
                        typeof option.value !== 'string' ||
                        !option.value.trim() ||
                        typeof option.label !== 'string' ||
                        !option.label.trim()
                    ) {
                        errors.push(
                            `${location}: invalid dropdown option.`
                        )
                        continue
                    }

                    if (optionValues.has(option.value)) {
                        errors.push(
                            `${location}: duplicate dropdown option.`
                        )
                        continue
                    }

                    optionValues.add(option.value)

                    options.push({
                        value: option.value,
                        label: option.label,
                    })
                }
            }
        }

        if (errors.length !== errorCount) {
            continue
        }

        fields.push({
            id: id as string,
            label: label as string,
            type: type as LeadFieldType,
            required: raw.required === true,
            placeholder:
                typeof raw.placeholder === 'string'
                    ? raw.placeholder
                    : undefined,
            description:
                typeof raw.description === 'string'
                    ? raw.description
                    : undefined,
            options:
                type === 'select'
                    ? options
                    : undefined,
        })
    }

    if (errors.length > 0) {
        return {
            ok: false,
            errors,
        }
    }

    return {
        ok: true,
        config: {
            fields,
        },
    }
}