const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const port = Number(process.env.PORT) || 3000
const hostname = '10.2.20.14'
const dev = false
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  }).listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
  })
}).catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})
