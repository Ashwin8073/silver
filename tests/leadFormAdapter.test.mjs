import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'

/*
 * Resolve the TypeScript source import without
 * modifying the production adapter.
 */
registerHooks({
    resolve(specifier, context, nextResolve) {
        if (
            specifier === './leadFormConfig' &&
            context.parentURL?.endsWith('/leadFormAdapter.ts')
        ) {
            return nextResolve('./leadFormConfig.ts', context)
        }

        return nextResolve(specifier, context)
    },
})

const { loadCompanyLeadFormConfig } =
    await import('../src/features/leads/leadFormAdapter.ts')

const validConfig = {
    fields: [
        {
            id: 'customer_name',
            label: 'Customer Name',
            type: 'text',
            required: true,
        },
    ],
}

test('01 - loads valid company configuration', async () => {
    const controller = new AbortController()

    const result = await loadCompanyLeadFormConfig(
        async (signal) => {
            assert.equal(signal, controller.signal)
            return validConfig
        },
        controller.signal
    )

    assert.equal(result.status, 'ready')
    assert.equal(result.config.fields.length, 1)
    assert.equal(result.config.fields[0].required, true)
})

test('02 - accepts configurable dropdown options', async () => {
    const result = await loadCompanyLeadFormConfig(
        async () => ({
            fields: [
                {
                    id: 'source',
                    label: 'Lead Source',
                    type: 'select',
                    options: [
                        { value: 'web', label: 'Website' },
                        { value: 'referral', label: 'Referral' },
                    ],
                },
            ],
        }),
        new AbortController().signal
    )

    assert.equal(result.status, 'ready')
    assert.equal(result.config.fields[0].options.length, 2)
})

test('03 - rejects duplicate field IDs', async () => {
    const result = await loadCompanyLeadFormConfig(
        async () => ({
            fields: [
                { id: 'name', label: 'Name', type: 'text' },
                { id: 'NAME', label: 'Other', type: 'text' },
            ],
        }),
        new AbortController().signal
    )

    assert.equal(result.status, 'invalid')
    assert.ok(
        result.errors.some((message) =>
            message.includes('duplicate field ID')
        )
    )
})

test('04 - rejects unsupported field types', async () => {
    const result = await loadCompanyLeadFormConfig(
        async () => ({
            fields: [
                {
                    id: 'custom',
                    label: 'Custom',
                    type: 'unsupported',
                },
            ],
        }),
        new AbortController().signal
    )

    assert.equal(result.status, 'invalid')
})

test('05 - rejects malformed configuration', async () => {
    const result = await loadCompanyLeadFormConfig(
        async () => ({ wrongProperty: [] }),
        new AbortController().signal
    )

    assert.equal(result.status, 'invalid')
    assert.ok(result.errors.length > 0)
})

test('06 - handles unavailable configuration service', async () => {
    const result = await loadCompanyLeadFormConfig(
        async () => {
            throw new Error('Network unavailable')
        },
        new AbortController().signal
    )

    assert.equal(result.status, 'unavailable')
    assert.ok(result.errors.length > 0)
})

test('07 - does not load after prior cancellation', async () => {
    const controller = new AbortController()
    controller.abort()

    let called = false

    const result = await loadCompanyLeadFormConfig(
        async () => {
            called = true
            return validConfig
        },
        controller.signal
    )

    assert.equal(result.status, 'cancelled')
    assert.equal(called, false)
})

test('08 - handles cancellation during loading', async () => {
    const controller = new AbortController()

    let finishLoading

    const pending = loadCompanyLeadFormConfig(
        () => new Promise((resolve) => {
            finishLoading = resolve
        }),
        controller.signal
    )

    controller.abort()
    finishLoading(validConfig)

    const result = await pending

    assert.equal(result.status, 'cancelled')
})

test('09 - handles cancellation before loader rejection', async () => {
    const controller = new AbortController()

    let rejectLoading

    const pending = loadCompanyLeadFormConfig(
        () => new Promise((resolve, reject) => {
            rejectLoading = reject
        }),
        controller.signal
    )

    controller.abort()
    rejectLoading(new Error('Request cancelled'))

    const result = await pending

    assert.equal(result.status, 'cancelled')
})

test('10 - does not substitute fake data on failure', async () => {
    const result = await loadCompanyLeadFormConfig(
        async () => {
            throw new Error('Service error')
        },
        new AbortController().signal
    )

    assert.equal(result.status, 'unavailable')
    assert.equal('config' in result, false)
})