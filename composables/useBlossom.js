const now = () => Math.floor(Date.now() / 1000)

const textEncoder = new TextEncoder()

const toHex = (buffer) => {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const toBase64Url = (raw) => {
  if (typeof btoa === 'function') {
    return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  return Buffer.from(raw, 'utf8').toString('base64url')
}

const extractDomain = (serverUrl) => {
  const url = new URL(serverUrl)
  return url.hostname.toLowerCase()
}

const computeFileSha256 = async (file) => {
  const fileBuffer = await file.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', fileBuffer)

  return {
    hashHex: toHex(digest),
    size: file.size,
    type: file.type || 'application/octet-stream',
    buffer: fileBuffer
  }
}

const buildUploadHeaders = ({ hashHex, size, type, authHeader }) => {
  const headers = {
    'X-SHA-256': hashHex,
    'X-Content-Length': String(size),
    'X-Content-Type': type
  }

  if (authHeader) {
    headers.Authorization = authHeader
  }

  return headers
}

const createUploadToken = async ({ signer, hashHex, serverDomain }) => {
  const expiration = String(now() + 10 * 60)
  const tokenTemplate = {
    kind: 24242,
    created_at: now(),
    tags: [
      ['t', 'upload'],
      ['expiration', expiration],
      ['x', hashHex],
      ['server', serverDomain]
    ],
    content: 'Authorize blossom upload'
  }

  const signedToken = await signer.signEvent(tokenTemplate)

  return `Nostr ${toBase64Url(JSON.stringify(signedToken))}`
}

export const useBlossom = () => {
  const checkUploadRequirements = async ({ serverUrl, hashHex, size, type, authHeader }) => {
    const response = await fetch(`${serverUrl}/upload`, {
      method: 'HEAD',
      headers: buildUploadHeaders({ hashHex, size, type, authHeader })
    })

    return {
      ok: response.ok,
      status: response.status,
      reason: response.headers.get('X-Reason') || ''
    }
  }

  const uploadFile = async ({ serverUrl, file, signer = null, requireAuth = false }) => {
    const metadata = await computeFileSha256(file)
    const serverDomain = extractDomain(serverUrl)

    let authHeader = null
    if (requireAuth && signer) {
      authHeader = await createUploadToken({ signer, hashHex: metadata.hashHex, serverDomain })
    }

    const requirements = await checkUploadRequirements({
      serverUrl,
      hashHex: metadata.hashHex,
      size: metadata.size,
      type: metadata.type,
      authHeader
    })

    if (!requirements.ok && requirements.status !== 402) {
      throw new Error(requirements.reason || `Upload requirements failed (${requirements.status})`)
    }

    const response = await fetch(`${serverUrl}/upload`, {
      method: 'PUT',
      headers: {
        'Content-Type': metadata.type,
        'Content-Length': String(metadata.size),
        'X-SHA-256': metadata.hashHex,
        ...(authHeader ? { Authorization: authHeader } : {})
      },
      body: metadata.buffer
    })

    if (!response.ok) {
      const reason = response.headers.get('X-Reason') || ''
      throw new Error(reason || `Upload failed (${response.status})`)
    }

    const descriptor = await response.json()

    return {
      serverUrl,
      descriptor,
      hashHex: metadata.hashHex,
      mimeType: metadata.type,
      size: metadata.size
    }
  }

  return {
    computeFileSha256,
    createUploadToken,
    checkUploadRequirements,
    uploadFile
  }
}
