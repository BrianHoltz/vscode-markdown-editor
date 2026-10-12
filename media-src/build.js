const fs = require('fs')
const esbuild = require('esbuild')
const path = require('path')

// Vditor loads its parser and renderers dynamically. Ship them, never require a CDN.
fs.cpSync(path.join(path.dirname(require.resolve('vditor/package.json')), 'dist'),
  path.resolve(__dirname, '../media/vendor/vditor/dist'), { recursive: true })

esbuild.build({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: '../media/dist/main.js',
  plugins: [{
    name: 'vditor-locales',
    setup(build) {
      build.onLoad({ filter: /[/\\]vditor[/\\]dist[/\\]js[/\\]i18n[/\\].+\.js$/ }, ({ path }) => {
        const source = fs.readFileSync(path, 'utf8')
        if (!source.startsWith('window.VditorI18n =')) {
          throw new Error(`Unrecognized Vditor locale: ${path}`)
        }
        return { contents: source.replace('window.VditorI18n =', 'export default'), loader: 'js' }
      })
    },
  }],
}).catch(error => {
  console.error(error)
  process.exitCode = 1
})
