const { test } = require('node:test')
const assert = require('node:assert/strict')
const { assignHeadingSlugs } = require('../out/headings')

test('GitHub-style heading slugs preserve Unicode and disambiguate collisions', () => {
  assert.deepEqual(assignHeadingSlugs([
    { label: 'Foo & Bar', level: 1 },
    { label: 'Café 中文', level: 2 },
    { label: 'Foo & Bar', level: 2 },
    { label: 'Foo--Bar-1', level: 2 },
    { label: 'Foo & Bar', level: 3 },
  ]).map(heading => heading.slug), ['foo--bar', 'café-中文', 'foo--bar-1', 'foo--bar-1-1', 'foo--bar-2'])
})
