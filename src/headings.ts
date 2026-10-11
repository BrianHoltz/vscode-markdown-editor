export interface Heading {
  label: string
  level: number
  slug: string
  index: number
}

export function slugifyHeading(text: string): string {
  return text.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}_\- ]/gu, '')
    .replace(/ /g, '-')
}

export function assignHeadingSlugs(headings: { label: string; level: number }[]): Heading[] {
  const used = new Set<string>()
  return headings.map((heading, index) => {
    const base = slugifyHeading(heading.label)
    let slug = base
    let suffix = 0
    while (used.has(slug)) slug = `${base}-${++suffix}`
    used.add(slug)
    return { ...heading, slug, index }
  })
}
