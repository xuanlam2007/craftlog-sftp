# Appwrite Setup Instructions

Before using this application, you need to create the required collections in your Appwrite database.

## Database Setup

1. Go to your Appwrite Console
2. Create a new Database with ID: `sftp_monitor`
3. Create the following collections:

### Collection: `snapshots`
| Attribute | Type | Required | Default |
|-----------|------|----------|---------|
| createdAt | String | Yes | - |
| totalFiles | Integer | Yes | - |
| isBaseline | Boolean | Yes | - |

### Collection: `file_records`
| Attribute | Type | Required | Default |
|-----------|------|----------|---------|
| snapshotId | String | Yes | - |
| path | String | Yes | - |
| filename | String | Yes | - |
| size | Integer | Yes | - |
| mtime | String | Yes | - |
| hash | String | No | - |

**Index:** Create an index on `snapshotId` for better query performance.

### Collection: `change_logs`
| Attribute | Type | Required | Default |
|-----------|------|----------|---------|
| snapshotId | String | Yes | - |
| changeType | String | Yes | - |
| filename | String | Yes | - |
| path | String | Yes | - |
| detectedAt | String | Yes | - |

**Index:** Create an index on `detectedAt` (descending) for sorting.

### Collection: `changed_files`
| Attribute | Type | Required | Default |
|-----------|------|----------|---------|
| path | String | Yes | - |
| filename | String | Yes | - |
| firstDetected | String | Yes | - |
| lastDetected | String | Yes | - |
| changeCount | Integer | Yes | - |

**Index:** Create an index on `path` for uniqueness checks, and on `lastDetected` (descending) for sorting.

### Collection: `settings`
| Attribute | Type | Required | Default |
|-----------|------|----------|---------|
| host | String | Yes | - |
| port | Integer | Yes | - |
| username | String | Yes | - |
| password | String | Yes | - |
| basePath | String | Yes | - |
| ignoredPaths | String[] | No | [] |

## Permissions

For each collection, set the following permissions (adjust based on your security needs):

- **Read**: Any (or authenticated users)
- **Create**: Any (or authenticated users)
- **Update**: Any (or authenticated users)
- **Delete**: Any (or authenticated users)

## Environment Variables

Make sure these environment variables are set in your Vercel project:

- `NEXT_PUBLIC_APPWRITE_ENDPOINT` - Your Appwrite endpoint (e.g., `https://cloud.appwrite.io/v1`)
- `NEXT_PUBLIC_APPWRITE_PROJECT_ID` - Your Appwrite project ID
- `APPWRITE_API_KEY` - Your Appwrite API key with database permissions
