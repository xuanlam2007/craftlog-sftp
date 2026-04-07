import { NextResponse } from 'next/server'

export async function GET() {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID
  const apiKey = process.env.APPWRITE_API_KEY

  if (!endpoint || !projectId || !apiKey) {
    return NextResponse.json({
      error: 'Missing environment variables',
      endpoint: endpoint || 'NOT SET',
      projectId: projectId || 'NOT SET',
      apiKeyPresent: !!apiKey,
    })
  }

  // Test with raw HTTP request to bypass any SDK issues
  try {
    const response = await fetch(`${endpoint}/databases`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
      },
    })

    const data = await response.json()

    if (response.ok) {
      return NextResponse.json({
        success: true,
        message: 'API key is working!',
        statusCode: response.status,
        databases: data.databases?.map((db: { $id: string; name: string }) => ({ id: db.$id, name: db.name })) || [],
        config: {
          endpoint,
          projectId,
          apiKeyLength: apiKey.length,
        }
      })
    } else {
      return NextResponse.json({
        success: false,
        statusCode: response.status,
        error: data.message || 'Unknown error',
        errorType: data.type,
        rawResponse: data,
        config: {
          endpoint,
          projectId,
          apiKeyLength: apiKey.length,
          apiKeyPreview: `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`,
        },
        hint: response.status === 401 
          ? 'API key rejected. Please verify: 1) The key was created in project "craftlog-sftp", 2) The key has not expired, 3) You copied the FULL key without any extra spaces'
          : undefined
      })
    }
  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      config: {
        endpoint,
        projectId,
        apiKeyLength: apiKey.length,
      }
    })
  }
}
