import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { SharedInspectorProfile } from './inspector-profile-shared'

interface InspectorProfileStore {
  profiles: SharedInspectorProfile[]
}

const storePath = path.join(process.cwd(), 'data', 'inspector-profiles.json')
let mutationQueue = Promise.resolve()

async function readStore(): Promise<InspectorProfileStore> {
  try {
    return JSON.parse(await readFile(storePath, 'utf8')) as InspectorProfileStore
  } catch {
    return { profiles: [] }
  }
}

function withMutation<T>(operation: () => Promise<T>) {
  const result = mutationQueue.then(operation, operation)
  mutationQueue = result.then(() => undefined, () => undefined)
  return result
}

export async function listInspectorProfiles() {
  return (await readStore()).profiles
}

export async function saveInspectorProfiles(profiles: SharedInspectorProfile[]) {
  return withMutation(async () => {
    const store = await readStore()
    const savedProfiles = [...store.profiles]
    for (const profile of profiles) {
      const index = savedProfiles.findIndex((saved) => saved.id === profile.id || saved.email.toLowerCase() === profile.email.toLowerCase())
      if (index === -1) savedProfiles.push(profile)
      else {
        const existing = savedProfiles[index]
        savedProfiles[index] = {
          ...profile,
          inspectorSignature: profile.inspectorSignature === undefined
            ? existing.inspectorSignature
            : profile.inspectorSignature,
        }
      }
    }
    await mkdir(path.dirname(storePath), { recursive: true })
    await writeFile(storePath, JSON.stringify({ profiles: savedProfiles }, null, 2), 'utf8')
    return savedProfiles
  })
}
