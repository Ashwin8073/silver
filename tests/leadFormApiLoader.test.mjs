import test from 'node:test'
import assert from 'node:assert/strict'

import {
    createLeadFormApiLoader,
} from '../src/features/leads/leadFormApiLoader.ts'

const endpoint = '/api/test/lead-form'

const validConfiguration = {
    fields: [
        {
            id: 'contact_name',
            label: 'Contact Name',
            type: 'text',
            required: true,
        },
    ],
}

function jsonResponse(
    data = validConfiguration,
    status = 200,
    contentType = 'application/json'
) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'content-type': contentType,
        },
    })
}

test('01 - bearer token authorization', async () => {
    const controller = new AbortController()
    let requestChecked = false

    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'bearer',
            getAccessToken: async () => 'test-token',
        },
        fetchImpl: async (url, options) => {
            assert.equal(url, endpoint)
            assert.equal(options.method, 'GET')
            assert.equal(options.credentials, 'omit')
            assert.equal(options.cache, 'no-store')
            assert.equal(options.redirect, 'error')
            assert.equal(options.signal, controller.signal)

            const headers = new Headers(options.headers)

            assert.equal(
                headers.get('authorization'),
                'Bearer test-token'
            )

            assert.equal(
                headers.get('accept'),
                'application/json'
            )

            requestChecked = true

            return jsonResponse()
        },
    })

    const result = await loader(controller.signal)

    assert.equal(requestChecked, true)
    assert.deepEqual(result, validConfiguration)
})

test('02 - asynchronous token retrieval', async () => {
    let tokenRequested = false

    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'bearer',
            getAccessToken: async () => {
                tokenRequested = true
                return 'async-token'
            },
        },
        fetchImpl: async (_url, options) => {
            const headers = new Headers(options.headers)

            assert.equal(
                headers.get('authorization'),
                'Bearer async-token'
            )

            return jsonResponse()
        },
    })

    await loader(new AbortController().signal)

    assert.equal(tokenRequested, true)
})

test('03 - cookie authentication includes credentials', async () => {
    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'cookie',
            credentials: 'include',
        },
        fetchImpl: async (_url, options) => {
            assert.equal(options.credentials, 'include')

            const headers = new Headers(options.headers)

            assert.equal(headers.has('authorization'), false)

            return jsonResponse()
        },
    })

    const result = await loader(
        new AbortController().signal
    )

    assert.deepEqual(result, validConfiguration)
})

test('04 - supports same-origin cookie sessions', async () => {
    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'cookie',
            credentials: 'same-origin',
        },
        fetchImpl: async (_url, options) => {
            assert.equal(
                options.credentials,
                'same-origin'
            )

            return jsonResponse()
        },
    })

    await loader(new AbortController().signal)
})

test('05 - missing token prevents network request', async () => {
    let fetchCalled = false

    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'bearer',
            getAccessToken: async () => null,
        },
        fetchImpl: async () => {
            fetchCalled = true
            return jsonResponse()
        },
    })

    await assert.rejects(
        loader(new AbortController().signal),
        /authenticated session is required/
    )

    assert.equal(fetchCalled, false)
})

test('06 - whitespace token is rejected', async () => {
    let fetchCalled = false

    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'bearer',
            getAccessToken: () => '   ',
        },
        fetchImpl: async () => {
            fetchCalled = true
            return jsonResponse()
        },
    })

    await assert.rejects(
        loader(new AbortController().signal),
        /authenticated session is required/
    )

    assert.equal(fetchCalled, false)
})

test('07 - unauthorized HTTP responses are rejected', async () => {
    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'cookie',
            credentials: 'include',
        },
        fetchImpl: async () =>
            jsonResponse({ error: 'Unauthorized' }, 401),
    })

    await assert.rejects(
        loader(new AbortController().signal),
        /configuration request failed/
    )
})

test('08 - invalid response content type is rejected', async () => {
    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'cookie',
            credentials: 'same-origin',
        },
        fetchImpl: async () =>
            new Response('<html>Error</html>', {
                status: 200,
                headers: {
                    'content-type': 'text/html',
                },
            }),
    })

    await assert.rejects(
        loader(new AbortController().signal),
        /Unexpected configuration response format/
    )
})

test('09 - accepts application problem JSON types', async () => {
    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'cookie',
            credentials: 'same-origin',
        },
        fetchImpl: async () =>
            jsonResponse(
                validConfiguration,
                200,
                'application/vnd.api+json'
            ),
    })

    const result = await loader(
        new AbortController().signal
    )

    assert.deepEqual(result, validConfiguration)
})

test('10 - cancellation before request prevents fetching', async () => {
    const controller = new AbortController()
    controller.abort()

    let fetchCalled = false

    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'cookie',
            credentials: 'include',
        },
        fetchImpl: async () => {
            fetchCalled = true
            return jsonResponse()
        },
    })

    await assert.rejects(
        loader(controller.signal),
        { name: 'AbortError' }
    )

    assert.equal(fetchCalled, false)
})

test('11 - cancellation during token retrieval', async () => {
    const controller = new AbortController()
    let fetchCalled = false

    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'bearer',
            getAccessToken: async () => {
                controller.abort()
                return 'token'
            },
        },
        fetchImpl: async () => {
            fetchCalled = true
            return jsonResponse()
        },
    })

    await assert.rejects(
        loader(controller.signal),
        { name: 'AbortError' }
    )

    assert.equal(fetchCalled, false)
})

test('12 - cancellation after fetch response', async () => {
    const controller = new AbortController()

    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'cookie',
            credentials: 'same-origin',
        },
        fetchImpl: async () => {
            controller.abort()
            return jsonResponse()
        },
    })

    await assert.rejects(
        loader(controller.signal),
        { name: 'AbortError' }
    )
})

test('13 - rejects missing endpoint', () => {
    assert.throws(
        () =>
            createLeadFormApiLoader({
                endpoint: '  ',
                auth: {
                    mode: 'cookie',
                    credentials: 'same-origin',
                },
            }),
        /endpoint is required/
    )
})

test('14 - rejects unsupported URL schemes', () => {
    for (const unsafeEndpoint of [
        'javascript:alert(1)',
        'file:///private/config',
        'data:application/json,test',
    ]) {
        assert.throws(
            () =>
                createLeadFormApiLoader({
                    endpoint: unsafeEndpoint,
                    auth: {
                        mode: 'cookie',
                        credentials: 'same-origin',
                    },
                }),
            /HTTP or HTTPS/
        )
    }
})

test('15 - handles network failure', async () => {
    const loader = createLeadFormApiLoader({
        endpoint,
        auth: {
            mode: 'cookie',
            credentials: 'same-origin',
        },
        fetchImpl: async () => {
            throw new Error('Network unavailable')
        },
    })

    await assert.rejects(
        loader(new AbortController().signal),
        /Network unavailable/
    )
})