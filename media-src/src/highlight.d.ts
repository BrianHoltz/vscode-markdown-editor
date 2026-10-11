declare class Highlight {
  constructor(...ranges: Range[])
}

declare namespace CSS {
  const highlights: Map<string, Highlight>
}
