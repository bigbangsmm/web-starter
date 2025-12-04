import { createServiceClient, buildPublicUrl, DEFAULT_BUCKET } from '../../../utils/supabaseStorage'

export const prerender = false;

const SUPABASE_URL = (import.meta.env.SUPABASE_URL as string) || process.env.SUPABASE_URL
const DEFAULT_LONG_CACHE = 'public, max-age=31536000, immutable'
const PRIVATE_CACHE = 'public, max-age=60, s-maxage=3600, stale-while-revalidate=86400'

function detectMime(path: string) {
  const ext = path.split('.').pop()?.toLowerCase() || ''
  switch (ext) {
    case 'png':
      return 'image/png'
    case 'svg':
      return 'image/svg+xml'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    default:
      return 'application/octet-stream'
  }
}

export async function GET({ params, request }: { params: Record<string, any>, request: Request }) {
  try {
    let pathParam = params.path
    if (!pathParam) return new Response('Bad request', { status: 400 })
    let path = Array.isArray(pathParam) ? pathParam.join('/') : String(pathParam)
    // allow overriding the target bucket via ?bucket= (server-only decision)
    const reqUrl = new URL(request.url, 'http://localhost')
    const bucketOverride = reqUrl.searchParams.get('bucket')
    if (!path || path.includes('..')) return new Response('Bad request', { status: 400 })

    let bucket = (process.env.SUPABASE_BUCKET_NAME || DEFAULT_BUCKET) as string
    if (bucketOverride) {
      bucket = bucketOverride
      // if path starts with the bucket name (e.g. /api/images/blog/Precios.jpeg?bucket=blog), strip it
      if (path.startsWith(bucket + '/')) path = path.slice(bucket.length + 1)
    }
    const mime = detectMime(path)

    // Try public URL first (fast path). If object is public, redirect to it to allow CDN caching.
    if (SUPABASE_URL) {
      try {
        const publicUrl = buildPublicUrl(bucket, path)
        // HEAD request to check if public
        const head = await fetch(publicUrl, { method: 'HEAD' })
        if (head.ok) {
          return new Response(null, {
            status: 302,
            headers: {
              Location: publicUrl,
              'Cache-Control': DEFAULT_LONG_CACHE,
            },
          })
        }
      } catch (err) {
        // continue to private fetch path
        console.error('Public URL check failed', err)
      }
    }

    // Private / server-proxied path: use service role to download and stream
    const client = createServiceClient()
    const { data, error } = await client.storage.from(bucket).download(path)
    if (error) {
      const errStatus = (error as any)?.status
      if (errStatus === 404) return new Response('Not found', { status: 404 })
      console.error('Supabase storage error', error)
      return new Response('Upstream error', { status: 500 })
    }

    if (!data) return new Response('Not found', { status: 404 })

    // data can be a Blob or Node Readable - normalize to ArrayBuffer
    let body: ArrayBuffer
    if (typeof (data as any).arrayBuffer === 'function') {
      body = await (data as any).arrayBuffer()
    } else if ((data as any).stream) {
      // Node Readable stream -> read to buffer
      const chunks: Uint8Array[] = []
      for await (const chunk of (data as any)) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      body = Buffer.concat(chunks).buffer as unknown as ArrayBuffer
    } else {
      // Fallback: try to convert
      const text = await (data as any).text()
      body = (new TextEncoder().encode(text).buffer) as unknown as ArrayBuffer
    }

    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': mime,
        'Cache-Control': PRIVATE_CACHE,
      },
    })
  } catch (err: any) {
    console.error('Unexpected error in /api/images', err)
    return new Response('Internal server error', { status: 500 })
  }
}
