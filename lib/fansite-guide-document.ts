import type { NotionAssetManifest } from './notion-index.ts'

const CDN_ASSET_ORIGIN = 'https://cdn.jsdelivr.net/gh/gkzero0-cmyk/justserver3@main/public'

export type FansiteGuideBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'text'; text: string; style?: string }
  | { type: 'image'; src: string; originalSrc?: string | null; caption?: string | null; alt?: string | null }
  | { type: 'divider' }

export type FansiteGuideDocument = {
  pageId: string
  title: string
  blocks: FansiteGuideBlock[]
}

function normalizeId(value: unknown) { return String(value || '').replaceAll('-', '') }
function unwrapBlockEntry(entry: any) { return entry?.value?.value ?? entry?.value ?? entry ?? null }
function getBlocks(recordMap: any) { return Object.values(recordMap?.block || {}).map(unwrapBlockEntry).filter(Boolean) as any[] }
function richText(value: unknown) {
  if (!Array.isArray(value)) return ''
  return value.map((part: any) => Array.isArray(part) && typeof part[0] === 'string' ? part[0] : '').join('').replace(/\s+/g, ' ').trim()
}
function firstUrl(value: unknown): string | null {
  if (typeof value === 'string') return /^https?:\/\//i.test(value) || /^attachment:/i.test(value) ? value : null
  if (!Array.isArray(value)) return null
  for (const item of value) { const found = firstUrl(item); if (found) return found }
  return null
}
function canonicalUrl(value: string) {
  try { const url = new URL(value); if (!['http:', 'https:'].includes(url.protocol)) return null; url.search=''; url.hash=''; return url.toString() } catch { return null }
}
function cachedAssetUrl(pathname: string) {
  if (/^https?:\/\//i.test(pathname)) return pathname
  if (pathname.startsWith('/notion-assets/')) return `${CDN_ASSET_ORIGIN}${pathname}`
  return pathname
}
function resolveManifestAsset(source: string | null, manifest: NotionAssetManifest) {
  if (!source) return null
  const canonical = canonicalUrl(source)
  if (canonical && manifest[canonical]) return manifest[canonical]
  const attachmentId = source.match(/^attachment:([^:]+):/i)?.[1]?.toLowerCase()
  if (attachmentId) { const match = Object.entries(manifest).find(([key]) => key.toLowerCase().includes(attachmentId)); if (match) return match[1] }
  if (canonical) {
    let decoded=canonical; try { decoded=decodeURIComponent(canonical) } catch {}
    const ids=[...decoded.matchAll(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi)].map(match=>match[0].toLowerCase())
    const fileId=ids.at(-1); if(fileId){const match=Object.entries(manifest).find(([key])=>key.toLowerCase().includes(fileId));if(match)return match[1]}
  }
  return null
}
function imageSource(block: any) { return firstUrl(block?.properties?.source)||firstUrl(block?.format?.display_source)||firstUrl(block?.format?.source)||null }
function textBlock(block: any): FansiteGuideBlock | null {
  const text=richText(block?.properties?.title); if(!text)return null
  if(block.type==='header')return{type:'heading',level:1,text}
  if(block.type==='sub_header')return{type:'heading',level:2,text}
  if(block.type==='sub_sub_header')return{type:'heading',level:3,text}
  const styleByType:Record<string,string>={bulleted_list:'bullet',numbered_list:'number',quote:'quote',callout:'callout',code:'code',to_do:'todo',toggle:'toggle'}
  return{type:'text',text,...(styleByType[block.type]?{style:styleByType[block.type]}:{})}
}
export function extractFansiteGuideDocument(recordMap: unknown,pageId: string,manifest: NotionAssetManifest={}): FansiteGuideDocument {
  const allBlocks=getBlocks(recordMap),byId=new Map(allBlocks.filter(block=>block?.id).map(block=>[normalizeId(block.id),block])),normalizedPageId=normalizeId(pageId)
  const pageBlock=byId.get(normalizedPageId)||allBlocks.find(block=>['page','collection_view_page'].includes(block?.type)),result:FansiteGuideBlock[]=[],visited=new Set<string>()
  const visit=(ids:unknown)=>{for(const rawId of Array.isArray(ids)?ids:[]){const block=byId.get(normalizeId(rawId));if(!block)continue;const id=normalizeId(block.id);if(visited.has(id))continue;visited.add(id);if(['page','collection_view_page'].includes(block.type))continue
    if(block.type==='image'){const originalSrc=imageSource(block),cached=resolveManifestAsset(originalSrc,manifest),src=cached?cachedAssetUrl(cached):(originalSrc&&/^https?:\/\//i.test(originalSrc)?originalSrc:'');if(src){const caption=richText(block?.properties?.caption)||null;result.push({type:'image',src,originalSrc,caption,alt:caption})}}
    else if(block.type==='divider')result.push({type:'divider'})
    else{const row=textBlock(block);if(row)result.push(row)}
    if(block.content?.length)visit(block.content)
  }}
  visit(pageBlock?.content)
  return{pageId:normalizedPageId,title:richText(pageBlock?.properties?.title)||'가이드',blocks:result}
}
