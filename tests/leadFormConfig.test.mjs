import test from 'node:test'
import assert from 'node:assert/strict'

import {
    parseLeadFormConfig,
} from '../src/features/leads/leadFormConfig.ts'

function field(id, type = 'text') {
    return {
        id,
        label: id,
        type,
    }
}

function expectInvalid(input, expectedMessage) {
    const result = parseLeadFormConfig(input)

    assert.equal(result.ok, false)

    assert.ok(
        result.errors.some((error) =>
            error.includes(expectedMessage)
        ),
        `Expected error containing: ${expectedMessage}`
    )
}

test('01 - accepts valid custom fields', () => {
    const result = parseLeadFormConfig({
        fields: [
            {
                id: 'customer_name',
                label: 'Customer Name',
                type: 'text',
                required: true,
                placeholder: 'Enter name',
            },
            {
                id: 'industry',
                label: 'Industry',
                type: 'select',
                options: [
                    {
                        value: 'retail',
                        label: 'Retail',
                    },
                    {
                        value: 'technology',
                        label: 'Technology',
                    },
                ],
            },
        ],
    })

    assert.equal(result.ok, true)

    if (result.ok) {
        assert.equal(result.config.fields.length, 2)
        assert.equal(result.config.fields[0].required, true)
        assert.equal(result.config.fields[1].options.length, 2)
    }
})

test('02 - accepts all supported field types', () => {
    const types = [
        'text',
        'email',
        'phone',
        'number',
        'date',
        'textarea',
        'select',
        'checkbox',
    ]

    const fields = types.map((type) => ({
        ...field(`field_${type}`, type),
        ...(type === 'select'
            ? {
                  options: [
                      {
                          value: 'option_a',
                          label: 'Option A',
                      },
                  ],
              }
            : {}),
    }))

    const result = parseLeadFormConfig({ fields })

    assert.equal(result.ok, true)

    if (result.ok) {
        assert.equal(result.config.fields.length, 8)
    }
})

test('03 - accepts an empty configured form', () => {
    const result = parseLeadFormConfig({
        fields: [],
    })

    assert.equal(result.ok, true)

    if (result.ok) {
        assert.deepEqual(result.config.fields, [])
    }
})

test('04 - rejects missing fields array', () => {
    expectInvalid(
        {},
        'Invalid lead form configuration'
    )

    expectInvalid(
        null,
        'Invalid lead form configuration'
    )

    expectInvalid(
        { fields: 'invalid' },
        'Invalid lead form configuration'
    )
})

test('05 - rejects invalid field objects', () => {
    expectInvalid(
        {
            fields: [null],
        },
        'invalid field definition'
    )
})

test('06 - rejects missing field ID', () => {
    expectInvalid(
        {
            fields: [
                {
                    label: 'Customer',
                    type: 'text',
                },
            ],
        },
        'field ID is required'
    )
})

test('07 - rejects missing field label', () => {
    expectInvalid(
        {
            fields: [
                {
                    id: 'customer',
                    type: 'text',
                },
            ],
        },
        'label is required'
    )
})

test('08 - rejects duplicate IDs ignoring case', () => {
    expectInvalid(
        {
            fields: [
                field('Customer'),
                field('customer'),
            ],
        },
        'duplicate field ID'
    )
})

test('09 - rejects unsupported field types', () => {
    expectInvalid(
        {
            fields: [
                field('customer', 'unknown_type'),
            ],
        },
        'unsupported field type'
    )
})

test('10 - rejects invalid required flag', () => {
    expectInvalid(
        {
            fields: [
                {
                    ...field('customer'),
                    required: 'yes',
                },
            ],
        },
        'invalid required flag'
    )
})

test('11 - rejects invalid optional properties', () => {
    expectInvalid(
        {
            fields: [
                {
                    ...field('customer'),
                    placeholder: 123,
                },
            ],
        },
        'invalid placeholder'
    )

    expectInvalid(
        {
            fields: [
                {
                    ...field('customer'),
                    description: false,
                },
            ],
        },
        'invalid description'
    )
})

test('12 - rejects dropdown without options', () => {
    expectInvalid(
        {
            fields: [
                field('lead_source', 'select'),
            ],
        },
        'dropdown options are required'
    )
})

test('13 - rejects duplicate dropdown values', () => {
    expectInvalid(
        {
            fields: [
                {
                    ...field('lead_source', 'select'),
                    options: [
                        {
                            value: 'website',
                            label: 'Website',
                        },
                        {
                            value: 'website',
                            label: 'Website Duplicate',
                        },
                    ],
                },
            ],
        },
        'duplicate dropdown option'
    )
})

test('14 - rejects invalid dropdown options', () => {
    expectInvalid(
        {
            fields: [
                {
                    ...field('lead_source', 'select'),
                    options: [
                        {
                            value: '',
                            label: 'Invalid',
                        },
                    ],
                },
            ],
        },
        'invalid dropdown option'
    )
})

test('15 - preserves optional form metadata', () => {
    const result = parseLeadFormConfig({
        fields: [
            {
                id: 'notes',
                label: 'Notes',
                type: 'textarea',
                required: false,
                placeholder: 'Add notes',
                description: 'Internal sales notes',
            },
        ],
    })

    assert.equal(result.ok, true)

    if (result.ok) {
        const item = result.config.fields[0]

        assert.equal(item.id, 'notes')
        assert.equal(item.required, false)
        assert.equal(item.placeholder, 'Add notes')
        assert.equal(
            item.description,
            'Internal sales notes'
        )
    }
})