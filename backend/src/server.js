const express = require('express')

const app = express()
app.use(express.json())

app.get('/health', (_req, res) => res.json({ ok: true }))

const port = Number(process.env.PORT || 3001)
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on :${port}`)
})

