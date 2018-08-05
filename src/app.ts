import * as express from 'express'
import * as dotenv from 'dotenv'
import * as path from 'path'
import * as bodyParser from 'body-parser'
import * as storagesController from './controllers/storages'

// Load environment variables from .env file, where API keys and passwords are configured
dotenv.config()

// Create Express server
const app = express()

// Express configuration
app.set('port', process.env.PORT || 3000)
app.use(express.static(path.join(__dirname, 'public'), { maxAge: 31557600000 }))
app.use(bodyParser.json())

app.get('/api/storages', storagesController.get)
app.post('/api/init', storagesController.init)
app.post('/api/store', storagesController.store)

// TODO API methods for per-storage init/store
// app.post("/api/storages", storagesController.addStorage);

// TODO API methods for storages management
// app.post("/api/storages", storagesController.addStorage);

module.exports = app
