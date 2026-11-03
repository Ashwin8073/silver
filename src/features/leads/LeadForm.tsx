import { useState, type FormEvent } from 'react'
import { Save, X } from 'lucide-react'

export type LeadFieldType =
    | 'text'
    | 'email'
    | 'phone'
    | 'number'
    | 'date'
    | 'textarea'
    | 'select'
    | 'checkbox'

export interface LeadFieldOption {
    readonly value: string
    readonly label: string
}

export interface LeadFieldDefinition {
    readonly id: string
    readonly label: string
    readonly type: LeadFieldType
    readonly required?: boolean
    readonly placeholder?: string
    readonly description?: string
    readonly options?: readonly LeadFieldOption[]
}

export type LeadFieldValue = string | number | boolean | null

export type LeadFormValues = Record<string, LeadFieldValue>

export interface LeadFormProps {
    fields: readonly LeadFieldDefinition[]
    initialValues?: Readonly<LeadFormValues>
    onSubmit?: (values: LeadFormValues) => void | Promise<void>
    onCancel?: () => void
    isSubmitting?: boolean
    title?: string
}

export default function LeadForm({
    fields,
    initialValues,
    onSubmit,
    onCancel,
    isSubmitting = false,
    title = 'New Lead',
}: LeadFormProps) {
    const [values, setValues] = useState<
        Record<string, string | boolean>
    >(() => {
        const initial: Record<string, string | boolean> =
            Object.create(null)

        for (const field of fields) {
            const value = initialValues?.[field.id]

            initial[field.id] =
                field.type === 'checkbox'
                    ? value === true
                    : String(value ?? '')
        }

        return initial
    })

    const [errors, setErrors] = useState<Record<string, string>>({})
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)

    const busy = saving || isSubmitting

    function updateValue(id: string, value: string | boolean) {
        setValues((current) => ({
            ...current,
            [id]: value,
        }))

        setErrors((current) => ({
            ...current,
            [id]: '',
        }))

        setSubmitError(null)
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (!onSubmit || busy || fields.length === 0) {
            return
        }

        const nextErrors: Record<string, string> =
            Object.create(null)

        const payload: LeadFormValues =
            Object.create(null)

        for (const field of fields) {
            const rawValue = values[field.id] ?? ''

            if (field.type === 'checkbox') {
                const checked = rawValue === true

                if (field.required && !checked) {
                    nextErrors[field.id] =
                        `${field.label} is required.`
                }

                payload[field.id] = checked
                continue
            }

            const text = String(rawValue).trim()

            if (field.required && text.length === 0) {
                nextErrors[field.id] =
                    `${field.label} is required.`
            }

            if (
                field.type === 'select' &&
                text.length > 0 &&
                !field.options?.some(
                    (option) => option.value === text
                )
            ) {
                nextErrors[field.id] =
                    `Select a valid ${field.label}.`
            }

            if (field.type === 'number' && text.length > 0) {
                const numberValue = Number(text)

                if (!Number.isFinite(numberValue)) {
                    nextErrors[field.id] =
                        `Enter a valid ${field.label}.`
                }

                payload[field.id] =
                    Number.isFinite(numberValue)
                        ? numberValue
                        : null
            } else {
                payload[field.id] = text
            }
        }

        setErrors(nextErrors)

        if (Object.keys(nextErrors).length > 0) {
            return
        }

        setSaving(true)
        setSubmitError(null)

        try {
            await onSubmit(payload)
        } catch {
            setSubmitError(
                'Unable to save the lead. Please try again.'
            )
        } finally {
            setSaving(false)
        }
    }

    return (
        <form
            className="lead-form"
            onSubmit={(event) => {
                void handleSubmit(event)
            }}
        >
            <div className="lead-form-header">
                <div>
                    <h2>{title}</h2>
                    <p>
                        Enter lead information using your
                        company-configured fields.
                    </p>
                </div>

                {onCancel && (
                    <button
                        type="button"
                        className="lead-form-close"
                        aria-label="Close lead form"
                        disabled={busy}
                        onClick={onCancel}
                    >
                        <X size={19} aria-hidden="true" />
                    </button>
                )}
            </div>

            {fields.length === 0 ? (
                <div className="lead-form-empty" role="status">
                    No lead form fields are configured.
                </div>
            ) : (
                <div className="lead-form-grid">
                    {fields.map((field) => {
                        const inputId = `lead-field-${field.id}`
                        const errorId = `${inputId}-error`
                        const error = errors[field.id]

                        return (
                            <div
                                className={`lead-form-field ${
                                    field.type === 'textarea'
                                        ? 'lead-form-full'
                                        : ''
                                }`}
                                key={field.id}
                            >
                                <label htmlFor={inputId}>
                                    {field.label}
                                    {field.required && (
                                        <span aria-hidden="true">
                                            {' '}*
                                        </span>
                                    )}
                                </label>

                                {field.type === 'textarea' ? (
                                    <textarea
                                        id={inputId}
                                        value={String(
                                            values[field.id] ?? ''
                                        )}
                                        placeholder={field.placeholder}
                                        required={field.required}
                                        disabled={busy}
                                        aria-invalid={Boolean(error)}
                                        aria-describedby={
                                            error ? errorId : undefined
                                        }
                                        onChange={(event) =>
                                            updateValue(
                                                field.id,
                                                event.target.value
                                            )
                                        }
                                        rows={4}
                                    />
                                ) : field.type === 'select' ? (
                                    <select
                                        id={inputId}
                                        value={String(
                                            values[field.id] ?? ''
                                        )}
                                        required={field.required}
                                        disabled={
                                            busy ||
                                            !field.options?.length
                                        }
                                        aria-invalid={Boolean(error)}
                                        aria-describedby={
                                            error ? errorId : undefined
                                        }
                                        onChange={(event) =>
                                            updateValue(
                                                field.id,
                                                event.target.value
                                            )
                                        }
                                    >
                                        <option value="">
                                            Select {field.label}
                                        </option>

                                        {field.options?.map((option) => (
                                            <option
                                                key={option.value}
                                                value={option.value}
                                            >
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                ) : field.type === 'checkbox' ? (
                                    <input
                                        id={inputId}
                                        type="checkbox"
                                        checked={
                                            values[field.id] === true
                                        }
                                        required={field.required}
                                        disabled={busy}
                                        aria-invalid={Boolean(error)}
                                        aria-describedby={
                                            error ? errorId : undefined
                                        }
                                        onChange={(event) =>
                                            updateValue(
                                                field.id,
                                                event.target.checked
                                            )
                                        }
                                    />
                                ) : (
                                    <input
                                        id={inputId}
                                        type={
                                            field.type === 'phone'
                                                ? 'tel'
                                                : field.type
                                        }
                                        value={String(
                                            values[field.id] ?? ''
                                        )}
                                        placeholder={field.placeholder}
                                        required={field.required}
                                        disabled={busy}
                                        aria-invalid={Boolean(error)}
                                        aria-describedby={
                                            error ? errorId : undefined
                                        }
                                        onChange={(event) =>
                                            updateValue(
                                                field.id,
                                                event.target.value
                                            )
                                        }
                                    />
                                )}

                                {field.description && (
                                    <small>{field.description}</small>
                                )}

                                {error && (
                                    <small
                                        id={errorId}
                                        className="lead-form-error"
                                        role="alert"
                                    >
                                        {error}
                                    </small>
                                )}
                            </div>
                        )
                    })}
                </div>
            )}

            {submitError && (
                <p className="lead-form-error" role="alert">
                    {submitError}
                </p>
            )}

            <div className="lead-form-actions">
                {onCancel && (
                    <button
                        type="button"
                        className="lead-form-cancel"
                        onClick={onCancel}
                        disabled={busy}
                    >
                        Cancel
                    </button>
                )}

                <button
                    type="submit"
                    className="lead-form-save"
                    disabled={
                        busy ||
                        !onSubmit ||
                        fields.length === 0
                    }
                >
                    <Save size={16} aria-hidden="true" />
                    {busy ? 'Saving...' : 'Save Lead'}
                </button>
            </div>
        </form>
    )
}